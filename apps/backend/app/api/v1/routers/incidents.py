"""
Incidents Router — /api/v1/incidents
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import (
    CategorySchema,
    CreateIncidentRequest,
    IncidentListResponse,
    IncidentSchema,
    IncidentFilters,
)
from app.services.incident_service import IncidentService

router = APIRouter()


@router.get("/categories", response_model=List[CategorySchema])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Public — list active incident categories."""
    repo = IncidentRepository(db)
    cats = await repo.get_all_categories()
    if not cats:
        await repo.seed_categories()
        cats = await repo.get_all_categories()
    return cats


@router.get("/nearby", response_model=List[IncidentSchema])
async def list_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=50),
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get incidents within a radius (PostGIS spatial query)."""
    service = IncidentService(db)
    return await service.list_nearby(lat, lng, radius_km, category_id, severity)


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=1000),
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all approved incidents with optional filters."""
    service = IncidentService(db)
    filters = IncidentFilters(
        page=page, limit=limit, category_id=category_id, severity=severity,
        status=status, date_from=date_from, date_to=date_to, search=search,
        sort_by=sort_by
    )
    return await service.list_incidents(filters)

class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    weight: int

@router.get("/heatmap", response_model=List[HeatmapPoint])
async def get_heatmap(
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get points for heatmap visualization."""
    service = IncidentService(db)
    # Reusing list_incidents with large limit to get heatmap data
    filters = IncidentFilters(
        page=1, limit=5000, category_id=category_id, severity=severity,
        status="approved", date_from=date_from, date_to=date_to, search=None,
    )
    incidents_resp = await service.list_incidents(filters)
    
    weights = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    
    points = []
    for inc in incidents_resp.items:
        points.append(HeatmapPoint(
            lat=inc.location_lat,
            lng=inc.location_lng,
            weight=weights.get(inc.severity, 1)
        ))
        
    return points


@router.post("", response_model=IncidentSchema, status_code=201)
async def create_incident(
    data: CreateIncidentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new incident report."""
    service = IncidentService(db)
    return await service.create_incident(data, current_user)


@router.get("/my", response_model=IncidentListResponse)
async def list_my_incidents(
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List incidents reported by the current user."""
    service = IncidentService(db)
    return await service.list_my_incidents(current_user.id, page, limit)


@router.get("/{incident_id}", response_model=IncidentSchema)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single incident by ID."""
    service = IncidentService(db)
    return await service.get_incident(incident_id)


@router.post("/{incident_id}/images", response_model=IncidentSchema)
async def upload_images(
    incident_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload evidence images for an incident."""
    service = IncidentService(db)
    return await service.upload_images(incident_id, files, current_user)
