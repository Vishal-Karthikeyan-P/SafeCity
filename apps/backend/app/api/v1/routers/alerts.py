from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.services.alert_service import AlertService
from app.schemas.alert import AlertListResponse

router = APIRouter()

@router.get("", response_model=AlertListResponse)
async def list_active_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    service = AlertService(db)
    return await service.list_active_alerts(page, limit)
