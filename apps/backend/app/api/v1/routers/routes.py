from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict

from app.core.database import get_db
from app.services.route_service import RouteService

router = APIRouter()

@router.get("/plan")
async def plan_safe_route(
    start_lat: float = Query(..., ge=-90, le=90),
    start_lng: float = Query(..., ge=-180, le=180),
    dest_lat: float = Query(..., ge=-90, le=90),
    dest_lng: float = Query(..., ge=-180, le=180),
    db: AsyncSession = Depends(get_db)
):
    """
    Plan a safe route between two coordinates.
    Returns polyline geometry, distance, estimated time, and route safety score.
    """
    service = RouteService(db)
    result = await service.get_safe_route(start_lat, start_lng, dest_lat, dest_lng)
    
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
        
    return result
