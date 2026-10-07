from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, desc, distinct, or_
from sqlalchemy.orm import selectinload, joinedload
from geoalchemy2 import Geography
from app.models.incident import Incident, IncidentCategory, SeverityLevel, IncidentStatus
from datetime import datetime, timedelta, timezone
import logging
import math
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

# ==============================================================================
# CENTRALIZED CONFIGURATION FOR EXPLAINABLE SCORING
# ==============================================================================
#
# Scoring Logic:
# score = 100 * exp(-risk); risk aggregates per-incident hazard weights (see SHARED SAFETY MODEL below).
#
# Centralized Weighting System mapping Category -> Severity -> Base Impact Weight.
# Categories are grouped into tiers by safety impact.
# A Critical incident in "Violence & Assault" carries greater penalty weight than a Critical incident in "Illegal Parking".
#
CATEGORY_SEVERITY_WEIGHTS = {
    # Tier 1: Severe/Violent Crime & Critical Safety Threats (High safety impact)
    "crime": {SeverityLevel.LOW: 5.0, SeverityLevel.MEDIUM: 12.0, SeverityLevel.HIGH: 20.0, SeverityLevel.CRITICAL: 28.0},
    "assault_violence": {SeverityLevel.LOW: 6.0, SeverityLevel.MEDIUM: 14.0, SeverityLevel.HIGH: 22.0, SeverityLevel.CRITICAL: 30.0},
    "theft_robbery": {SeverityLevel.LOW: 5.0, SeverityLevel.MEDIUM: 12.0, SeverityLevel.HIGH: 20.0, SeverityLevel.CRITICAL: 28.0},
    "harassment": {SeverityLevel.LOW: 5.0, SeverityLevel.MEDIUM: 12.0, SeverityLevel.HIGH: 20.0, SeverityLevel.CRITICAL: 28.0},
    "missing_person": {SeverityLevel.LOW: 5.0, SeverityLevel.MEDIUM: 12.0, SeverityLevel.HIGH: 20.0, SeverityLevel.CRITICAL: 28.0},
    "gas_leak": {SeverityLevel.LOW: 6.0, SeverityLevel.MEDIUM: 14.0, SeverityLevel.HIGH: 24.0, SeverityLevel.CRITICAL: 32.0},
    "chemical_spill": {SeverityLevel.LOW: 6.0, SeverityLevel.MEDIUM: 14.0, SeverityLevel.HIGH: 24.0, SeverityLevel.CRITICAL: 32.0},
    "hazardous_material": {SeverityLevel.LOW: 5.0, SeverityLevel.MEDIUM: 12.0, SeverityLevel.HIGH: 20.0, SeverityLevel.CRITICAL: 28.0},
    "animal_bite": {SeverityLevel.LOW: 4.0, SeverityLevel.MEDIUM: 10.0, SeverityLevel.HIGH: 18.0, SeverityLevel.CRITICAL: 25.0},
    
    # Tier 2: Public Hazards & Road Travel safety
    "accident": {SeverityLevel.LOW: 4.0, SeverityLevel.MEDIUM: 10.0, SeverityLevel.HIGH: 18.0, SeverityLevel.CRITICAL: 25.0},
    "road_hazard": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 8.0, SeverityLevel.HIGH: 15.0, SeverityLevel.CRITICAL: 22.0},
    "drainage_flooding": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 8.0, SeverityLevel.HIGH: 15.0, SeverityLevel.CRITICAL: 22.0},
    "traffic_signal_malfunction": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 7.0, SeverityLevel.HIGH: 12.0, SeverityLevel.CRITICAL: 18.0},
    "electrical_outage": {SeverityLevel.LOW: 2.0, SeverityLevel.MEDIUM: 5.0, SeverityLevel.HIGH: 10.0, SeverityLevel.CRITICAL: 15.0},
    "poor_lighting": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 8.0, SeverityLevel.HIGH: 15.0, SeverityLevel.CRITICAL: 22.0},
    "unsafe_construction_site": {SeverityLevel.LOW: 4.0, SeverityLevel.MEDIUM: 9.0, SeverityLevel.HIGH: 16.0, SeverityLevel.CRITICAL: 22.0},
    "wildlife_incident": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 7.0, SeverityLevel.HIGH: 12.0, SeverityLevel.CRITICAL: 18.0},
    "animal_hazard": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 7.0, SeverityLevel.HIGH: 12.0, SeverityLevel.CRITICAL: 18.0},
    "tree_vegetation_hazard": {SeverityLevel.LOW: 2.0, SeverityLevel.MEDIUM: 5.0, SeverityLevel.HIGH: 10.0, SeverityLevel.CRITICAL: 15.0},
    "fallen_tree_branch": {SeverityLevel.LOW: 2.0, SeverityLevel.MEDIUM: 5.0, SeverityLevel.HIGH: 10.0, SeverityLevel.CRITICAL: 15.0},
    "traffic_violation": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 8.0, SeverityLevel.HIGH: 15.0, SeverityLevel.CRITICAL: 22.0},
    "pedestrian_safety": {SeverityLevel.LOW: 3.0, SeverityLevel.MEDIUM: 8.0, SeverityLevel.HIGH: 15.0, SeverityLevel.CRITICAL: 22.0},
    "blocked_footpath": {SeverityLevel.LOW: 2.0, SeverityLevel.MEDIUM: 5.0, SeverityLevel.HIGH: 10.0, SeverityLevel.CRITICAL: 14.0},
    # Route-relevant slugs that previously fell through to the generic default weights
    "construction_hazard": {SeverityLevel.LOW: 4.0, SeverityLevel.MEDIUM: 9.0, SeverityLevel.HIGH: 16.0, SeverityLevel.CRITICAL: 22.0},
    "suspicious_activity": {SeverityLevel.LOW: 2.0, SeverityLevel.MEDIUM: 5.0, SeverityLevel.HIGH: 10.0, SeverityLevel.CRITICAL: 15.0},
    "public_disturbance": {SeverityLevel.LOW: 2.0, SeverityLevel.MEDIUM: 5.0, SeverityLevel.HIGH: 10.0, SeverityLevel.CRITICAL: 15.0},
}

# Default severity fallback weights (Tier 3: Minor infrastructure & general municipal nuisances)
DEFAULT_SEVERITY_WEIGHTS = {
    SeverityLevel.LOW: 1.0,
    SeverityLevel.MEDIUM: 3.0,
    SeverityLevel.HIGH: 6.0,
    SeverityLevel.CRITICAL: 10.0
}

# Set of categories that are directly relevant to road, sidewalk, and route travel safety.
ROUTE_RELEVANT_CATEGORIES = {
    "accident",
    "road_hazard",
    "traffic_signal_malfunction",
    "poor_lighting",
    "pedestrian_safety",
    "blocked_footpath",
    "traffic_violation",
    "drainage_flooding",
    "gas_leak",
    "chemical_spill",
    "animal_bite",
    "animal_hazard",
    "construction_hazard",
    "unsafe_construction_site",
    "fallen_tree_branch",
    "tree_vegetation_hazard",
    "crime",
    "theft_robbery",
    "assault_violence",
    "harassment",
    "suspicious_activity",
    "public_disturbance",
}



# ==============================================================================
# SHARED SAFETY MODEL (used by both Area Safety Score and Route Safety Score)
# ==============================================================================
#
# Per-incident hazard weight (intrinsic, location independent):
#     w = base(category, severity) * recency * verification * resolved
#
#   recency      = FLOOR + (1 - FLOOR) * 0.5^(age / HALF_LIFE)      (smooth, in [0.15, 1])
#   verification = 1.0 verified (APPROVED/RESOLVED) | 0.2 unverified
#   resolved     = 0.5 if RESOLVED (hazard remediated, kept as historical evidence)
#
# Each incident becomes a dimensionless risk contribution  r = w * proximity / SCALE
# (SCALE differs for areas and routes, see below). Contributions are then
#   1. discounted geometrically inside a (category, ~55 m cell) cluster
#      (duplicates / pile-ups of reports at one spot cannot dominate: a cluster is
#      worth at most 2x its worst member),
#   2. soft-capped per category:  K_c * (1 - exp(-sum / K_c))  with K_c proportional
#      to the category's CRITICAL base weight (1000 minor reports cannot equal
#      violent crime; no single category can drive the score below 100*exp(-2)),
#   3. summed, and mapped to a score  score = 100 * exp(-risk)  -> bounded (0,100],
#      smooth, strictly monotone, no hard clipping, stable under small data changes.
#
# Area : risk = sum(w * kernel) / (S_AREA * area_km2) -> hazard-points per km²
#        (kernel has mean 1 over the disc, so it only re-weights, never inflates).
# Route: risk = sum(w * (1 - d/R)^2) / S_ROUTE      -> cumulative exposure along
#        the path (S_ROUTE = S_AREA * 0.5 km² reference corridor). Route risk is
#        deliberately NOT divided by route length: passing one critical incident is
#        the same exposure on a 5 km or a 15 km route.
# ==============================================================================

log = logging.getLogger(__name__)

S_AREA = 100.0                  # hazard-points / km² at which an area score is 100/e (~37)
MIN_AREA_KM2 = 0.5              # floor for area normalisation (tiny radii are too sparse to be a "density")
ROUTE_RADIUS_M = 500.0          # exposure window around a route
S_ROUTE = S_AREA * 0.5          # hazard-points of exposure at which a route score is 100/e
RECENCY_HALF_LIFE_DAYS = 60.0
RECENCY_FLOOR = 0.15            # very old incidents still carry chronic-hotspot evidence
DEFAULT_AGE_DAYS = 90.0         # used when no usable timestamp exists
UNVERIFIED_FACTOR = 0.2
RESOLVED_FACTOR = 0.5
CLUSTER_DECAY = 0.5
CLUSTER_CELL_DEG = 0.0005       # ~55 m
CATEGORY_RISK_CAP_MAX = 2.0
MAX_RECORDS = 20000             # hard ceiling on rows pulled per query
MAX_INCIDENTS_IN_PAYLOAD = 100
EARTH_RADIUS_M = 6_371_000.0

_SEVERITY_LOOKUP = {}
for _s in SeverityLevel:
    _SEVERITY_LOOKUP[str(_s.value).lower()] = _s
    _SEVERITY_LOOKUP[_s.name.lower()] = _s
_VERIFIED_STATUSES = {str(s.value).lower() for s in (IncidentStatus.APPROVED, IncidentStatus.RESOLVED)}
_RESOLVED_STATUS = str(IncidentStatus.RESOLVED.value).lower()
_MAX_CRIT = max(t[SeverityLevel.CRITICAL] for t in CATEGORY_SEVERITY_WEIGHTS.values())


def _num(v: Any, default: Optional[float] = None) -> Optional[float]:
    """float(v) if finite else default (never raises)."""
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return f if math.isfinite(f) else default


def valid_latlng(lat: Any, lng: Any) -> bool:
    la, lo = _num(lat), _num(lng)
    return la is not None and lo is not None and -90 <= la <= 90 and -180 <= lo <= 180


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(a)))


def coerce_severity(value: Any) -> SeverityLevel:
    if isinstance(value, SeverityLevel):
        return value
    return _SEVERITY_LOOKUP.get(str(getattr(value, "value", value)).strip().lower(), SeverityLevel.MEDIUM)


def base_weight(slug: str, severity: SeverityLevel) -> float:
    table = CATEGORY_SEVERITY_WEIGHTS.get(slug, DEFAULT_SEVERITY_WEIGHTS)
    return table.get(severity, DEFAULT_SEVERITY_WEIGHTS[severity])


def category_risk_cap(slug: str) -> float:
    crit = CATEGORY_SEVERITY_WEIGHTS.get(slug, DEFAULT_SEVERITY_WEIGHTS)[SeverityLevel.CRITICAL]
    return CATEGORY_RISK_CAP_MAX * crit / _MAX_CRIT


def recency_factor(age_days: float) -> float:
    return RECENCY_FLOOR + (1.0 - RECENCY_FLOOR) * 0.5 ** (max(0.0, age_days) / RECENCY_HALF_LIFE_DAYS)


def risk_level_for(score: float) -> str:
    return "unsafe" if score < 40 else "moderate" if score < 75 else "safe"


def score_from_risk(risk: float) -> float:
    r = _num(risk, 0.0)
    return max(0.0, min(100.0, 100.0 * math.exp(-max(0.0, r))))


@dataclass
class IncidentRecord:
    """Validated, pre-weighted incident (built once, reused for every route/area)."""
    id: str
    title: str
    description: str
    lat: float
    lng: float
    slug: str
    cat_name: str
    cat_icon: str
    severity: str
    hazard_w: float
    verified: bool
    age_days: float
    relevant: bool
    cell: Tuple[int, int]
    x: float = 0.0
    y: float = 0.0


def build_incident_record(inc: Any, now: datetime) -> Optional[IncidentRecord]:
    """Convert an ORM incident to a record; None if coordinates are unusable."""
    lat, lng = _num(getattr(inc, "location_lat", None)), _num(getattr(inc, "location_lng", None))
    if lat is None or lng is None or not valid_latlng(lat, lng) or (lat == 0 and lng == 0):
        return None
    sev = coerce_severity(getattr(inc, "severity", None))
    cat = getattr(inc, "category", None)
    slug = str(getattr(cat, "slug", None) or "unknown").strip().lower()

    status = str(getattr(getattr(inc, "status", None), "value", getattr(inc, "status", None))).lower()
    verified = status in _VERIFIED_STATUSES
    ver_f = 1.0 if verified else UNVERIFIED_FACTOR
    if status == _RESOLVED_STATUS:
        ver_f *= RESOLVED_FACTOR

    created = getattr(inc, "created_at", None) or getattr(inc, "updated_at", None)
    age = DEFAULT_AGE_DAYS
    if isinstance(created, datetime):
        if created.tzinfo is None:
            created = created.replace(tzinfo=timezone.utc)
        age = max(0.0, (now - created).total_seconds() / 86400.0)

    return IncidentRecord(
        id=str(getattr(inc, "id", "")),
        title=str(getattr(inc, "title", None) or ""),
        description=str(getattr(inc, "description", None) or ""),
        lat=lat, lng=lng, slug=slug,
        cat_name=getattr(cat, "name", None) or "Unknown",
        cat_icon=getattr(cat, "icon", None) or "📍",
        severity=sev.value,
        hazard_w=base_weight(slug, sev) * recency_factor(age) * ver_f,
        verified=verified, age_days=age, relevant=slug in ROUTE_RELEVANT_CATEGORIES,
        cell=(math.floor(lat / CLUSTER_CELL_DEG), math.floor(lng / CLUSTER_CELL_DEG)),
    )


def aggregate_risk(items: Sequence[Tuple[str, Tuple[int, int], float]]) -> Tuple[float, List[float], Dict[str, float]]:
    """
    items: (category_slug, cluster_cell, risk_contribution).
    Returns (total_risk, effective contribution per item, per-category risk).
    Applies cluster discounting then per-category soft saturation (see header).
    """
    eff = [0.0] * len(items)
    clusters: Dict[Tuple[str, Tuple[int, int]], List[Tuple[float, int]]] = defaultdict(list)
    for i, (slug, cell, r) in enumerate(items):
        if r > 0 and math.isfinite(r):
            clusters[(slug, cell)].append((-r, i))
    raw_cat: Dict[str, float] = defaultdict(float)
    for (slug, _), members in clusters.items():
        members.sort()
        for rank, (neg_r, i) in enumerate(members):
            eff[i] = -neg_r * CLUSTER_DECAY ** rank
            raw_cat[slug] += eff[i]
    per_cat: Dict[str, float] = {}
    for slug, raw in raw_cat.items():
        k = category_risk_cap(slug)
        per_cat[slug] = k * -math.expm1(-raw / k)
    for i, (slug, _, _) in enumerate(items):
        if eff[i] > 0:
            eff[i] *= per_cat[slug] / raw_cat[slug]
    return sum(per_cat.values()), eff, per_cat


# ------------------------------------------------------------------------------
# Geometry (local equirectangular metres + uniform grid; no extra dependencies)
# ------------------------------------------------------------------------------

class Projection:
    """Equirectangular projection around (lat0, lng0); <0.5% scale error at city/regional scale."""

    def __init__(self, lat0: float, lng0: float):
        self.lat0, self.lng0 = lat0, lng0
        self.ky = math.radians(1.0) * EARTH_RADIUS_M
        self.kx = self.ky * max(0.01, math.cos(math.radians(lat0)))

    def xy(self, lat: float, lng: float) -> Tuple[float, float]:
        return (lng - self.lng0) * self.kx, (lat - self.lat0) * self.ky

    def latlng(self, x: float, y: float) -> Tuple[float, float]:
        return self.lat0 + y / self.ky, self.lng0 + x / self.kx


def clean_points(pts: Iterable[Any]) -> List[Tuple[float, float]]:
    """Drop invalid / non-finite points and consecutive duplicates."""
    out: List[Tuple[float, float]] = []
    for p in pts or []:
        try:
            lat, lng = float(p[0]), float(p[1])
        except (TypeError, ValueError, IndexError):
            continue
        if not valid_latlng(lat, lng):
            continue
        if not out or (lat, lng) != out[-1]:
            out.append((lat, lng))
    return out


def thin_points(pts: List[Tuple[float, float]], spacing_m: float) -> List[Tuple[float, float]]:
    """Keep a point only if >= spacing_m from the last kept one (used to bound SQL WKT size)."""
    if len(pts) <= 2:
        return pts
    out = [pts[0]]
    for p in pts[1:-1]:
        if haversine_m(out[-1][0], out[-1][1], p[0], p[1]) >= spacing_m:
            out.append(p)
    out.append(pts[-1])
    return out


def densify(xy: List[Tuple[float, float]], max_step: float) -> List[Tuple[float, float]]:
    """Insert points so no segment is longer than max_step."""
    out = [xy[0]]
    for (x0, y0), (x1, y1) in zip(xy, xy[1:]):
        n = int(math.hypot(x1 - x0, y1 - y0) // max_step)
        for k in range(1, n + 1):
            t = k / (n + 1)
            out.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
        out.append((x1, y1))
    return out


def _pt_seg_dist(px: float, py: float, x0: float, y0: float, x1: float, y1: float) -> float:
    dx, dy = x1 - x0, y1 - y0
    l2 = dx * dx + dy * dy
    if l2 <= 1e-9:
        return math.hypot(px - x0, py - y0)
    t = max(0.0, min(1.0, ((px - x0) * dx + (py - y0) * dy) / l2))
    return math.hypot(px - x0 - t * dx, py - y0 - t * dy)


class SegmentIndex:
    """Uniform grid over polyline segments (segments must be <= cell long, see densify)."""

    def __init__(self, xy: List[Tuple[float, float]], cell: float):
        self.xy, self.cell = xy, cell
        self.grid: Dict[Tuple[int, int], List[int]] = defaultdict(list)
        for i in range(len(xy) - 1):
            (x0, y0), (x1, y1) = xy[i], xy[i + 1]
            for cx in range(math.floor(min(x0, x1) / cell), math.floor(max(x0, x1) / cell) + 1):
                for cy in range(math.floor(min(y0, y1) / cell), math.floor(max(y0, y1) / cell) + 1):
                    self.grid[(cx, cy)].append(i)

    def nearest(self, x: float, y: float, limit: float) -> Optional[Tuple[float, int]]:
        cx, cy = math.floor(x / self.cell), math.floor(y / self.cell)
        best: Optional[Tuple[float, int]] = None
        seen = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for i in self.grid.get((cx + dx, cy + dy), ()):
                    if i in seen:
                        continue
                    seen.add(i)
                    (x0, y0), (x1, y1) = self.xy[i], self.xy[i + 1]
                    d = _pt_seg_dist(x, y, x0, y0, x1, y1)
                    if d <= limit and (best is None or d < best[0]):
                        best = (d, i)
        return best


def project_records(records: List[IncidentRecord], proj: Projection) -> None:
    for r in records:
        r.x, r.y = proj.xy(r.lat, r.lng)


def evaluate_route_exposure(
    dense_xy: List[Tuple[float, float]],
    records: List[IncidentRecord],
    radius_m: float = ROUTE_RADIUS_M,
    s_route: float = S_ROUTE,
) -> Dict[str, Any]:
    """
    Route exposure for a densified, projected polyline against projected records.
    O(route points + incidents) thanks to the segment grid.
    """
    if len(dense_xy) < 2:
        return {"risk_index": 0.0, "score": 100.0, "exposed": [], "relevant_count": 0,
                "all_count": 0, "per_cat": {}, "radius_m": radius_m}
    xs, ys = [p[0] for p in dense_xy], [p[1] for p in dense_xy]
    x_lo, x_hi, y_lo, y_hi = min(xs) - radius_m, max(xs) + radius_m, min(ys) - radius_m, max(ys) + radius_m
    index = SegmentIndex(dense_xy, radius_m)
    exposed: List[Tuple[IncidentRecord, float, int]] = []
    for rec in records:
        if not (x_lo <= rec.x <= x_hi and y_lo <= rec.y <= y_hi):
            continue
        hit = index.nearest(rec.x, rec.y, radius_m)
        if hit:
            exposed.append((rec, hit[0], hit[1]))
    items = [
        (rec.slug, rec.cell, rec.hazard_w * (1.0 - d / radius_m) ** 2 / s_route if rec.relevant else 0.0)
        for rec, d, _ in exposed
    ]
    total, eff, per_cat = aggregate_risk(items)
    return {
        "risk_index": total,
        "score": score_from_risk(total),
        "exposed": [(rec, d, seg, e) for (rec, d, seg), e in zip(exposed, eff)],
        "relevant_count": sum(1 for rec, _, _ in exposed if rec.relevant),
        "all_count": len(exposed),
        "per_cat": per_cat,
        "radius_m": radius_m,
    }


def summarize_exposure(ev: Dict[str, Any], incident_limit: int = MAX_INCIDENTS_IN_PAYLOAD) -> Dict[str, Any]:
    """Turn an exposure evaluation into the API payload (incidents, explanation, risk level)."""
    score = round(ev["score"], 1)
    risk = ev["risk_index"]
    lost = 100.0 - ev["score"]
    radius_m = int(ev["radius_m"])
    incidents = []
    for rec, d, _seg, e in sorted(ev["exposed"], key=lambda t: (-t[3], t[1])):
        incidents.append({
            "id": rec.id, "title": rec.title, "description": rec.description,
            "severity": rec.severity, "lat": rec.lat, "lng": rec.lng,
            "category_icon": rec.cat_icon, "category_name": rec.cat_name,
            "distance_meters": round(d, 1), "is_verified": rec.verified,
            "is_route_relevant": rec.relevant,
            # Share of the points lost (100 - score) attributable to this incident.
            "penalty_impact": round(lost * e / risk, 2) if risk > 0 else 0.0,
        })
    rel, total = ev["relevant_count"], ev["all_count"]
    if total == 0:
        explanation = f"No incidents reported within {radius_m} m of this route."
    else:
        parts = [f"Route Safety Score of {score} from {total} nearby incident(s) (within {radius_m} m)."]
        if rel:
            unver = sum(1 for r, _, _, _ in ev["exposed"] if r.relevant and not r.verified)
            parts.append(f"{rel} route-relevant hazard(s) counted, weighted by severity, recency, "
                         f"verification and distance; repeated reports at one spot count with diminishing weight.")
            if unver:
                parts.append(f"{unver} unverified report(s) contribute at {int(UNVERIFIED_FACTOR * 100)}% weight.")
        if total - rel:
            parts.append(f"{total - rel} non-route-relevant incident(s) ignored.")
        explanation = " ".join(parts)
    return {"score": score, "risk_level": risk_level_for(score), "incidents_all": incidents,
            "incidents": incidents[:incident_limit], "explanation": explanation,
            "relevant_incident_count": rel, "incident_count_in_radius": total, "risk_index": round(risk, 4)}


def area_risk(inside: Sequence[Tuple[IncidentRecord, float]], area_km2: float) -> float:
    """
    Area risk for incidents inside a disc. `inside` = (record, u) with u = d/radius in [0, 1].
    Single source of truth for both the Area Safety Score and the map risk grid, so the
    colour on the map is the same number the area panel shows.
    kernel = (1 - 0.5 u^2) / 0.75 : centre-weighted, mean 1 over the disc.
    """
    norm = S_AREA * max(area_km2, MIN_AREA_KM2)
    items = [(r.slug, r.cell, r.hazard_w * ((1.0 - 0.5 * u * u) / 0.75) / norm) for r, u in inside]
    return aggregate_risk(items)[0]


_GRID_CACHE: Dict[Tuple[int, float], Tuple[float, Dict[str, Any]]] = {}
GRID_CACHE_TTL_S = 120.0


class SafetyScoreService:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ------------------------------------------------------------------
    # Data access: ONE query per request, converted to light records.
    # ------------------------------------------------------------------
    async def _fetch_records(self, geog, dist_m: Optional[float], now: datetime) -> List[IncidentRecord]:
        """Non-rejected incidents within dist_m of geog (geog=None: all incidents)."""
        conditions = [
            or_(Incident.status.is_(None), Incident.status != IncidentStatus.REJECTED),
            Incident.deleted_at.is_(None),
        ]
        if geog is not None:
            conditions.insert(0, func.ST_DWithin(Incident.location_geom, geog, dist_m))
        query = (
            select(Incident)
            .options(joinedload(Incident.category))
            .where(*conditions)
            .order_by(desc(Incident.created_at))
            .limit(MAX_RECORDS)
        )
        rows = (await self.db.execute(query)).unique().scalars().all()
        if len(rows) >= MAX_RECORDS:
            log.warning("safety: incident query hit MAX_RECORDS=%d; oldest incidents omitted", MAX_RECORDS)
        records, seen = [], set()
        for inc in rows:
            try:
                rec = build_incident_record(inc, now)
            except Exception as exc:  # malformed row must never break scoring
                log.warning("safety: skipping malformed incident (%s)", exc)
                continue
            if rec is None or (rec.id and rec.id in seen):
                continue
            seen.add(rec.id)
            records.append(rec)
        return records

    async def fetch_records_near_path(
        self, points: List[Tuple[float, float]], dist_m: float, now: Optional[datetime] = None
    ) -> List[IncidentRecord]:
        """Incidents within dist_m of a lat/lng point or polyline (single DB query)."""
        now = now or datetime.now(timezone.utc)
        pts = clean_points(points)
        if not pts:
            return []
        if len(pts) == 1:
            geom = func.ST_MakePoint(pts[0][1], pts[0][0])
        else:
            wkt = "LINESTRING(" + ",".join(f"{lng:.6f} {lat:.6f}" for lat, lng in pts) + ")"
            geom = func.ST_GeomFromText(wkt)
        geog = func.ST_SetSRID(geom, 4326).cast(Geography(srid=4326))
        return await self._fetch_records(geog, dist_m, now)

    # ------------------------------------------------------------------
    # Area score
    # ------------------------------------------------------------------
    async def calculate_area_score(self, lat: float, lng: float, radius_km: float = 1.0) -> dict:
        """
        Calculates a safety score (0-100) for a given area (delegates to refined detailed scoring).
        """
        res = await self.calculate_area_score_detailed(lat, lng, radius_km)
        counts = res.get("severity_counts", {})
        return {
            "score": res["score"],
            "risk_level": res["risk_level"],
            "incident_breakdown": {s.value: counts.get(s.value, 0) for s in
                                   (SeverityLevel.CRITICAL, SeverityLevel.HIGH, SeverityLevel.MEDIUM, SeverityLevel.LOW)},
        }

    async def calculate_route_safety(self, encoded_polyline: str, radius_km: float = ROUTE_RADIUS_M / 1000.0) -> dict:
        """
        Route safety from cumulative exposure to route-relevant incidents within the radius
        (default 500 m). Same incident weights as the area score; see shared-model header.
        """
        import polyline

        radius_m = min(2000.0, max(50.0, (_num(radius_km, ROUTE_RADIUS_M / 1000.0) or 0.5) * 1000.0))
        try:
            pts = clean_points(polyline.decode(encoded_polyline))
        except Exception:
            return {"score": 50.0, "risk_level": "moderate", "relevant_incident_count": 0, "incidents": [],
                    "explanation": "Route geometry could not be decoded; safety not evaluated."}
        if len(pts) < 2:
            return {"score": 100.0, "risk_level": "safe", "relevant_incident_count": 0, "incidents": [],
                    "explanation": "No waypoints provided for route safety calculation."}

        total_len = sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(pts, pts[1:]))
        spacing = max(30.0, total_len / 1500.0)           # bound WKT size (<= ~1500 vertices)
        now = datetime.now(timezone.utc)
        records = await self.fetch_records_near_path(thin_points(pts, spacing), radius_m + spacing, now)

        proj = Projection(sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
        project_records(records, proj)
        dense = densify([proj.xy(*p) for p in pts], radius_m)
        summary = summarize_exposure(evaluate_route_exposure(dense, records, radius_m))
        summary.pop("incidents_all", None)
        return summary

    # ------------------------------------------------------------------
    # Risk grid for the map overlay
    # ------------------------------------------------------------------
    async def get_risk_grid(self, cell_m: float = 250.0, radius_km: float = 1.0, max_cells: int = 6000) -> dict:
        """
        Area Safety Score sampled on a regular grid covering every incident (+ one radius of margin).
        Each cell value is exactly what calculate_area_score_detailed returns for the cell centre
        (same weights, kernel, clustering and category caps). One DB query; incidents are bucketed so
        each cell only looks at its 3x3 neighbouring buckets. Cached for GRID_CACHE_TTL_S seconds.
        Returns row-major scores (row 0 = north edge), counts of incidents inside each cell's radius,
        and image bounds [[south, west], [north, east]].
        """
        cell_m = min(2000.0, max(100.0, _num(cell_m, 250.0) or 250.0))
        radius_km = min(5.0, max(0.25, _num(radius_km, 1.0) or 1.0))
        key = (int(round(cell_m)), round(radius_km, 2))
        hit = _GRID_CACHE.get(key)
        if hit and time.monotonic() - hit[0] < GRID_CACHE_TTL_S:
            return hit[1]

        empty = {"bounds": None, "rows": 0, "cols": 0, "cell_m": cell_m, "radius_km": radius_km,
                 "scores": [], "counts": []}
        records = await self._fetch_records(None, None, datetime.now(timezone.utc))
        if not records:
            return empty

        proj = Projection(sum(r.lat for r in records) / len(records), sum(r.lng for r in records) / len(records))
        project_records(records, proj)
        radius_m = radius_km * 1000.0
        x_lo, x_hi = min(r.x for r in records) - radius_m, max(r.x for r in records) + radius_m
        y_lo, y_hi = min(r.y for r in records) - radius_m, max(r.y for r in records) + radius_m
        cols, rows = max(1, math.ceil((x_hi - x_lo) / cell_m)), max(1, math.ceil((y_hi - y_lo) / cell_m))
        if cols * rows > max_cells:                      # coarsen instead of exploding the payload
            cell_m *= math.sqrt(cols * rows / max_cells)
            cols, rows = max(1, math.ceil((x_hi - x_lo) / cell_m)), max(1, math.ceil((y_hi - y_lo) / cell_m))

        buckets: Dict[Tuple[int, int], List[IncidentRecord]] = defaultdict(list)
        for r in records:
            buckets[(math.floor(r.x / radius_m), math.floor(r.y / radius_m))].append(r)

        area_km2 = math.pi * radius_km ** 2
        scores: List[int] = []
        counts: List[int] = []
        for row in range(rows):
            y = y_hi - (row + 0.5) * cell_m
            by = math.floor(y / radius_m)
            for col in range(cols):
                x = x_lo + (col + 0.5) * cell_m
                bx = math.floor(x / radius_m)
                inside = []
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        for rec in buckets.get((bx + dx, by + dy), ()):
                            d = math.hypot(rec.x - x, rec.y - y)
                            if d <= radius_m:
                                inside.append((rec, d / radius_m))
                if not inside:
                    scores.append(100)
                    counts.append(0)
                else:
                    scores.append(int(round(score_from_risk(area_risk(inside, area_km2)))))
                    counts.append(len(inside))

        y_bottom = y_hi - rows * cell_m
        south, west = proj.latlng(x_lo, y_bottom)
        north, east = proj.latlng(x_lo + cols * cell_m, y_hi)
        result = {"bounds": [[south, west], [north, east]], "rows": rows, "cols": cols, "cell_m": round(cell_m, 1),
                  "radius_km": radius_km, "scores": scores, "counts": counts}
        _GRID_CACHE[key] = (time.monotonic(), result)
        return result

    # ------------------------------------------------------------------
    # Detailed area score
    # ------------------------------------------------------------------
    async def calculate_area_score_detailed(self, lat: float, lng: float, radius_km: float = 1.0) -> dict:
        """
        Area safety score:
          risk  = sum(w_i * kernel_i) / (S_AREA * area_km2)   (per-km² hazard load, population-free)
          score = 100 * exp(-risk), after cluster discounting and per-category soft caps.
        kernel = (1 - 0.5 (d/r)^2) / 0.75 : centre-weighted, mean 1 over the disc.
        Returns score 0-100, risk level, count, density, top categories and diagnostics.
        """
        if not valid_latlng(lat, lng):
            return {"score": 50.0, "risk_level": "moderate", "incident_count": 0, "density_per_km2": 0.0,
                    "top_categories": [], "recent_7d": 0, "recent_30d": 0, "severity_counts": {},
                    "confidence": "none", "risk_index": 0.0,
                    "explanation": "Invalid coordinates; no safety score could be computed."}
        lat, lng = float(lat), float(lng)
        radius_km = min(50.0, max(0.05, _num(radius_km, 1.0) or 1.0))
        radius_m = radius_km * 1000.0
        now = datetime.now(timezone.utc)

        records = await self.fetch_records_near_path([(lat, lng)], radius_m, now)
        inside = []
        for rec in records:
            d = haversine_m(lat, lng, rec.lat, rec.lng)
            if d <= radius_m * 1.001:
                inside.append((rec, min(1.0, d / radius_m)))

        area_km2 = math.pi * radius_km ** 2
        base = {"incident_count": 0, "density_per_km2": 0.0, "top_categories": [], "recent_7d": 0,
                "recent_30d": 0, "severity_counts": {}, "risk_index": 0.0}
        if not inside:
            return {**base, "score": 100.0, "risk_level": "safe", "confidence": "low",
                    "explanation": "No incidents reported in the selection radius "
                                   "(absence of reports is not proof of safety)."}

        risk = area_risk(inside, area_km2)
        score = round(score_from_risk(risk), 1)

        cats: Dict[str, Dict[str, Any]] = {}
        sev_counts: Dict[str, int] = defaultdict(int)
        verified = recent_7d = recent_30d = 0
        evidence = 0.0                       # recency/verification-weighted report mass -> confidence
        for r, _ in inside:
            c = cats.setdefault(r.cat_name, {"name": r.cat_name, "icon": r.cat_icon, "count": 0})
            c["count"] += 1
            sev_counts[r.severity] += 1
            verified += r.verified
            recent_7d += r.age_days <= 7
            recent_30d += r.age_days <= 30
            evidence += recency_factor(r.age_days) * (1.0 if r.verified else UNVERIFIED_FACTOR)
        n = len(inside)
        confidence = "low" if evidence < 1.0 else "medium" if evidence < 5.0 else "high"
        density = n / area_km2
        top_categories = sorted(cats.values(), key=lambda x: x["count"], reverse=True)[:5]

        parts = [f"Safety Score of {score} based on {n} incident(s) in a {round(radius_km, 2)}km radius "
                 f"(hazard load {round(risk * S_AREA, 1)} points/km²)."]
        parts.append(f"Includes {verified} verified and {n - verified} unverified community report(s) "
                     f"(unverified weighted at {int(UNVERIFIED_FACTOR * 100)}%).")
        if recent_7d:
            parts.append(f"{recent_7d} report(s) from the last 7 days.")
        if n >= 25:
            parts.append("Many reports: repeated reports at one spot and within one category count with diminishing weight.")
        if confidence == "low":
            parts.append("Limited recent/verified data; treat the score as indicative.")

        return {
            "score": score, "risk_level": risk_level_for(score), "incident_count": n,
            "density_per_km2": round(density, 2), "top_categories": top_categories,
            "recent_7d": recent_7d, "recent_30d": recent_30d, "severity_counts": dict(sev_counts),
            "confidence": confidence, "risk_index": round(risk, 4), "explanation": " ".join(parts),
        }

    async def get_city_overview(self, city_lat: float = 11.0168, city_lng: float = 76.9558, radius_km: float = 20.0) -> dict:
        """
        Returns a high-level city safety overview for the dashboard:
        - Overall city safety score
        - Total approved incident count
        - Highest-risk category
        - Recent 7-day incident list (last 10)
        """
        radius_m = radius_km * 1000
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)

        geo_point = func.ST_SetSRID(func.ST_MakePoint(city_lng, city_lat), 4326).cast(Geography(srid=4326))

        # Total approved incidents in city radius
        total_q = select(func.count(Incident.id)).where(
            func.ST_DWithin(Incident.location_geom, geo_point, radius_m),
            Incident.status == IncidentStatus.APPROVED,
            Incident.deleted_at.is_(None),
        )
        total_result = await self.db.execute(total_q)
        total_count = total_result.scalar() or 0

        # Category breakdown for highest risk category
        cat_q = select(
            IncidentCategory.name,
            IncidentCategory.icon,
            func.count(Incident.id).label("cnt")
        ).join(
            Incident, Incident.category_id == IncidentCategory.id
        ).where(
            func.ST_DWithin(Incident.location_geom, geo_point, radius_m),
            Incident.status == IncidentStatus.APPROVED,
            Incident.deleted_at.is_(None),
        ).group_by(IncidentCategory.name, IncidentCategory.icon).order_by(desc("cnt"))

        cat_result = await self.db.execute(cat_q)
        category_rows = cat_result.all()
        top_category = None
        all_categories = []
        for row in category_rows:
            all_categories.append({"name": row.name, "icon": row.icon, "count": row.cnt})
            if top_category is None:
                top_category = {"name": row.name, "icon": row.icon, "count": row.cnt}

        # Recent incidents (last 7 days, most severe first)
        recent_q = select(Incident).options(
            selectinload(Incident.category)
        ).where(
            func.ST_DWithin(Incident.location_geom, geo_point, radius_m),
            Incident.status == IncidentStatus.APPROVED,
            Incident.deleted_at.is_(None),
            Incident.created_at >= seven_days_ago,
        ).order_by(desc(Incident.created_at)).limit(10)

        recent_result = await self.db.execute(recent_q)
        recent_incidents = recent_result.scalars().all()

        recent_list = []
        for inc in recent_incidents:
            recent_list.append({
                "id": str(inc.id),
                "title": inc.title,
                "severity": coerce_severity(inc.severity).value,
                "category_name": inc.category.name if inc.category else "Unknown",
                "category_icon": inc.category.icon if inc.category else "📍",
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
                "lat": inc.location_lat,
                "lng": inc.location_lng,
            })

        # Calculate city-wide score (same method as detailed)
        score_data = await self.calculate_area_score_detailed(city_lat, city_lng, radius_km)

        return {
            "score": score_data["score"],
            "risk_level": score_data["risk_level"],
            "total_incident_count": total_count,
            "top_category": top_category,
            "all_categories": all_categories[:8],
            "recent_incidents": recent_list,
            "recent_7d_count": score_data["recent_7d"],
        }