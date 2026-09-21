from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, desc, distinct
from sqlalchemy.orm import selectinload
from geoalchemy2 import Geography
from app.models.incident import Incident, IncidentCategory, SeverityLevel, IncidentStatus
from datetime import datetime, timedelta, timezone
import math

# ==============================================================================
# CENTRALIZED CONFIGURATION FOR EXPLAINABLE SCORING
# ==============================================================================
#
# Scoring Logic:
# 1. Start with 100.0 (maximum safety score).
# 2. Subtract safety penalties calculated per incident:
#    penalty = CategoryImpactWeight(Category, Severity) * ProximityFactor * RecencyFactor * VerificationFactor
# 3. Density Adjustments are applied to Area Safety Scores.
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


class SafetyScoreService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_area_score(self, lat: float, lng: float, radius_km: float = 1.0) -> dict:
        """
        Calculates a safety score (0-100) for a given area (delegates to refined detailed scoring).
        """
        res = await self.calculate_area_score_detailed(lat, lng, radius_km)
        return {
            "score": res["score"],
            "risk_level": res["risk_level"],
            "incident_breakdown": {
                SeverityLevel.CRITICAL.value: res.get("recent_7d", 0),
                SeverityLevel.HIGH.value: res.get("recent_30d", 0),
                SeverityLevel.MEDIUM.value: 0,
                SeverityLevel.LOW.value: 0
            }
        }

    async def calculate_route_safety(self, encoded_polyline: str, radius_km: float = 0.2) -> dict:
        """
        Calculates route safety score using PostGIS and the refined scoring algorithm.
        Considers category impact, severity, verification status, recency, distance decay, and route-relevance.
        """
        import polyline
        
        radius_m = radius_km * 1000
        waypoints = polyline.decode(encoded_polyline)
        
        if len(waypoints) < 2:
            return {
                "score": 100.0,
                "risk_level": "safe",
                "incidents": [],
                "explanation": "No waypoints provided for route safety calculation."
            }
            
        coord_strings = [f"{lng} {lat}" for lat, lng in waypoints]
        linestring_wkt = f"LINESTRING({','.join(coord_strings)})"
        
        route_geom = func.ST_SetSRID(func.ST_GeomFromText(linestring_wkt), 4326).cast(Geography(srid=4326))
        distance_col = func.ST_Distance(Incident.location_geom, route_geom).label("distance_m")
        
        # Fetch all incidents within the route buffer radius that are NOT rejected
        query = select(Incident, distance_col).options(
            selectinload(Incident.category)
        ).where(
            func.ST_DWithin(Incident.location_geom, route_geom, radius_m),
            Incident.status != IncidentStatus.REJECTED,
            Incident.deleted_at.is_(None)
        )
        
        result = await self.db.execute(query)
        rows = result.all()
        
        total_penalty = 0.0
        verified_count = 0
        unverified_count = 0
        relevant_count = 0
        non_relevant_count = 0
        recent_7d = 0
        incident_list = []
        
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        
        for incident, distance_m in rows:
            cat_slug = incident.category.slug if incident.category else "unknown"
            
            # 1. Base category severity impact weight
            cat_weights = CATEGORY_SEVERITY_WEIGHTS.get(cat_slug, DEFAULT_SEVERITY_WEIGHTS)
            base_w = cat_weights.get(incident.severity, DEFAULT_SEVERITY_WEIGHTS.get(incident.severity, 3.0))
            
            # 2. Distance decay multiplier: linear decay from 1.0 down to 0.1 at radius boundary
            distance_mult = max(0.1, 1.0 - (distance_m / radius_m))
            
            # 3. Recency decay multiplier
            created = incident.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            
            age_days = (now - created).days
            if age_days <= 7:
                recency_mult = 1.5
                recent_7d += 1
            elif age_days <= 30:
                recency_mult = 1.2
            elif age_days <= 90:
                recency_mult = 0.8
            else:
                recency_mult = 0.4
                
            # 4. Verification multiplier: Verified (APPROVED/RESOLVED) = 1.0, Unverified = 0.2
            if incident.status in (IncidentStatus.APPROVED, IncidentStatus.RESOLVED):
                verification_mult = 1.0
                verified_count += 1
            else:
                verification_mult = 0.2
                unverified_count += 1
                
            # 5. Route relevance factor
            if cat_slug in ROUTE_RELEVANT_CATEGORIES:
                relevance_mult = 1.0
                relevant_count += 1
            else:
                relevance_mult = 0.0
                non_relevant_count += 1
                
            # Calculate penalty contribution
            penalty = base_w * distance_mult * recency_mult * verification_mult * relevance_mult
            total_penalty += penalty
            
            incident_list.append({
                "id": str(incident.id),
                "title": incident.title,
                "description": incident.description,
                "severity": incident.severity.value,
                "lat": incident.location_lat,
                "lng": incident.location_lng,
                "category_icon": incident.category.icon if incident.category else "📍",
                "category_name": incident.category.name if incident.category else "Unknown",
                "distance_meters": round(distance_m, 1),
                "is_verified": incident.status in (IncidentStatus.APPROVED, IncidentStatus.RESOLVED),
                "is_route_relevant": cat_slug in ROUTE_RELEVANT_CATEGORIES,
                "penalty_impact": round(penalty, 2),
            })
            
        score = max(0.0, min(100.0, 100.0 - total_penalty))
        score = round(score, 1)
        
        risk_level = "safe"
        if score < 40:
            risk_level = "unsafe"
        elif score < 75:
            risk_level = "moderate"
            
        # Clear explainable reasoning
        explanation_parts = []
        if len(rows) == 0:
            explanation = "This route is completely safe with no incidents reported along the way."
        else:
            explanation_parts.append(
                f"Route Safety Score of {score} is calculated from {len(rows)} nearby incident(s) (within {int(radius_m)}m)."
            )
            if relevant_count > 0:
                explanation_parts.append(f"Considered {relevant_count} route-relevant safety hazard(s) (e.g. accidents, crime, poor lighting).")
            if non_relevant_count > 0:
                explanation_parts.append(f"Ignored {non_relevant_count} non-route-relevant incident(s) (e.g. lost & found) to avoid unnecessary route penalties.")
            if unverified_count > 0:
                explanation_parts.append(f"Unverified community reports ({unverified_count}) contributed with a lower weight (20%).")
            if recent_7d > 0:
                explanation_parts.append(f"Contains {recent_7d} report(s) within the last 7 days adding higher recency penalties.")
            explanation = " ".join(explanation_parts)
            
        return {
            "score": score,
            "risk_level": risk_level,
            "relevant_incident_count": relevant_count,
            "incidents": incident_list,
            "explanation": explanation
        }

    async def calculate_area_score_detailed(self, lat: float, lng: float, radius_km: float = 1.0) -> dict:
        """
        Detailed area safety score that considers:
        - Base Category impact & Category-specific severity
        - Verification status (verified 1.0 vs unverified 0.2)
        - Recency (0-7d 1.5x, 8-30d 1.2x, 31-90d 0.8x, 90d+ 0.4x)
        - Spatial proximity (decay factor based on distance from center)
        - Incident density per km²
        Returns score 0-100, risk level, count, density, and top categories.
        """
        radius_m = radius_km * 1000
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)
        
        geo_point = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326).cast(Geography(srid=4326))
        distance_col = func.ST_Distance(Incident.location_geom, geo_point).label("distance_m")
        
        # Query for all incidents within radius that are NOT rejected
        query = select(Incident, distance_col).options(
            selectinload(Incident.category)
        ).where(
            func.ST_DWithin(Incident.location_geom, geo_point, radius_m),
            Incident.status != IncidentStatus.REJECTED,
            Incident.deleted_at.is_(None)
        )
        
        result = await self.db.execute(query)
        rows = result.all()
        
        if not rows:
            return {
                "score": 100.0,
                "risk_level": "safe",
                "incident_count": 0,
                "density_per_km2": 0.0,
                "top_categories": [],
                "recent_7d": 0,
                "recent_30d": 0,
                "explanation": "No incidents reported in the selection radius."
            }
            
        total_penalty = 0.0
        verified_count = 0
        unverified_count = 0
        recent_7d = 0
        recent_30d = 0
        category_counts = {}
        
        for incident, distance_m in rows:
            cat_slug = incident.category.slug if incident.category else "unknown"
            
            # 1. Category-specific base severity weight
            cat_weights = CATEGORY_SEVERITY_WEIGHTS.get(cat_slug, DEFAULT_SEVERITY_WEIGHTS)
            base_w = cat_weights.get(incident.severity, DEFAULT_SEVERITY_WEIGHTS.get(incident.severity, 3.0))
            
            # 2. Proximity factor: decay from center (1.0 down to 0.1)
            proximity_mult = max(0.1, 1.0 - (distance_m / radius_m))
            
            # 3. Recency decay multiplier
            created = incident.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
                
            age_days = (now - created).days
            if age_days <= 7:
                recency_mult = 1.5
                recent_7d += 1
                recent_30d += 1
            elif age_days <= 30:
                recency_mult = 1.2
                recent_30d += 1
            elif age_days <= 90:
                recency_mult = 0.8
            else:
                recency_mult = 0.4
                
            # 4. Verification multiplier: APPROVED/RESOLVED = 1.0, PENDING/UNDER_REVIEW = 0.2
            if incident.status in (IncidentStatus.APPROVED, IncidentStatus.RESOLVED):
                verification_mult = 1.0
                verified_count += 1
            else:
                verification_mult = 0.2
                unverified_count += 1
                
            # Compute final incident penalty contribution
            penalty = base_w * proximity_mult * recency_mult * verification_mult
            total_penalty += penalty
            
            # Track category breakdown
            cat_name = incident.category.name if incident.category else "Unknown"
            cat_icon = incident.category.icon if incident.category else "📍"
            if cat_name not in category_counts:
                category_counts[cat_name] = {"name": cat_name, "icon": cat_icon, "count": 0}
            category_counts[cat_name]["count"] += 1
            
        # Calculate density
        area_km2 = math.pi * (radius_km ** 2)
        total_incidents = len(rows)
        density = total_incidents / area_km2
        
        # Density penalty (base adjustments)
        density_penalty = 0.0
        if density > 10.0:
            density_penalty = 15.0
        elif density > 5.0:
            density_penalty = 10.0
        elif density > 2.0:
            density_penalty = 5.0
            
        score = 100.0 - total_penalty - density_penalty
        score = max(0.0, min(100.0, score))
        score = round(score, 1)
        
        risk_level = "safe"
        if score < 40:
            risk_level = "unsafe"
        elif score < 75:
            risk_level = "moderate"
            
        # Top contributing categories
        top_categories = sorted(category_counts.values(), key=lambda x: x["count"], reverse=True)[:5]
        
        # Explainable reasoning
        explanation_parts = [
            f"Safety Score of {score} based on {total_incidents} incident(s) in a {radius_km}km radius."
        ]
        explanation_parts.append(
            f"Includes {verified_count} verified and {unverified_count} unverified community report(s) (weighted at 20%)."
        )
        if recent_7d > 0:
            explanation_parts.append(f"Contains {recent_7d} critical/recent report(s) from the last 7 days.")
        if density_penalty > 0:
            explanation_parts.append(f"High incident density ({round(density, 1)} incidents/km²) added a penalty of -{density_penalty}.")
        explanation = " ".join(explanation_parts)
        
        return {
            "score": score,
            "risk_level": risk_level,
            "incident_count": total_incidents,
            "density_per_km2": round(density, 2),
            "top_categories": top_categories,
            "recent_7d": recent_7d,
            "recent_30d": recent_30d,
            "explanation": explanation
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
                "severity": inc.severity.value,
                "category_name": inc.category.name if inc.category else "Unknown",
                "category_icon": inc.category.icon if inc.category else "📍",
                "created_at": inc.created_at.isoformat(),
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
