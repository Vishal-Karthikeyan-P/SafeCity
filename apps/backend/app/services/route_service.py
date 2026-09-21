"""
Route Service – Improved Multi-Route Safe Routing
==================================================

Candidate collection strategy (up to ~23 candidates):
  Stage 1  – OSRM direct with alternatives=true        → up to 3 routes
  Stage 2  – 10 normal via-waypoint requests (5 fracs  → up to 10 routes
              × 2 sides, standard offset)
  Stage 2b – 10 wide-detour via-waypoint requests (5   → up to 10 routes
              fracs × 2 sides, 2× wider offset).  These
              are the most likely source of incident-free,
              high-safety-score alternatives.
  Stage 3  – Avoidance filter: any candidate whose geometry passes through a
              500 m radius buffer around a qualifying HIGH/CRITICAL-severity,
              route-relevant, verified (APPROVED/RESOLVED) incident is removed
              from the pool.  If all candidates are filtered out a fallback is
              returned with avoidance_warning=True so the caller can surface an
              appropriate warning rather than an empty response.

Deduplication:
  • Decode each encoded polyline to lat/lng waypoints.
  • Map each waypoint to a ~100 m grid cell (round lat/lng to 3 dp).
  • Compute Jaccard similarity of cell-key sets between every pair of routes.
  • Routes with Jaccard ≥ 0.80 are considered duplicates; keep the one with
    the higher cell-diversity (more unique road coverage).
  • Keep at most 5 distinct routes after deduplication.

Scoring:
  Each remaining route is scored independently by SafetyScoreService
  using the full category-severity-recency-verification-relevance model.

Ranking (composite score):
  composite = safety_score × 0.65
            + (1 − normalised_distance) × 0.20
            + (1 − normalised_duration) × 0.15

  Safety remains the primary factor (65 %).  A route that is 30 safety-
  points worse will never rank above a safer route solely because it is
  a few hundred metres shorter.

  recommended_route_idx → highest composite score
  safest_route_idx      → highest safety_score
  shortest_route_idx    → shortest distance_m

Risk factors:
  For each route, the top-3 incident categories ranked by total penalty
  contribution are returned as risk_factors[].
"""

import asyncio
import logging
import math
from typing import List, Dict, Any, Tuple, Set

import httpx
import polyline as polyline_lib
from geoalchemy2 import Geography
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.incident import Incident, IncidentCategory, SeverityLevel, IncidentStatus
from app.services.safety_score_service import SafetyScoreService, ROUTE_RELEVANT_CATEGORIES

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Jaccard similarity threshold: routes with ≥ this overlap are duplicates.
JACCARD_DUPLICATE_THRESHOLD = 0.80

# Grid cell precision: 3 decimal places ≈ 111 m resolution.
GRID_PRECISION = 3

# Maximum distinct routes to return after deduplication.
MAX_ROUTES = 5

# Via-waypoint fractions along the route vector (0 = start, 1 = dest).
# 5 fractions give better longitudinal coverage than 4.
VIA_FRACTIONS = [0.20, 0.35, 0.50, 0.65, 0.80]

# Perpendicular offset magnitude for standard via-waypoints.
VIA_SIDE_MAGNITUDE = 0.45

# Perpendicular offset magnitude for wide-detour via-waypoints (Stage 2b).
# Roughly 2× the standard offset; these generate routes that arc well clear
# of the direct corridor and are the primary source of incident-free paths.
VIA_WIDE_MAGNITUDE = 0.85

# ---------------------------------------------------------------------------
# Avoidance-filter constants
# ---------------------------------------------------------------------------

# Radius (metres) around each qualifying HIGH/CRITICAL incident to treat as
# an avoidance zone.  Any candidate route with a waypoint inside this buffer
# is considered to pass through the danger area and is rejected.
AVOIDANCE_RADIUS_M: float = 500.0

# Half-width (km) of the corridor around the start→destination straight line
# used to pre-fetch qualifying avoidance incidents from the database.  Set
# large enough to cover all via-waypoint detours (up to ~VIA_SIDE_MAGNITUDE°).
AVOIDANCE_CORRIDOR_KM: float = 10.0

# Severities that trigger an avoidance zone.
_AVOIDANCE_SEVERITIES = {SeverityLevel.HIGH, SeverityLevel.CRITICAL}

# ---------------------------------------------------------------------------
# Pure geometry helpers
# ---------------------------------------------------------------------------


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def polyline_length_m(encoded: str) -> float:
    """Return great-circle length of an encoded polyline in metres."""
    try:
        coords = polyline_lib.decode(encoded)
        if len(coords) < 2:
            return 0.0
        total = 0.0
        for i in range(len(coords) - 1):
            total += haversine_distance(coords[i][0], coords[i][1],
                                        coords[i + 1][0], coords[i + 1][1])
        return total
    except Exception:
        return 0.0


def _cell_keys(encoded: str) -> Set[str]:
    """
    Map every decoded waypoint to a ~100 m grid cell key.
    Returns an empty set if decoding fails.
    """
    try:
        coords = polyline_lib.decode(encoded)
        keys: Set[str] = set()
        for lat, lng in coords:
            keys.add(f"{round(lat, GRID_PRECISION)},{round(lng, GRID_PRECISION)}")
        return keys
    except Exception:
        return set()


def jaccard_similarity(a: Set[str], b: Set[str]) -> float:
    """Jaccard similarity between two sets of cell keys."""
    if not a or not b:
        return 0.0
    inter = len(a & b)
    union = len(a | b)
    return inter / union if union else 0.0


def _offset_via_point(
    slat: float, slng: float,
    dlat: float, dlng: float,
    fraction: float,
    side: float,
    magnitude_override: float = VIA_SIDE_MAGNITUDE,
) -> Tuple[float, float]:
    """
    Compute a via-waypoint:
      • Placed at `fraction` along the origin→destination vector.
      • Displaced perpendicularly by `side` × magnitude.
    side = +1.0 → left of the vector; −1.0 → right.
    magnitude_override controls the perpendicular displacement scale;
    use VIA_WIDE_MAGNITUDE for large detour candidates.
    """
    d_lat = dlat - slat
    d_lng = dlng - slng
    length = math.sqrt(d_lat ** 2 + d_lng ** 2)
    if length < 1e-7:
        return round(slat, 6), round(slng, 6)

    # Clamp perpendicular offset to a sensible absolute range (0.003–0.040°)
    # so short trips don’t produce trivially close via-points and long trips
    # don’t produce unreachably distant detours.
    mag = max(0.003, min(0.040, length * magnitude_override))
    perp_lat = (-d_lng / length) * mag * side
    perp_lng = (d_lat / length) * mag * side

    wp_lat = slat + d_lat * fraction + perp_lat
    wp_lng = slng + d_lng * fraction + perp_lng
    return round(wp_lat, 6), round(wp_lng, 6)


def _candidate_intersects_avoidance(
    encoded: str,
    zones: List[Dict[str, Any]],
) -> bool:
    """
    Return True if *any* decoded waypoint of `encoded` falls within the
    avoidance radius of *any* zone in `zones`.

    Uses per-waypoint haversine distance.  With OSRM's dense polylines
    (typically one point every 5–50 m) this is accurate enough for a
    500 m buffer without segment-to-circle intersection algebra.

    `zones` is a list of dicts: {"lat": float, "lng": float, "radius_m": float}.
    """
    if not zones:
        return False
    try:
        waypoints = polyline_lib.decode(encoded)
    except Exception:
        return False
    for wlat, wlng in waypoints:
        for zone in zones:
            if haversine_distance(wlat, wlng, zone["lat"], zone["lng"]) < zone["radius_m"]:
                return True
    return False


# ---------------------------------------------------------------------------
# RouteService
# ---------------------------------------------------------------------------


class RouteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.osrm_base = "http://router.project-osrm.org/route/v1/driving"
        self.safety_service = SafetyScoreService(db)

    # -----------------------------------------------------------------------
    # OSRM helpers
    # -----------------------------------------------------------------------

    async def _osrm_request(
        self,
        waypoints: List[Tuple[float, float]],
        alternatives: bool = False,
    ) -> List[Dict[str, Any]]:
        """
        Call OSRM routing API.
        waypoints: list of (lat, lng).
        Returns raw OSRM routes list, or [] on failure.
        """
        coord_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
        alt_param = "true" if alternatives else "false"
        url = (
            f"{self.osrm_base}/{coord_str}"
            f"?overview=full&geometries=polyline&alternatives={alt_param}"
        )
        headers = {"User-Agent": "SafeCityApp/1.0 (contact: admin@safecity.example.com)"}
        try:
            async with httpx.AsyncClient(headers=headers, timeout=8.0) as client:
                resp = await client.get(url)
                if resp.status_code != 200:
                    return []
                data = resp.json()
                if data.get("code") != "Ok" or not data.get("routes"):
                    return []
                return data["routes"]
        except Exception:
            return []

    # -----------------------------------------------------------------------
    # Candidate collection
    # -----------------------------------------------------------------------

    # -----------------------------------------------------------------------
    # Avoidance zone helpers
    # -----------------------------------------------------------------------

    async def _fetch_avoidance_zones(
        self,
        slat: float, slng: float,
        dlat: float, dlng: float,
    ) -> List[Dict[str, Any]]:
        """
        Query the database for HIGH/CRITICAL, route-relevant, verified
        (APPROVED or RESOLVED) incidents within AVOIDANCE_CORRIDOR_KM of
        the straight line between (slat, slng) and (dlat, dlng).

        Returns a list of avoidance-zone dicts:
            {"lat": float, "lng": float, "radius_m": float}
        """
        # Build a 2-point LINESTRING for the corridor query.
        linestring_wkt = f"LINESTRING({slng} {slat},{dlng} {dlat})"
        corridor_geom = func.ST_SetSRID(
            func.ST_GeomFromText(linestring_wkt), 4326
        ).cast(Geography(srid=4326))

        corridor_m = AVOIDANCE_CORRIDOR_KM * 1000.0

        try:
            query = (
                select(Incident)
                .options(selectinload(Incident.category))
                .where(
                    func.ST_DWithin(Incident.location_geom, corridor_geom, corridor_m),
                    Incident.severity.in_(_AVOIDANCE_SEVERITIES),
                    Incident.status.in_(
                        [IncidentStatus.APPROVED, IncidentStatus.RESOLVED]
                    ),
                    Incident.deleted_at.is_(None),
                )
            )
            result = await self.db.execute(query)
            rows = result.scalars().all()
        except Exception as exc:
            log.warning("avoidance_zones: DB query failed (%s) – skipping filter", exc)
            return []

        zones: List[Dict[str, Any]] = []
        for inc in rows:
            cat_slug = inc.category.slug if inc.category else ""
            if cat_slug not in ROUTE_RELEVANT_CATEGORIES:
                continue
            zones.append({
                "lat": inc.location_lat,
                "lng": inc.location_lng,
                "radius_m": AVOIDANCE_RADIUS_M,
            })

        log.info(
            "avoidance_zones: found %d qualifying HIGH/CRITICAL incidents in corridor",
            len(zones),
        )
        return zones

    # -----------------------------------------------------------------------
    # Candidate collection
    # -----------------------------------------------------------------------

    async def _collect_candidates(
        self,
        slat: float, slng: float,
        dlat: float, dlng: float,
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
        """
        Collect up to ~23 raw candidate routes from OSRM, then apply the
        avoidance filter (Stage 3).

        Stages:
          1   – OSRM direct with alternatives=true  (≤3 routes)
          2   – 10 standard-offset via-waypoints    (≤10 routes)
          2b  – 10 wide-detour via-waypoints        (≤10 routes)
          3   – Avoidance filter

        Returns:
            (safe_candidates, avoidance_zones, avoidance_filtered_count)

            safe_candidates          – candidates that do NOT pass through any
                                       avoidance zone (may equal raw candidates
                                       when no zones exist).
            avoidance_zones          – list of zone dicts used for filtering.
            avoidance_filtered_count – number of candidates removed by the filter.
        """
        candidates: List[Dict[str, Any]] = []

        # ── Stage 1: OSRM direct with alternatives=true ───────────────────
        osrm_routes = await self._osrm_request(
            [(slat, slng), (dlat, dlng)], alternatives=True
        )
        direct_labels = ["Shortest", "Alternative 1", "Alternative 2", "Alternative 3"]
        for i, r in enumerate(osrm_routes):
            geo = r.get("geometry", "")
            if geo:
                candidates.append({
                    "geometry": geo,
                    "distance": r.get("distance", 0),
                    "duration": r.get("duration", 0),
                    "label": direct_labels[i] if i < len(direct_labels) else f"Alternative {i}",
                })

        # ── Stage 2 + 2b: via-waypoint requests (both normal and wide offsets)
        # Fire all 20 tasks concurrently and guard each independently.
        side_names = {1.0: "N", -1.0: "S"}
        fraction_names = {
            0.20: "VEarly", 0.35: "Early",
            0.50: "Mid",
            0.65: "Late", 0.80: "VLate",
        }

        via_tasks: List = []
        via_labels: List[str] = []

        # Stage 2 – standard offset
        for fraction in VIA_FRACTIONS:
            for side in [1.0, -1.0]:
                via_pt = _offset_via_point(
                    slat, slng, dlat, dlng, fraction, side,
                    magnitude_override=VIA_SIDE_MAGNITUDE,
                )
                via_tasks.append(
                    self._osrm_request([(slat, slng), via_pt, (dlat, dlng)], alternatives=False)
                )
                via_labels.append(
                    f"{side_names[side]}{fraction_names.get(fraction, str(fraction))}"
                )

        # Stage 2b – wide-detour offset (arcs well clear of the direct path)
        for fraction in VIA_FRACTIONS:
            for side in [1.0, -1.0]:
                via_pt = _offset_via_point(
                    slat, slng, dlat, dlng, fraction, side,
                    magnitude_override=VIA_WIDE_MAGNITUDE,
                )
                via_tasks.append(
                    self._osrm_request([(slat, slng), via_pt, (dlat, dlng)], alternatives=False)
                )
                via_labels.append(
                    f"Wide-{side_names[side]}{fraction_names.get(fraction, str(fraction))}"
                )

        via_results = await asyncio.gather(*via_tasks, return_exceptions=True)

        for label, result in zip(via_labels, via_results):
            if isinstance(result, Exception) or not result:
                continue
            r = result[0]
            geo = r.get("geometry", "")
            if geo:
                candidates.append({
                    "geometry": geo,
                    "distance": r.get("distance", 0),
                    "duration": r.get("duration", 0),
                    "label": label,
                })

        log.info("collect_candidates: gathered %d raw candidates", len(candidates))

        # ── Stage 3: Avoidance filter ─────────────────────────────────────
        # Fetch qualifying HIGH/CRITICAL incident zones once, then filter all
        # candidates in a single pure-Python pass (no per-candidate DB query).
        zones = await self._fetch_avoidance_zones(slat, slng, dlat, dlng)
        if zones:
            safe: List[Dict[str, Any]] = []
            unsafe: List[str] = []
            for c in candidates:
                if _candidate_intersects_avoidance(c["geometry"], zones):
                    unsafe.append(c["label"])
                else:
                    safe.append(c)
            if unsafe:
                log.info(
                    "avoidance_filter: removed %d candidate(s) that pass through "
                    "HIGH/CRITICAL incident zones: %s",
                    len(unsafe),
                    unsafe,
                )
            log.info(
                "avoidance_filter: %d candidate(s) remain after filtering",
                len(safe),
            )
            return safe, zones, len(unsafe)

        return candidates, [], 0

    # -----------------------------------------------------------------------
    # Deduplication
    # -----------------------------------------------------------------------

    def _deduplicate(
        self, candidates: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Remove near-duplicate routes using Jaccard similarity on grid cells.
        Routes with similarity ≥ JACCARD_DUPLICATE_THRESHOLD are duplicates;
        keep the one with greater cell diversity (unique road coverage).
        Then return at most MAX_ROUTES distinct routes.
        """
        if not candidates:
            return []

        # Pre-compute cell-key sets for all candidates.
        cell_sets: List[Set[str]] = [_cell_keys(c["geometry"]) for c in candidates]

        # Greedy deduplication: add route if not similar to any already-kept route.
        kept_indices: List[int] = []
        for i, (candidate, cells_i) in enumerate(zip(candidates, cell_sets)):
            if not cells_i:
                continue
            is_duplicate = False
            for j in kept_indices:
                sim = jaccard_similarity(cells_i, cell_sets[j])
                if sim >= JACCARD_DUPLICATE_THRESHOLD:
                    # Keep the one with more unique cells (greater route diversity).
                    if len(cells_i) > len(cell_sets[j]):
                        # Replace j with i in kept_indices.
                        kept_indices[kept_indices.index(j)] = i
                    is_duplicate = True
                    break
            if not is_duplicate:
                kept_indices.append(i)
                if len(kept_indices) >= MAX_ROUTES:
                    break

        return [candidates[i] for i in kept_indices]

    # -----------------------------------------------------------------------
    # Risk factor extraction
    # -----------------------------------------------------------------------

    @staticmethod
    def _extract_risk_factors(incident_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Summarise the top-3 incident categories by total penalty contribution.
        Input: the incident_list returned by calculate_route_safety.
        """
        by_category: Dict[str, Dict[str, Any]] = {}
        for inc in incident_list:
            if not inc.get("is_route_relevant"):
                continue
            name = inc.get("category_name", "Unknown")
            icon = inc.get("category_icon", "📍")
            penalty = inc.get("penalty_impact", 0.0) or 0.0
            if name not in by_category:
                by_category[name] = {"icon": icon, "name": name, "count": 0, "total_penalty": 0.0}
            by_category[name]["count"] += 1
            by_category[name]["total_penalty"] += penalty

        # Sort by total_penalty descending, return top 3.
        sorted_factors = sorted(
            by_category.values(),
            key=lambda x: x["total_penalty"],
            reverse=True,
        )
        for f in sorted_factors:
            f["total_penalty"] = round(f["total_penalty"], 2)
        return sorted_factors[:3]

    # -----------------------------------------------------------------------
    # Composite ranking
    # -----------------------------------------------------------------------

    @staticmethod
    def _compute_composite(
        safety_score: float,
        distance_m: float,
        duration_s: float,
        max_dist: float,
        max_dur: float,
    ) -> float:
        """
        Balanced composite score 0–100:
          safety      65 % weight  (higher is better)
          distance    20 % weight  (shorter is better)
          duration    15 % weight  (faster is better)
        """
        norm_dist = (distance_m / max_dist) if max_dist > 0 else 0.0
        norm_dur = (duration_s / max_dur) if max_dur > 0 else 0.0
        composite = (
            safety_score * 0.65
            + (1.0 - norm_dist) * 100.0 * 0.20
            + (1.0 - norm_dur) * 100.0 * 0.15
        )
        return round(min(100.0, max(0.0, composite)), 1)

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------

    async def get_safe_route(
        self,
        start_lat: float, start_lng: float,
        dest_lat: float, dest_lng: float,
    ) -> Dict[str, Any]:
        """
        Return 3–5 genuinely distinct route alternatives, each independently
        scored, ranked by composite safety+distance+duration score.
        """
        # ── Collect candidates (with avoidance filter) ────────────────────
        safe_candidates, avoidance_zones, avoidance_filtered = await self._collect_candidates(
            start_lat, start_lng, dest_lat, dest_lng
        )
        avoidance_warning = False

        # Hard fallback: if OSRM is completely unreachable, return error.
        if not safe_candidates and avoidance_filtered == 0:
            return {"error": "No routes could be obtained from the routing service."}

        # Soft fallback: all candidates were filtered by avoidance zones but we
        # still need to return *something* – use the unfiltered pool with a
        # warning so the frontend can surface an appropriate message.
        if not safe_candidates and avoidance_filtered > 0:
            log.warning(
                "avoidance_filter: all %d candidate(s) pass through HIGH/CRITICAL zones; "
                "falling back to unfiltered candidates with avoidance_warning=True",
                avoidance_filtered,
            )
            # All candidates were discarded; re-run Stage 1 without the filter
            # so we still return usable routes (with avoidance_warning=True).
            fallback_osrm = await self._osrm_request(
                [(start_lat, start_lng), (dest_lat, dest_lng)], alternatives=True
            )
            direct_labels = ["Shortest", "Alternative 1", "Alternative 2", "Alternative 3"]
            safe_candidates = [
                {
                    "geometry": r["geometry"],
                    "distance": r.get("distance", 0),
                    "duration": r.get("duration", 0),
                    "label": direct_labels[i] if i < len(direct_labels) else f"Alternative {i}",
                }
                for i, r in enumerate(fallback_osrm)
                if r.get("geometry")
            ]
            avoidance_warning = True

        if not safe_candidates:
            return {"error": "No routes could be obtained from the routing service."}

        candidates = safe_candidates

        # ── Deduplicate ────────────────────────────────────────────────────
        unique = self._deduplicate(candidates)

        if not unique:
            return {"error": "No valid routes could be generated."}

        # ── Score each route independently ─────────────────────────────────
        processed: List[Dict[str, Any]] = []
        for rr in unique:
            encoded = rr["geometry"]
            osrm_dist = rr["distance"]
            osrm_dur = rr["duration"]

            calc_dist = polyline_length_m(encoded)
            distance_m = calc_dist if calc_dist > 10 else osrm_dist
            duration_s = osrm_dur

            try:
                safety_data = await self.safety_service.calculate_route_safety(
                    encoded, radius_km=0.2
                )
            except Exception:
                safety_data = {
                    "score": 50.0,
                    "risk_level": "moderate",
                    "relevant_incident_count": 0,
                    "incidents": [],
                    "explanation": "Safety scoring unavailable for this route.",
                }

            risk_factors = self._extract_risk_factors(safety_data.get("incidents", []))

            processed.append({
                "label": rr["label"],
                "geometry": encoded,
                "distance_m": round(distance_m, 1),
                "duration_s": round(duration_s, 1),
                "safety_score": safety_data["score"],
                "route_risk_level": safety_data["risk_level"],
                "relevant_incident_count": safety_data.get("relevant_incident_count", 0),
                "explanation": safety_data.get("explanation", ""),
                "incidents": safety_data.get("incidents", []),
                "risk_factors": risk_factors,
                # composite_score filled in after normalisation below
                "composite_score": 0.0,
            })

        # ── Compute composite scores ────────────────────────────────────────
        max_dist = max(r["distance_m"] for r in processed) or 1.0
        max_dur = max(r["duration_s"] for r in processed) or 1.0

        for r in processed:
            r["composite_score"] = self._compute_composite(
                r["safety_score"], r["distance_m"], r["duration_s"],
                max_dist, max_dur,
            )

        # ── Rank by composite score (highest first) ────────────────────────
        processed.sort(key=lambda r: r["composite_score"], reverse=True)

        # ── Index lookups ───────────────────────────────────────────────────
        recommended_idx = 0  # after sort, index 0 = best composite
        shortest_idx = min(range(len(processed)), key=lambda i: processed[i]["distance_m"])
        safest_idx = max(
            range(len(processed)),
            key=lambda i: (processed[i]["safety_score"], -processed[i]["distance_m"]),
        )

        return {
            "routes": processed,
            "recommended_route_idx": recommended_idx,
            "shortest_route_idx": shortest_idx,
            "safest_route_idx": safest_idx,
            # Avoidance metadata
            "avoidance_zone_count": len(avoidance_zones),
            "avoidance_filtered_count": avoidance_filtered,
            "avoidance_warning": avoidance_warning,
        }
