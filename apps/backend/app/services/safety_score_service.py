from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text, desc, distinct
from sqlalchemy.orm import selectinload
from geoalchemy2 import Geography
from app.models.incident import Incident, IncidentCategory, SeverityLevel, IncidentStatus
from datetime import datetime, timedelta, timezone
import math

class SafetyScoreService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_area_score(self, lat: float, lng: float, radius_km: float = 1.0) -> dict:
        """
        Calculates a safety score (0-100) for a given area.
        Score starts at 100 (safest).
        Deductions:
        - Critical incident: -15
        - High incident: -10
        - Medium incident: -5
        - Low incident: -2
        """
        radius_m = radius_km * 1000
        
        query = select(
            func.count(Incident.id).label("count"),
            Incident.severity
        ).where(
            func.ST_DWithin(
                Incident.location_geom,
                func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326).cast(Geography(srid=4326)),
                radius_m
            )
        ).group_by(Incident.severity)
        
        result = await self.db.execute(query)
        severity_counts = {row.severity: row.count for row in result.all()}
        
        score = 100
        score -= severity_counts.get(SeverityLevel.CRITICAL, 0) * 15
        score -= severity_counts.get(SeverityLevel.HIGH, 0) * 10
        score -= severity_counts.get(SeverityLevel.MEDIUM, 0) * 5
        score -= severity_counts.get(SeverityLevel.LOW, 0) * 2
        
        score = max(0, score) # Cap at 0
        
        risk_level = "safe"
        if score < 40:
            risk_level = "unsafe"
        elif score < 75:
            risk_level = "moderate"
            
        return {
            "score": score,
            "risk_level": risk_level,
            "incident_breakdown": severity_counts
        }

    async def calculate_route_safety(self, encoded_polyline: str, radius_km: float = 0.1) -> dict:
        """
        Calculates a safety score for a route by creating a LineString and querying PostGIS.
        Returns the score, risk level, and a list of actual incidents near the route.
        """
        import polyline
        from sqlalchemy.orm import selectinload
        
        radius_m = radius_km * 1000
        waypoints = polyline.decode(encoded_polyline)
        
        if len(waypoints) < 2:
            return {
                "score": 100,
                "risk_level": "safe",
                "incidents": []
            }
            
        coord_strings = [f"{lng} {lat}" for lat, lng in waypoints]
        linestring_wkt = f"LINESTRING({','.join(coord_strings)})"
        
        # We fetch the actual incidents with categories since we need to display them
        query = select(Incident).options(
            selectinload(Incident.category)
        ).where(
            func.ST_DWithin(
                Incident.location_geom,
                func.ST_SetSRID(func.ST_GeomFromText(linestring_wkt), 4326).cast(Geography(srid=4326)),
                radius_m
            ),
            Incident.status == "approved"
        )
        
        result = await self.db.execute(query)
        incidents = result.scalars().all()
        
        severity_counts = {
            SeverityLevel.LOW: 0,
            SeverityLevel.MEDIUM: 0,
            SeverityLevel.HIGH: 0,
            SeverityLevel.CRITICAL: 0
        }
        
        incident_list = []
        for inc in incidents:
            severity_counts[inc.severity] += 1
            incident_list.append({
                "id": str(inc.id),
                "title": inc.title,
                "description": inc.description,
                "severity": inc.severity.value,
                "lat": inc.location_lat,
                "lng": inc.location_lng,
                "category_icon": inc.category.icon if inc.category else "📍",
                "category_name": inc.category.name if inc.category else "Unknown"
            })
            
        score = 100
        score -= severity_counts[SeverityLevel.CRITICAL] * 15
        score -= severity_counts[SeverityLevel.HIGH] * 10
        score -= severity_counts[SeverityLevel.MEDIUM] * 5
        score -= severity_counts[SeverityLevel.LOW] * 2
        
        score = max(0, score) # Cap at 0
        
        risk_level = "safe"
        if score < 40:
            risk_level = "unsafe"
        elif score < 75:
            risk_level = "moderate"
            
        return {
            "score": score,
            "risk_level": risk_level,
            "incidents": incident_list
        }

    async def calculate_area_score_detailed(self, lat: float, lng: float, radius_km: float = 1.0) -> dict:
        """
        Detailed area safety score that considers:
        - Number of incidents
        - Incident severity (weighted)
        - Incident recency (recent incidents penalise more)
        - Incident density (incidents per km²)
        Returns score 0-100, risk level, count, and top categories.
        """
        radius_m = radius_km * 1000
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        geo_point = func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326).cast(Geography(srid=4326))

        # Fetch all approved incidents in radius with their categories
        query = select(Incident).options(
            selectinload(Incident.category)
        ).where(
            func.ST_DWithin(Incident.location_geom, geo_point, radius_m),
            Incident.status == IncidentStatus.APPROVED,
            Incident.deleted_at.is_(None),
        )

        result = await self.db.execute(query)
        incidents = result.scalars().all()

        if not incidents:
            return {
                "score": 100,
                "risk_level": "safe",
                "incident_count": 0,
                "density_per_km2": 0.0,
                "top_categories": [],
                "recent_7d": 0,
                "recent_30d": 0,
            }

        # Severity base weights
        severity_weight = {
            SeverityLevel.LOW: 2,
            SeverityLevel.MEDIUM: 5,
            SeverityLevel.HIGH: 10,
            SeverityLevel.CRITICAL: 15,
        }

        weighted_penalty = 0.0
        recent_7d = 0
        recent_30d = 0
        category_counts: dict[str, dict] = {}

        for inc in incidents:
            base_w = severity_weight.get(inc.severity, 2)

            # Recency multiplier: incidents in last 7 days score 1.5x, last 30 days 1.2x, older 1x
            created = inc.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)

            if created >= seven_days_ago:
                recency_mult = 1.5
                recent_7d += 1
                recent_30d += 1
            elif created >= thirty_days_ago:
                recency_mult = 1.2
                recent_30d += 1
            else:
                recency_mult = 1.0

            weighted_penalty += base_w * recency_mult

            # Track category
            cat_name = inc.category.name if inc.category else "Unknown"
            cat_icon = inc.category.icon if inc.category else "📍"
            if cat_name not in category_counts:
                category_counts[cat_name] = {"name": cat_name, "icon": cat_icon, "count": 0}
            category_counts[cat_name]["count"] += 1

        score = max(0, 100 - weighted_penalty)

        # Density penalty: incidents per km²
        area_km2 = math.pi * (radius_km ** 2)
        density = len(incidents) / area_km2
        if density > 5:
            score = max(0, score - 10)
        elif density > 2:
            score = max(0, score - 5)

        score = round(score, 1)

        risk_level = "safe"
        if score < 40:
            risk_level = "unsafe"
        elif score < 75:
            risk_level = "moderate"

        top_categories = sorted(category_counts.values(), key=lambda x: x["count"], reverse=True)[:5]

        return {
            "score": score,
            "risk_level": risk_level,
            "incident_count": len(incidents),
            "density_per_km2": round(density, 2),
            "top_categories": top_categories,
            "recent_7d": recent_7d,
            "recent_30d": recent_30d,
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
