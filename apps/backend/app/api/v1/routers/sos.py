from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.emergency import SOSStatus
from app.services.emergency_service import EmergencyService
from app.schemas.emergency import SOSRequestCreate, SOSRequestSchema, SOSLocationUpdate
from pydantic import BaseModel

router = APIRouter()

class ResolveSOSRequest(BaseModel):
    status: SOSStatus

@router.get("/active", response_model=Optional[SOSRequestSchema])
async def get_active_sos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve current active SOS request for user if one exists."""
    service = EmergencyService(db)
    return await service.get_active_sos(current_user.id)

@router.post("", response_model=SOSRequestSchema, status_code=201)
async def trigger_sos(
    data: SOSRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger a new SOS request for the current user."""
    service = EmergencyService(db)
    return await service.trigger_sos(current_user.id, data)

@router.patch("/location", response_model=SOSRequestSchema)
async def update_sos_location(
    data: SOSLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update GPS coordinates for the current active SOS request."""
    service = EmergencyService(db)
    return await service.update_sos_location(current_user.id, data.location_lat, data.location_lng)

@router.patch("/resolve", response_model=SOSRequestSchema)
async def resolve_sos(
    data: ResolveSOSRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resolve an active SOS request."""
    service = EmergencyService(db)
    return await service.resolve_sos(current_user.id, data.status)

