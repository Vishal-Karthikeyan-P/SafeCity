import httpx
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.safety_score_service import SafetyScoreService
import polyline

class RouteService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.osrm_base_url = "http://router.project-osrm.org/route/v1/driving"
        self.safety_service = SafetyScoreService(db)

    async def get_safe_route(self, start_lat: float, start_lng: float, dest_lat: float, dest_lng: float) -> Dict[str, Any]:
        """
        Calculates a route using OSRM, then evaluates the safety score of waypoints along the route.
        """
        url = f"{self.osrm_base_url}/{start_lng},{start_lat};{dest_lng},{dest_lat}?overview=full&geometries=polyline"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            
        if response.status_code != 200:
            return {"error": "Failed to fetch route from OSRM"}
            
        data = response.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return {"error": "No route found"}
            
        route = data["routes"][0]
        encoded_polyline = route["geometry"]
        distance = route["distance"] # in meters
        duration = route["duration"] # in seconds
        
        # Decode polyline to get waypoints (list of (lat, lng))
        waypoints = polyline.decode(encoded_polyline)
        
        # Sample waypoints to calculate route safety (e.g., every Nth point to save DB queries)
        # For simplicity, we calculate the safety of the start, middle, and end. 
        # In a production app, we would ST_Buffer the entire LineString.
        sampled_points = []
        if len(waypoints) > 0:
            sampled_points.append(waypoints[0])
            if len(waypoints) > 2:
                sampled_points.append(waypoints[len(waypoints)//2])
            sampled_points.append(waypoints[-1])
            
        total_score = 0
        dangerous_sections = []
        
        for idx, (lat, lng) in enumerate(sampled_points):
            safety = await self.safety_service.calculate_area_score(lat, lng, radius_km=1.0)
            total_score += safety["score"]
            if safety["score"] < 50:
                dangerous_sections.append({"lat": lat, "lng": lng, "score": safety["score"]})
                
        avg_score = total_score / len(sampled_points) if sampled_points else 100
        
        route_risk_level = "safe"
        if avg_score < 40:
            route_risk_level = "unsafe"
        elif avg_score < 75:
            route_risk_level = "moderate"

        return {
            "geometry": encoded_polyline,
            "distance_m": distance,
            "duration_s": duration,
            "safety_score": avg_score,
            "route_risk_level": route_risk_level,
            "dangerous_sections": dangerous_sections
        }
