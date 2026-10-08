"""
Route Service – OSRM candidate generation + SafeCity safety evaluation
======================================================================

OSRM/OSM = road network and route generation.  SafeCity = safety analysis.

Pipeline
--------
1. Incidents for the trip corridor are loaded ONCE (single DB query), validated,
   weighted and projected to local metres (shared model in safety_score_service).
2. Candidate routes (OSRM only, one shared HTTP client, bounded concurrency, deadlines):
     wave 1: direct request with alternatives=true, plus exclude=motorway / exclude=toll
     wave 2: * hazard-bypass via-points: route-relevant incidents are grouped into danger
               clusters; for the clusters near the direct route a via-point is placed on EACH
               side of the cluster (perpendicular to the trip axis, 500 m + margin clear of it),
               plus "all clusters, left" / "all clusters, right" combinations
             * a few generic perpendicular via-points (diversity when there is no hazard data)
3. Candidate hygiene (this is what removes the random "offshoots"):
     * a via-point that OSRM had to snap > MAX_VIA_SNAP_M to reach a road is discarded
       (it fell in a field / lake / block)
     * out-and-back spurs (route enters a side street and returns along the same road)
       are loop-erased from the geometry; length / ETA are recomputed
4. Every surviving candidate is evaluated once (geometry decoded once, spatial-grid distance
   to every incident): distance, ETA, incidents within 500 m, weighted risk, safety score,
   detour ratio, directness.  Near-identical routes (>= 90 % shared ~50 m road cells) are dropped.
5. Selection (after scoring, never "5 shortest then score"):
     * Route 1 = the safest candidate (lowest risk; near-ties -> shorter).  Distance does not
       matter, but spurs are gone and the detour cap (2x shortest) keeps it direct.
     * the shortest candidate is always included as the other anchor.
     * remaining slots: farthest-point sampling on the (safety score, length) plane over the
       Pareto-optimal candidates, so the routes DIFFER in safety (>= ~6 score points or ~6 %
       length apart).  3 routes minimum when 3 valid candidates exist, 5 maximum.
   Output is ordered safest -> least safe.
"""

import asyncio
import logging
import math
from collections import defaultdict
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
    _pt_seg_dist,
    clean_points,
    densify,
    evaluate_route_exposure,
    haversine_m,
    project_records,
    risk_level_for,
    score_from_risk,
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

VIA_SIDE_MAGNITUDE = 0.45
VIA_WIDE_MAGNITUDE = 0.85

AVOIDANCE_RADIUS_M: float = ROUTE_RADIUS_M      # 500 m
AVOID_VIA_MARGIN_M = 150.0                      # bypass via sits AVOIDANCE_RADIUS_M + margin clear of a cluster
BYPASS_CLUSTERS = 3                             # danger clusters considered per trip
BYPASS_MAX_RADIUS_M = 1200.0                    # cap on the cluster radius used for the via offset
BYPASS_CORRIDOR_M = 1500.0                      # clusters farther than this from the direct route are ignored
MAX_BYPASS_JOBS = 8
CORRIDOR_BASE_M = 6000.0                        # incident corridor around the trip (covers via detours)

MAX_VIA_SNAP_M = 250.0      # via-point that OSRM snapped farther than this was not on a usable road
BACKTRACK_TOL_M = 15.0      # two passes within this distance = "same road"
BACKTRACK_MIN_LOOP_M = 80.0 # ... if separated by at least this much driving (out-and-back of >= 40 m)

MAX_DETOUR_RATIO = 2.0      # candidates longer than this x shortest are dropped (unless needed for MIN_ROUTES)
CLEAN_DETOUR_CAP = 1.5      # a clean route longer than this x shortest does not suppress the bypass search
KAPPA = 3.0                 # ln(distance ratio) weight, only used to break ties between near-duplicates
SAFEST_TIE_RISK = 0.02      # risk differences below this are ties -> prefer the shorter route
TRADEOFF_SCORE_UNIT = 10.0  # 10 safety-score points  = 1 trade-off unit
TRADEOFF_LEN_UNIT = 0.10    # 10 % length difference  = 1 trade-off unit
MIN_TRADEOFF_DIST = 0.6     # routes closer than this to an already chosen one are "the same trade-off"

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
def strip_backtracks(
    xy: List[Tuple[float, float]],
    tol: float = BACKTRACK_TOL_M,
    min_loop: float = BACKTRACK_MIN_LOOP_M,
) -> Tuple[List[Tuple[float, float]], float]:
    """
    Loop-erase out-and-back spurs from a projected polyline.

    Walks the (densified) path; when a point lands within `tol` of an earlier point that is at
    least `min_loop` metres back along the path, everything in between is a spur / U-turn / loop
    and is dropped.  Single pass, O(n) with a spatial hash.  Returns (clean_xy, removed_length_m);
    the input is returned untouched when nothing was removed.
    """
    if len(xy) < 3:
        return xy, 0.0
    pts = densify(xy, tol)
    cell = tol
    out: List[Tuple[float, float]] = []
    cum: List[float] = []
    grid: Dict[Tuple[int, int], List[int]] = defaultdict(list)
    removed = 0.0

    def key(p: Tuple[float, float]) -> Tuple[int, int]:
        return math.floor(p[0] / cell), math.floor(p[1] / cell)

    for p in pts:
        k = key(p)
        hit: Optional[int] = None
        if out:
            here = cum[-1]
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    for j in grid.get((k[0] + dx, k[1] + dy), ()):
                        if here - cum[j] >= min_loop and math.hypot(p[0] - out[j][0], p[1] - out[j][1]) <= tol:
                            hit = j if hit is None else min(hit, j)
        if hit is not None:
            removed += cum[-1] - cum[hit]
            for n in range(len(out) - 1, hit, -1):
                grid[key(out[n])].remove(n)
            del out[hit + 1:]
            del cum[hit + 1:]
            continue                                   # p coincides with out[hit]
        cum.append(cum[-1] + math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) if out else 0.0)
        out.append(p)
        grid[k].append(len(out) - 1)

    if removed <= 0.0 or len(out) < 2:
        return xy, 0.0
    original = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(xy, xy[1:]))
    return out, max(0.0, original - cum[-1])             # exact: input length minus output length


def danger_clusters(records: List[IncidentRecord], cell_m: float = 500.0) -> List[Dict[str, float]]:
    """
    Group route-relevant incidents (already projected) into hazard clusters: 500 m grid cells,
    8-neighbour connected components.  Each cluster = hazard-weighted centroid, radius, total hazard.
    """
    cells: Dict[Tuple[int, int], List[IncidentRecord]] = defaultdict(list)
    for r in records:
        if r.relevant and r.hazard_w > 0:
            cells[(math.floor(r.x / cell_m), math.floor(r.y / cell_m))].append(r)
    seen: Set[Tuple[int, int]] = set()
    clusters: List[Dict[str, float]] = []
    for start in cells:
        if start in seen:
            continue
        seen.add(start)
        stack, members = [start], []
        while stack:
            k = stack.pop()
            members.extend(cells[k])
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nk = (k[0] + dx, k[1] + dy)
                    if nk in cells and nk not in seen:
                        seen.add(nk)
                        stack.append(nk)
        w = sum(m.hazard_w for m in members)
        cx = sum(m.x * m.hazard_w for m in members) / w
        cy = sum(m.y * m.hazard_w for m in members) / w
        clusters.append({"x": cx, "y": cy, "hazard": w, "n": float(len(members)),
                         "radius": max(math.hypot(m.x - cx, m.y - cy) for m in members)})
    return clusters





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
                    # snap distance (m) of every input waypoint: a large value = the point is not on a road
                    snaps = [w.get("distance") if isinstance(w, dict) else None for w in data.get("waypoints", [])]
                    return [{**r, "_snap": snaps} for r in routes if isinstance(r, dict)]
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
                        "label": job[0] if i == 0 else f"{job[0]} alt {i}", "snap": r.get("_snap") or [],
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
        """Wave 1: direct route with OSRM alternatives, plus motorway / toll exclusions."""
        s, d = (slat, slng), (dlat, dlng)
        jobs: List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]] = [
            ("Direct", [s, d], True, None, 1),
        ]
        if not short_trip:
            jobs += [("No-Motorway", [s, d], False, "motorway", 0), ("No-Toll", [s, d], False, "toll", 0)]
        return await self._osrm_batch(client, jobs)

    @staticmethod
    def _generic_via_jobs(
        s: Tuple[float, float], d: Tuple[float, float]
    ) -> List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]]:
        """A few perpendicular via-points for diversity (used even when there is no hazard data)."""
        jobs = []
        for fraction, mag, tag in ((0.33, VIA_SIDE_MAGNITUDE, ""), (0.67, VIA_SIDE_MAGNITUDE, ""),
                                   (0.50, VIA_WIDE_MAGNITUDE, "W")):
            for side, name in ((1.0, "N"), (-1.0, "S")):
                via = _offset_via_point(s[0], s[1], d[0], d[1], fraction, side, mag)
                jobs.append((f"Via-{name}{int(fraction * 100)}{tag}", [s, via, d], False, None, 0))
        return jobs

    @staticmethod
    def _nearby_clusters(
        clusters: List[Dict[str, float]], ref_dense: List[Tuple[float, float]]
    ) -> List[Dict[str, float]]:
        """Clusters within BYPASS_CORRIDOR_M of the reference route, most hazardous / closest first."""
        scored = []
        for c in clusters:
            dist = min(_pt_seg_dist(c["x"], c["y"], *ref_dense[i], *ref_dense[i + 1]) for i in range(len(ref_dense) - 1))
            if dist <= BYPASS_CORRIDOR_M:
                scored.append((c["hazard"] * math.exp(-dist / 1000.0), c))
        scored.sort(key=lambda t: -t[0])
        return [c for _, c in scored[:BYPASS_CLUSTERS]]

    def _bypass_jobs(
        self, clusters: List[Dict[str, float]], proj: Projection, s: Tuple[float, float], d: Tuple[float, float]
    ) -> List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]]:
        """
        Hazard-bypass via-points.  For each danger cluster near the direct route, one via on EACH side of
        the trip axis, AVOIDANCE_RADIUS_M + margin clear of the cluster (measured perpendicular to the overall
        origin->destination axis, so the detour stays a smooth, mostly straight trajectory).  Plus
        "all clusters on the left" / "all on the right" combinations ordered along the axis.
        """
        sx, sy = proj.xy(*s)
        ex, ey = proj.xy(*d)
        length = math.hypot(ex - sx, ey - sy)
        if length < 200.0 or not clusters:
            return []
        ax, ay = (ex - sx) / length, (ey - sy) / length
        nx, ny = -ay, ax
        per_side: Dict[float, List[Tuple[float, Tuple[float, float]]]] = {1.0: [], -1.0: []}
        jobs: List[Tuple[str, List[Tuple[float, float]], bool, Optional[str], int]] = []
        for i, c in enumerate(clusters):
            if (math.hypot(c["x"] - sx, c["y"] - sy) < AVOIDANCE_RADIUS_M
                    or math.hypot(c["x"] - ex, c["y"] - ey) < AVOIDANCE_RADIUS_M):
                continue                                    # origin / destination sits inside the cluster
            t = (c["x"] - sx) * ax + (c["y"] - sy) * ay     # position along the trip axis
            if not (0.02 * length <= t <= 0.98 * length):
                continue
            lateral = (c["x"] - sx) * nx + (c["y"] - sy) * ny
            off = min(c["radius"], BYPASS_MAX_RADIUS_M) + AVOIDANCE_RADIUS_M + AVOID_VIA_MARGIN_M
            for side, name in ((1.0, "L"), (-1.0, "R")):
                via = tuple(round(v, 6) for v in proj.latlng(
                    sx + ax * t + nx * (lateral + side * off), sy + ay * t + ny * (lateral + side * off)))
                if not valid_latlng(*via):
                    continue
                per_side[side].append((t, via))
                jobs.append((f"Bypass-{i + 1}{name}", [s, via, d], False, None, 0))
        for side, name in ((1.0, "L"), (-1.0, "R")):
            if len(per_side[side]) >= 2:
                jobs.append((f"Bypass-All-{name}", [s, *[v for _, v in sorted(per_side[side])], d], False, None, 0))
        return jobs[:MAX_BYPASS_JOBS]

    # -----------------------------------------------------------------------
    # Candidate preparation / deduplication / selection
    # -----------------------------------------------------------------------

    @staticmethod
    def _prepare_candidate(
        raw: Dict[str, Any], proj: Projection, records: List[IncidentRecord]
    ) -> Optional[Dict[str, Any]]:
        """
        Decode once, validate, clean and evaluate a raw OSRM route.  None if the geometry is unusable or a
        via-point could not be snapped to a road.  Out-and-back spurs are loop-erased (length / ETA recomputed).
        """
        geo = raw.get("geometry")
        if not isinstance(geo, str) or not geo:
            return None
        snaps = raw.get("snap") or []
        if any((d is not None and _num(d, 0.0) > MAX_VIA_SNAP_M) for d in snaps[1:-1]):
            return None                                     # via fell in a field / lake / block
        try:
            pts = clean_points(polyline_lib.decode(geo))
        except Exception:
            return None
        if len(pts) < 2:
            return None
        xy = [proj.xy(*p) for p in pts]
        raw_len = _path_length_m(pts)

        clean_xy, spur_m = strip_backtracks(xy)
        if spur_m > 0.0:
            xy = clean_xy
            pts = [proj.latlng(x, y) for x, y in xy]
            geo = polyline_lib.encode([(round(la, 6), round(lo, 6)) for la, lo in pts])

        calc = _path_length_m(pts)
        osrm_dist = _num(raw.get("distance"), 0.0) or 0.0
        length = calc if (calc > 10 or spur_m > 0.0) else osrm_dist
        if length <= 0:
            return None
        dur = _num(raw.get("duration"), 0.0) or 0.0
        if dur <= 0:
            dur = length / FALLBACK_SPEED_MPS
        elif spur_m > 0.0 and raw_len > 0:
            dur *= length / raw_len                          # ETA shrinks with the removed spur
        straight = haversine_m(pts[0][0], pts[0][1], pts[-1][0], pts[-1][1])
        dense = densify(xy, AVOIDANCE_RADIUS_M)
        ev = evaluate_route_exposure(dense, records, AVOIDANCE_RADIUS_M)
        return {
            "label": raw.get("label", "Route"), "geometry": geo, "distance": length, "duration": dur,
            "len_m": length, "dur_s": dur, "dense": dense, "cells": _cells_from_xy(xy), "ev": ev,
            "risk_index": ev["risk_index"], "relevant": ev["relevant_count"],
            "directness": min(1.0, straight / length) if length > 0 else 1.0,
            "spur_removed_m": round(spur_m, 1),
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
    def _tradeoff_distance(a: Dict[str, Any], b: Dict[str, Any]) -> float:
        """Distance on the (safety score, length) plane: 10 score points or 10 % length = 1 unit."""
        d_score = abs(score_from_risk(a["risk_index"]) - score_from_risk(b["risk_index"])) / TRADEOFF_SCORE_UNIT
        d_len = abs(math.log(max(a["len_m"], 1.0) / max(b["len_m"], 1.0))) / TRADEOFF_LEN_UNIT
        return math.hypot(d_score, d_len)

    def _select_routes(self, pool: List[Dict[str, Any]], data_ok: bool) -> List[Dict[str, Any]]:
        """
        Route 1 = safest candidate (lowest risk, near-ties -> shorter).  The shortest candidate is the other
        anchor.  Remaining slots go to the Pareto-optimal candidates farthest (in safety score / length) from
        everything already chosen, so the routes differ in safety.  MIN_ROUTES..MAX_ROUTES, ordered safest first.
        """
        min_risk = min(c["risk_index"] for c in pool)
        safest = min((c for c in pool if c["risk_index"] <= min_risk + SAFEST_TIE_RISK), key=lambda c: c["len_m"])
        fastest = min(pool, key=lambda c: (c["len_m"], c["risk_index"]))
        chosen = [safest] + ([fastest] if fastest is not safest else [])

        def gap(c: Dict[str, Any]) -> float:
            return min(self._tradeoff_distance(c, s) for s in chosen)

        front = self._pareto(pool)
        while len(chosen) < MAX_ROUTES:
            rest = [c for c in front if all(c is not s for s in chosen)]
            if not rest:
                break
            best = max(rest, key=gap)
            if gap(best) < MIN_TRADEOFF_DIST:
                break
            chosen.append(best)

        # Never fewer than MIN_ROUTES when that many valid candidates exist (all 5 slots if data is unavailable).
        want = MIN_ROUTES if data_ok else MAX_ROUTES
        # Padding picks the least-detour / lowest-risk leftovers (never the most exotic route).
        l_min = min(c["len_m"] for c in pool)
        rest = [c for c in pool if all(c is not s for s in chosen)]
        while rest and len(chosen) < want:
            best = min(rest, key=lambda c: (self._cost(c, 0.5, l_min), c["len_m"]))
            chosen.append(best)
            rest = [c for c in rest if c is not best]

        chosen.sort(key=lambda c: (c["risk_index"], c["len_m"]))
        return chosen

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

        # ── Candidates from OSRM (two waves) ──────────────────────────────
        timeout = httpx.Timeout(OSRM_TIMEOUT_S)
        async with httpx.AsyncClient(timeout=timeout, limits=httpx.Limits(max_connections=OSRM_CONCURRENCY)) as client:
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

            short_trip = trip_m < 50.0
            add(await self._collect_candidates(client, slat, slng, dlat, dlng, short_trip=short_trip))
            if not prepared:
                return {"error": "No routes could be obtained from the routing service."}

            if not short_trip:
                # Wave 2: hazard-bypass vias (only when no reasonably short route is already clear) + generic vias
                jobs = self._generic_via_jobs(s, d)
                l_short = min(c["len_m"] for c in prepared)
                has_clean = any(c["relevant"] == 0 and c["len_m"] <= CLEAN_DETOUR_CAP * l_short for c in prepared)
                if data_ok and not has_clean and any(r.relevant for r in records):
                    ref = min(prepared, key=lambda c: c["len_m"])
                    near = self._nearby_clusters(danger_clusters(records), ref["dense"])
                    jobs = self._bypass_jobs(near, proj, s, d) + jobs
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
                "directness": round(c["directness"], 3),
                "spur_removed_m": c["spur_removed_m"],
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

        # Labels: the two anchors are named by fact, the rest by where their safety lies between them.
        sc_safe = processed[safest_idx]["safety_score"]
        sc_short = processed[shortest_idx]["safety_score"]
        span = sc_safe - sc_short
        seen_labels: Dict[str, int] = {}
        for i, r in enumerate(processed):
            r["route_rank"] = i + 1
            r["is_safest"] = i == safest_idx
            r["is_shortest"] = i == shortest_idx
            if not data_ok:
                label = "Shortest" if i == shortest_idx else f"Route {i + 1}"
            elif i == safest_idx and i == shortest_idx:
                label = "Safest & Shortest"
            elif i == safest_idx:
                label = "Safest"
            elif i == shortest_idx:
                label = "Shortest"
            else:
                p = (r["safety_score"] - sc_short) / span if span > 1e-6 else 0.5
                label = "Safer" if p >= 0.66 else "Balanced" if p >= 0.33 else "Faster"
            seen_labels[label] = seen_labels.get(label, 0) + 1
            r["label"] = label if seen_labels[label] == 1 else f"{label} {seen_labels[label]}"

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