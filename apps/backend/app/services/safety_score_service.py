from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, text
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
                func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326).cast(text("geography")),
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
