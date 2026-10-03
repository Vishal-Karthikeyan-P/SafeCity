"""
Route Service – OSRM candidate generation + SafeCity safety evaluation
======================================================================

OSRM/OSM = road network and route generation.  SafeCity = safety analysis.

Pipeline
--------
1. Incidents for the trip corridor are loaded ONCE (single DB query), validated,
   weighted and projected to local metres (shared model in safety_score_service).
2. Candidate routes (OSRM only, one shared HTTP client, bounded concurrency,
   stage deadline):
     a. direct request with alternatives=true
     b. direct requests with exclude=motorway / exclude=toll (ignored if unsupported)
     c. via-waypoint detours (3 fractions x 2 sides x normal/wide offset)
     d. incident-aware via-points: placed 650 m to either side of the worst
        route-relevant incident clusters on the shortest / lowest-risk routes
        (only when no clean route exists yet)
3. Every candidate is evaluated once (geometry decoded once; distance to every
   incident via a spatial grid, O(route points + incidents)):
   distance, ETA, incidents within 500 m, weighted risk, safety score, detour ratio.
4. Near-identical routes (>= 90 % shared ~50 m road cells) are dropped, keeping the
   better neutral trade-off.
5. Selection happens AFTER scoring, on the risk-vs-distance Pareto frontier:
     cost(lambda) = (1-lambda) * risk + lambda * KAPPA * ln(length / shortest)
   Route 1 (lambda=0.05): a route staying >= 500 m from every route-relevant
   incident if one exists within CLEAN_DETOUR_CAP of the shortest length,
   otherwise the minimum-risk / small-detour route.  Routes 2-5 take
   lambda = 0.25 / 0.5 / 0.75 / 0.95 on distinct frontier points.  Routes that are
   tiny variations of an already chosen one (risk and length both within ~3 %) are
   skipped.  Fewer than 5 distinct routes are returned when that is all there is
   (never padded; at least 3 when 3 valid candidates exist).
"""

import asyncio
import logging
import math
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx
import polyline as polyline_lib
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.safety_score_service import (
    ROUTE_RADIUS_M,
    ROUTE_RELEVANT_CATEGORIES,  # noqa: F401  (re-exported for existing importers)
    IncidentRecord,
    Projection,
    SafetyScoreService,
    _num,
    clean_points,
    densify,
    evaluate_route_exposure,
    haversine_m,
    project_records,
    risk_level_for,
    summarize_exposure,
    valid_latlng,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Routes sharing >= this fraction of ~50 m road cells are duplicates.  Deliberately
# high so a short detour around an incident is NOT collapsed into the direct route.
JACCARD_DUPLICATE_THRESHOLD = 0.90
CELL_M = 50.0

MAX_ROUTES = 5
MIN_ROUTES = 3

VIA_FRACTIONS = [0.25, 0.50, 0.75]
VIA_SIDE_MAGNITUDE = 0.45
VIA_WIDE_MAGNITUDE = 0.85

AVOIDANCE_RADIUS_M: float = ROUTE_RADIUS_M      # 500 m
AVOID_VIA_MARGIN_M = 150.0                      # via-points sit AVOIDANCE_RADIUS_M + margin from incident
MAX_AVOID_JOBS = 10
CORRIDOR_BASE_M = 6000.0                        # covers wide via detours (<= ~4.5 km) + 500 m window

MAX_DETOUR_RATIO = 2.0      # candidates longer than this x shortest are dropped (unless needed for MIN_ROUTES)
CLEAN_DETOUR_CAP = 1.5      # "reasonably short" limit for a fully 500 m-clear Route 1
KAPPA = 3.0                 # weight of ln(distance ratio) vs risk units in the trade-off cost
LAMBDAS = (0.05, 0.95, 0.50, 0.25, 0.75)        # selection order; output is sorted by lambda
DISTINCT_RISK_DELTA = 0.03
DISTINCT_LOG_LEN_DELTA = 0.03

OSRM_CONCURRENCY = 6
OSRM_TIMEOUT_S = 8.0
STAGE_DEADLINE_S = 15.0
FALLBACK_SPEED_MPS = 8.33   # ~30 km/h, only when OSRM gives no usable duration
INCIDENTS_PER_ROUTE_PAYLOAD = 50

# ---------------------------------------------------------------------------
# Pure geometry helpers
# ---------------------------------------------------------------------------


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in metres."""
    return haversine_m(lat1, lon1, lat2, lon2)


def polyline_length_m(encoded: str) -> float:
    """Return great-circle length of an encoded polyline in metres (0.0 on any error)."""
    try:
        return _path_length_m(clean_points(polyline_lib.decode(encoded)))
    except Exception:
        return 0.0


def _path_length_m(pts: List[Tuple[float, float]]) -> float:
    return sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(pts, pts[1:]))


def _cells_from_xy(xy: List[Tuple[float, float]]) -> Set[Tuple[int, int]]:
    """
    ~50 m road cells covered by a projected polyline.  Every segment is sampled from
    its own start, so shared road segments yield identical cells in different routes.
    """
    cells: Set[Tuple[int, int]] = set()
    for (x0, y0), (x1, y1) in zip(xy, xy[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) // CELL_M) + 1)
        for k in range(n):
            t = k / n
            cells.add((math.floor((x0 + (x1 - x0) * t) / CELL_M), math.floor((y0 + (y1 - y0) * t) / CELL_M)))
        cells.add((math.floor(x1 / CELL_M), math.floor(y1 / CELL_M)))
    return cells


def _cell_keys(encoded: str) -> Set[Tuple[int, int]]:
    """Cell set of an encoded polyline; empty set if it cannot be decoded."""
    try:
        pts = clean_points(polyline_lib.decode(encoded))
        if len(pts) < 2:
            return set()
        proj = Projection(pts[0][0], pts[0][1])
        return _cells_from_xy([proj.xy(*p) for p in pts])
    except Exception:
        return set()


def jaccard_similarity(a: Set[Any], b: Set[Any]) -> float:
    """Jaccard similarity between two sets of cell keys."""
    if not a or not b:
        return 0.0
    union = len(a | b)
    return len(a & b) / union if union else 0.0


def _offset_via_point(
    slat: float, slng: float,
    dlat: float, dlng: float,
    fraction: float,
    side: float,
    magnitude_override: float = VIA_SIDE_MAGNITUDE,
) -> Tuple[float, float]:
    """
    Via-waypoint placed at `fraction` along origin->destination, displaced perpendicularly
    by `side` x magnitude (+1 left, -1 right).  Magnitude is clamped to 0.003-0.040 deg so
    short trips don't get trivial via-points and long trips don't get unreachable ones.
    """
    d_lat = dlat - slat
    d_lng = dlng - slng
    length = math.sqrt(d_lat ** 2 + d_lng ** 2)
    if length < 1e-7:
        return round(slat, 6), round(slng, 6)
    mag = max(0.003, min(0.040, length * magnitude_override))
    perp_lat = (-d_lng / length) * mag * side
    perp_lng = (d_lat / length) * mag * side
    return round(slat + d_lat * fraction + perp_lat, 6), round(slng + d_lng * fraction + perp_lng, 6)


def _candidate_intersects_avoidance(encoded: str, zones: List[Dict[str, Any]]) -> bool:
    """True if any decoded waypoint of `encoded` lies within a zone's radius (utility, kept for callers)."""
    if not zones:
        return False
    try:
        waypoints = polyline_lib.decode(encoded)
    except Exception:
        return False
    return any(
        haversine_m(wlat, wlng, z["lat"], z["lng"]) < z["radius_m"]
        for wlat, wlng in waypoints for z in zones
    )


# ---------------------------------------------------------------------------
# RouteService
# ---------------------------------------------------------------------------


class RouteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.osrm_base = settings.OSRM_BASE_URL
        self.safety_service = SafetyScoreService(db)

    # -----------------------------------------------------------------------
    # OSRM helpers
    # -----------------------------------------------------------------------

    async def _osrm_request(
        self,
        waypoints: List[Tuple[float, float]],
        alternatives: bool = False,
        exclude: Optional[str] = None,
        client: Optional[httpx.AsyncClient] = None,
        retries: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Call the OSRM route API. waypoints: (lat, lng) list. Returns raw OSRM routes, or []
        on any failure (timeout, HTTP error, bad JSON, non-Ok code, invalid input).
        """
        if len(waypoints) < 2 or not all(valid_latlng(a, b) for a, b in waypoints):
            return []
        coord_str = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in waypoints)
        url = (
            f"{self.osrm_base}/{coord_str}"
            f"?overview=full&geometries=polyline&alternatives={'true' if alternatives else 'false'}"
        )
        if exclude:
            url += f"&exclude={exclude}"
        headers = {"User-Agent": "SafeCityApp/1.0 (contact: admin@safecity.example.com)"}
        for _ in range(retries + 1):
            try:
                if client is not None:
                    resp = await client.get(url, headers=headers)
                else:
                    async with httpx.AsyncClient(timeout=OSRM_TIMEOUT_S) as tmp:
                        resp = await tmp.get(url, headers=headers)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                routes = data.get("routes") if isinstance(data, dict) else None
                if data.get("code") == "Ok" and isinstance(routes, list) and routes:
                    return [r for r in routes if isinstance(r, dict)]
            except Exception as exc:
                log.debug("osrm request failed: %s", exc)
        return []

    async def _osrm_batch(
        self, client: httpx.AsyncClient, jobs: List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]]
    ) -> List[Dict[str, Any]]:
        """Run OSRM jobs (label, waypoints, alternatives, exclude, retries) concurrently under a deadline."""
        if not jobs:
            return []
        sem = asyncio.Semaphore(OSRM_CONCURRENCY)

        async def run(job):
            async with sem:
                _, wps, alt, excl, retries = job
                return await self._osrm_request(wps, alternatives=alt, exclude=excl, client=client, retries=retries)

        tasks = [asyncio.ensure_future(run(j)) for j in jobs]
        done, pending = await asyncio.wait(tasks, timeout=STAGE_DEADLINE_S)
        for p in pending:
            p.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
            log.warning("osrm batch: %d/%d request(s) hit the %.0fs deadline", len(pending), len(tasks), STAGE_DEADLINE_S)

        out: List[Dict[str, Any]] = []
        for job, task in zip(jobs, tasks):
            if task not in done or task.cancelled() or task.exception() is not None:
                continue
            for i, r in enumerate(task.result()):
                geo = r.get("geometry")
                if isinstance(geo, str) and geo:
                    out.append({
                        "geometry": geo, "distance": r.get("distance", 0), "duration": r.get("duration", 0),
                        "label": job[0] if i == 0 else f"{job[0]} alt {i}",
                    })
        return out

    # -----------------------------------------------------------------------
    # Candidate collection
    # -----------------------------------------------------------------------

    async def _collect_candidates(
        self, client: httpx.AsyncClient,
        slat: float, slng: float, dlat: float, dlng: float,
        short_trip: bool = False,
    ) -> List[Dict[str, Any]]:
        """Stage 1-3: direct (alternatives, excludes) and via-waypoint detour routes."""
        s, d = (slat, slng), (dlat, dlng)
        jobs: List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]] = [
            ("Direct", [s, d], True, None, 1),
        ]
        if not short_trip:
            jobs += [("No-Motorway", [s, d], False, "motorway", 0), ("No-Toll", [s, d], False, "toll", 0)]
            names = {1.0: "N", -1.0: "S"}
            for mag, prefix in ((VIA_SIDE_MAGNITUDE, ""), (VIA_WIDE_MAGNITUDE, "Wide-")):
                for fraction in VIA_FRACTIONS:
                    for side in (1.0, -1.0):
                        via = _offset_via_point(slat, slng, dlat, dlng, fraction, side, mag)
                        jobs.append((f"{prefix}{names[side]}{int(fraction * 100)}", [s, via, d], False, None, 0))
        return await self._osrm_batch(client, jobs)

    def _avoidance_jobs(
        self, refs: List[Dict[str, Any]], proj: Projection, s: Tuple[float, float], d: Tuple[float, float]
    ) -> List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]]:
        """
        Incident-aware via-points: for the worst route-relevant incident clusters on the
        reference routes, place a via 650 m to either side of the incident (perpendicular to the
        route there).  Also one multi-via route using the side each route already lies on.
        """
        jobs, seen = [], set()
        offset = AVOIDANCE_RADIUS_M + AVOID_VIA_MARGIN_M
        for ref in refs:
            exposed = sorted((t for t in ref["ev"]["exposed"] if t[0].relevant and t[3] > 0), key=lambda t: -t[3])
            centers: List[Tuple[IncidentRecord, float, int, float]] = []
            for t in exposed:
                if all(math.hypot(t[0].x - c[0].x, t[0].y - c[0].y) > 800.0 for c in centers):
                    centers.append(t)
                if len(centers) >= 2:
                    break
            multi: List[Tuple[int, Tuple[float, float]]] = []
            for rec, _dist, seg, _e in centers:
                (x0, y0), (x1, y1) = ref["dense"][seg], ref["dense"][seg + 1]
                seg_len = math.hypot(x1 - x0, y1 - y0)
                if seg_len < 1e-6:
                    continue
                tx, ty = (x1 - x0) / seg_len, (y1 - y0) / seg_len
                nx, ny = -ty, tx
                u = max(0.0, min(1.0, ((rec.x - x0) * tx + (rec.y - y0) * ty) / seg_len))
                side_now = 1.0 if ((x0 + (x1 - x0) * u - rec.x) * nx + (y0 + (y1 - y0) * u - rec.y) * ny) >= 0 else -1.0
                for side in (1.0, -1.0):
                    via = tuple(round(v, 6) for v in proj.latlng(rec.x + nx * side * offset, rec.y + ny * side * offset))
                    if side == side_now:
                        multi.append((seg, via))
                    if via not in seen and valid_latlng(*via):
                        seen.add(via)
                        jobs.append((f"Avoid-{len(jobs) + 1}", [s, via, d], False, None, 0))
            if len(multi) >= 2:
                vias = [v for _, v in sorted(multi)]
                jobs.append((f"Avoid-Multi-{len(jobs) + 1}", [s, *vias, d], False, None, 0))
        return jobs[:MAX_AVOID_JOBS]

    # -----------------------------------------------------------------------
    # Candidate preparation / deduplication / selection
    # -----------------------------------------------------------------------

    @staticmethod
    def _prepare_candidate(
        raw: Dict[str, Any], proj: Projection, records: List[IncidentRecord]
    ) -> Optional[Dict[str, Any]]:
        """Decode once, validate, measure and evaluate a raw OSRM route. None if geometry is unusable."""
        geo = raw.get("geometry")
        if not isinstance(geo, str) or not geo:
            return None
        try:
            pts = clean_points(polyline_lib.decode(geo))
        except Exception:
            return None
        if len(pts) < 2:
            return None
        calc = _path_length_m(pts)
        osrm_dist = _num(raw.get("distance"), 0.0) or 0.0
        length = calc if calc > 10 else osrm_dist
        if length <= 0:
            return None
        dur = _num(raw.get("duration"), 0.0) or 0.0
        if dur <= 0:
            dur = length / FALLBACK_SPEED_MPS
        xy = [proj.xy(*p) for p in pts]
        dense = densify(xy, AVOIDANCE_RADIUS_M)
        ev = evaluate_route_exposure(dense, records, AVOIDANCE_RADIUS_M)
        return {
            "label": raw.get("label", "Route"), "geometry": geo, "distance": length, "duration": dur,
            "len_m": length, "dur_s": dur, "dense": dense, "cells": _cells_from_xy(xy), "ev": ev,
            "risk_index": ev["risk_index"], "relevant": ev["relevant_count"],
        }

    @staticmethod
    def _cost(c: Dict[str, Any], lam: float, l_min: float) -> float:
        """Trade-off cost: (1-lam)*risk + lam*KAPPA*ln(length/shortest); both terms >= 0."""
        return (1.0 - lam) * c["risk_index"] + lam * KAPPA * math.log(max(c["len_m"], 1.0) / max(l_min, 1.0))

    def _deduplicate(self, candidates: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Drop near-identical routes (cell Jaccard >= threshold), keeping the better neutral
        (lambda=0.5) trade-off.  Candidates without cells are computed on demand.
        """
        if not candidates:
            return []
        for c in candidates:
            if "cells" not in c:
                c["cells"] = _cell_keys(c.get("geometry", ""))
        usable = [c for c in candidates if c["cells"]]
        l_min = min((c["len_m"] for c in usable), default=1.0)
        usable.sort(key=lambda c: (self._cost(c, 0.5, l_min), c["len_m"]))
        kept: List[Dict[str, Any]] = []
        for c in usable:
            if all(jaccard_similarity(c["cells"], k["cells"]) < JACCARD_DUPLICATE_THRESHOLD for k in kept):
                kept.append(c)
        return kept

    @staticmethod
    def _pareto(pool: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Non-dominated routes on (risk, length); a small margin avoids splitting hairs."""
        front = []
        for c in pool:
            dominated = any(
                o is not c
                and o["risk_index"] <= c["risk_index"] + 1e-9
                and o["len_m"] <= c["len_m"] + 1e-6
                and (o["risk_index"] < c["risk_index"] - 0.01 or o["len_m"] < c["len_m"] * 0.99)
                for o in pool
            )
            if not dominated:
                front.append(c)
        return front

    @staticmethod
    def _distinct(c: Dict[str, Any], chosen: List[Dict[str, Any]]) -> bool:
        return all(
            abs(c["risk_index"] - s["risk_index"]) >= DISTINCT_RISK_DELTA
            or abs(math.log(max(c["len_m"], 1.0) / max(s["len_m"], 1.0))) >= DISTINCT_LOG_LEN_DELTA
            for s in chosen
        )

    def _select_routes(self, pool: List[Dict[str, Any]], data_ok: bool) -> List[Dict[str, Any]]:
        """Pick up to MAX_ROUTES routes that represent distinct safety-vs-distance trade-offs."""
        l_min = min(c["len_m"] for c in pool)
        front = self._pareto(pool)
        chosen: List[Tuple[float, Dict[str, Any]]] = []

        def taken() -> List[Dict[str, Any]]:
            return [c for _, c in chosen]

        for lam in LAMBDAS:
            avail = [c for c in front if all(c is not t for t in taken()) and self._distinct(c, taken())]
            if not avail:
                continue
            pick = None
            if lam == LAMBDAS[0]:
                clean = [c for c in avail if c["relevant"] == 0 and c["len_m"] <= CLEAN_DETOUR_CAP * l_min]
                if clean:
                    pick = min(clean, key=lambda c: c["len_m"])
            if pick is None:
                pick = min(avail, key=lambda c: (self._cost(c, lam, l_min), c["len_m"]))
            chosen.append((lam, pick))

        # Never return fewer than MIN_ROUTES when that many valid candidates exist.
        want = MIN_ROUTES if data_ok else MAX_ROUTES
        if len(chosen) < want:
            rest = sorted((c for c in pool if all(c is not t for t in taken())),
                          key=lambda c: (self._cost(c, 0.5, l_min), c["len_m"]))
            for strict in (True, False):
                for c in rest:
                    if len(chosen) >= want:
                        break
                    if all(c is not t for t in taken()) and (not strict or self._distinct(c, taken())):
                        chosen.append((0.5, c))
        chosen.sort(key=lambda lc: lc[0])
        return [c for _, c in chosen]

    # -----------------------------------------------------------------------
    # Risk factor extraction
    # -----------------------------------------------------------------------

    @staticmethod
    def _extract_risk_factors(incident_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Top-3 route-relevant incident categories by their share of the points lost."""
        by_category: Dict[str, Dict[str, Any]] = {}
        for inc in incident_list:
            if not inc.get("is_route_relevant"):
                continue
            name = inc.get("category_name", "Unknown")
            f = by_category.setdefault(
                name, {"icon": inc.get("category_icon", "📍"), "name": name, "count": 0, "total_penalty": 0.0})
            f["count"] += 1
            f["total_penalty"] += inc.get("penalty_impact", 0.0) or 0.0
        top = sorted(by_category.values(), key=lambda x: x["total_penalty"], reverse=True)
        for f in top:
            f["total_penalty"] = round(f["total_penalty"], 2)
        return top[:3]

    # -----------------------------------------------------------------------
    # Composite ranking (kept for API compatibility; drives recommended_route_idx)
    # -----------------------------------------------------------------------

    @staticmethod
    def _compute_composite(
        safety_score: float, distance_m: float, duration_s: float, max_dist: float, max_dur: float,
    ) -> float:
        """Balanced 0-100 score: safety 65 %, distance 20 %, duration 15 %."""
        norm_dist = (distance_m / max_dist) if max_dist > 0 else 0.0
        norm_dur = (duration_s / max_dur) if max_dur > 0 else 0.0
        composite = safety_score * 0.65 + (1.0 - norm_dist) * 100.0 * 0.20 + (1.0 - norm_dur) * 100.0 * 0.15
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
        Return 3-5 distinct routes (fewer only if fewer valid distinct routes exist), ordered from
        safety-first (Route 1) to distance-first (last), each with distance, ETA, incidents within
        500 m, weighted risk, safety score and detour ratio.
        """
        if not (valid_latlng(start_lat, start_lng) and valid_latlng(dest_lat, dest_lng)):
            return {"error": "Invalid start or destination coordinates."}
        slat, slng, dlat, dlng = float(start_lat), float(start_lng), float(dest_lat), float(dest_lng)
        trip_m = haversine_m(slat, slng, dlat, dlng)
        s, d = (slat, slng), (dlat, dlng)

        # ── Incidents: one query, validated + projected once ─────────────
        data_ok = True
        records: List[IncidentRecord] = []
        try:
            records = await self.safety_service.fetch_records_near_path(
                [s, d], min(25_000.0, CORRIDOR_BASE_M + 0.25 * trip_m))
        except Exception as exc:
            data_ok = False
            log.warning("get_safe_route: incident query failed (%s); routes returned without safety data", exc)
        proj = Projection((slat + dlat) / 2.0, (slng + dlng) / 2.0)
        project_records(records, proj)

        # ── Candidates from OSRM ──────────────────────────────────────────
        timeout = httpx.Timeout(OSRM_TIMEOUT_S)
        async with httpx.AsyncClient(timeout=timeout, limits=httpx.Limits(max_connections=OSRM_CONCURRENCY)) as client:
            raw = await self._collect_candidates(client, slat, slng, dlat, dlng, short_trip=trip_m < 50.0)
            prepared: List[Dict[str, Any]] = []
            seen_geo: Set[str] = set()

            def add(raws: List[Dict[str, Any]]) -> None:
                for r in raws:
                    if r.get("geometry") in seen_geo:
                        continue
                    seen_geo.add(r.get("geometry"))
                    c = self._prepare_candidate(r, proj, records)
                    if c:
                        prepared.append(c)

            add(raw)
            if not prepared:
                return {"error": "No routes could be obtained from the routing service."}

            # Incident-aware round, only if no reasonably short route is clear of route-relevant incidents.
            l_short = min(c["len_m"] for c in prepared)
            has_clean = any(c["relevant"] == 0 and c["len_m"] <= CLEAN_DETOUR_CAP * l_short for c in prepared)
            if data_ok and not has_clean and any(r.relevant for r in records):
                shortest = min(prepared, key=lambda c: c["len_m"])
                safest = min(prepared, key=lambda c: (c["risk_index"], c["len_m"]))
                refs = [shortest] if safest is shortest else [shortest, safest]
                jobs = self._avoidance_jobs(refs, proj, s, d)
                if jobs:
                    add(await self._osrm_batch(client, jobs))

        # ── Deduplicate, bound detours, select ───────────────────────────
        unique = self._deduplicate(prepared)
        if not unique:
            return {"error": "No valid routes could be generated."}
        l_min = min(c["len_m"] for c in unique)
        for c in unique:
            c["ratio"] = c["len_m"] / max(l_min, 1.0)
        pool = [c for c in unique if c["ratio"] <= MAX_DETOUR_RATIO]
        if len(pool) < min(MIN_ROUTES, len(unique)):
            pool = sorted(unique, key=lambda c: c["ratio"])[:MIN_ROUTES]
        selected = self._select_routes(pool, data_ok)

        # ── Format ─────────────────────────────────────────────────────────
        processed: List[Dict[str, Any]] = []
        for c in selected:
            summary = summarize_exposure(c["ev"], INCIDENTS_PER_ROUTE_PAYLOAD)
            if data_ok:
                score, level, expl = summary["score"], summary["risk_level"], summary["explanation"]
            else:
                score, level, expl = 50.0, "moderate", "Safety scoring unavailable for this route."
            relevant = summary["relevant_incident_count"] if data_ok else 0
            processed.append({
                "label": c["label"],
                "geometry": c["geometry"],
                "distance_m": round(c["len_m"], 1),
                "duration_s": round(c["dur_s"], 1),
                "eta_minutes": round(c["dur_s"] / 60.0, 1),
                "safety_score": score,
                "route_risk_level": level,
                "relevant_incident_count": relevant,
                "incidents_within_500m": relevant,
                # True when no route-relevant incident lies within 500 m of any point of the route.
                "incident_free": data_ok and relevant == 0,
                "risk_index": summary["risk_index"],
                "detour_ratio": round(c["ratio"], 3),
                "explanation": expl,
                "incidents": summary["incidents"] if data_ok else [],
                "risk_factors": self._extract_risk_factors(summary["incidents_all"]) if data_ok else [],
                "composite_score": 0.0,
            })

        max_dist = max(r["distance_m"] for r in processed) or 1.0
        max_dur = max(r["duration_s"] for r in processed) or 1.0
        for r in processed:
            r["composite_score"] = self._compute_composite(
                r["safety_score"], r["distance_m"], r["duration_s"], max_dist, max_dur)

        shortest_idx = min(range(len(processed)), key=lambda i: processed[i]["distance_m"])
        safest_idx = min(range(len(processed)),
                         key=lambda i: (processed[i]["risk_index"], processed[i]["distance_m"]))
        recommended_idx = max(range(len(processed)), key=lambda i: (processed[i]["composite_score"], -i))
        clean_idx = next((i for i, r in enumerate(processed) if r["incident_free"]), None)

        # Role-based labels: rank position gives the intent, the two extremes are named by fact.
        role_names = ["Safest", "Safer", "Balanced", "Shorter", "Shortest"]
        for i, r in enumerate(processed):
            r["route_rank"] = i + 1
            r["label"] = role_names[min(4, round(i * 4 / max(1, len(processed) - 1)))] if len(processed) > 1 else "Route"
            r["is_safest"] = i == safest_idx
            r["is_shortest"] = i == shortest_idx
        if data_ok:
            processed[safest_idx]["label"] = "Safest" if safest_idx != shortest_idx else "Safest & Shortest"
        if shortest_idx != safest_idx or not data_ok:
            processed[shortest_idx]["label"] = "Shortest"
        for i, r in enumerate(processed):
            if i not in (safest_idx, shortest_idx) and r["label"] in ("Safest", "Shortest"):
                r["label"] = "Balanced"

        n_relevant = sum(1 for r in records if r.relevant)
        note = None
        if len(processed) < MIN_ROUTES:
            note = "Fewer than 3 genuinely distinct valid routes exist for this trip."
        elif not data_ok:
            note = "Incident data unavailable; routes are not safety-ranked."
        log.info("get_safe_route: %d route(s) from %d candidates, clean_idx=%s, incidents=%d",
                 len(processed), len(prepared), clean_idx, len(records))

        return {
            "routes": processed,
            "recommended_route_idx": recommended_idx,
            "shortest_route_idx": shortest_idx,
            "safest_route_idx": safest_idx,
            "clean_route_idx": clean_idx,
            # Zones = route-relevant incidents loaded for the corridor; "filtered" = distinct candidates that
            # pass within 500 m of at least one of them; warning = full 500 m avoidance was not achievable.
            "avoidance_zone_count": n_relevant,
            "avoidance_filtered_count": sum(1 for c in unique if c["relevant"] > 0),
            "avoidance_warning": bool(data_ok and n_relevant > 0 and clean_idx is None),
            "safety_data_available": data_ok,
            "candidates_evaluated": len(prepared),
            "note": note,
        }
