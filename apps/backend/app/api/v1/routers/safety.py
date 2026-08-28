"""
Safety Router — /api/v1/safety
Provides area safety scores and city-wide overview for the Safety Map Dashboard.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.safety_score_service import SafetyScoreService

router = APIRouter()


@router.get("/area")
async def get_area_safety_score(
    lat: float = Query(..., ge=-90, le=90, description="Latitude of the area center"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude of the area center"),
    radius_km: float = Query(1.0, ge=0.1, le=50.0, description="Radius in kilometers"),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate a detailed safety score for a selected geographic area.
    Considers severity, recency, and density of incidents from PostGIS.
    Returns score (0-100), risk level, incident count, and top categories.
    """
    service = SafetyScoreService(db)
    return await service.calculate_area_score_detailed(lat, lng, radius_km)


@router.get("/city")
async def get_city_overview(
    city_lat: float = Query(11.0168, ge=-90, le=90, description="City center latitude"),
    city_lng: float = Query(76.9558, ge=-180, le=180, description="City center longitude"),
    radius_km: float = Query(20.0, ge=1.0, le=100.0, description="City coverage radius km"),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a high-level city safety overview for the Safety Map Dashboard.
    Includes overall score, total incident count, top categories, and recent activity.
    """
    service = SafetyScoreService(db)
    return await service.get_city_overview(city_lat, city_lng, radius_km)
