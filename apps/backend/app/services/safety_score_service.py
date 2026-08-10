from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
from geoalchemy2 import Geography
from app.models.incident import Incident, SeverityLevel

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
