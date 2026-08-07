from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.emergency import SOSStatus
from app.services.emergency_service import EmergencyService
from app.schemas.emergency import SOSRequestCreate, SOSRequestSchema
from pydantic import BaseModel

router = APIRouter()

class ResolveSOSRequest(BaseModel):
    status: SOSStatus

@router.post("", response_model=SOSRequestSchema, status_code=201)
async def trigger_sos(
    data: SOSRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Trigger a new SOS request for the current user."""
    service = EmergencyService(db)
    return await service.trigger_sos(current_user.id, data)

@router.patch("/resolve", response_model=SOSRequestSchema)
async def resolve_sos(
    data: ResolveSOSRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Resolve an active SOS request."""
    service = EmergencyService(db)
    return await service.resolve_sos(current_user.id, data.status)
