from sqlalchemy.ext.asyncio import AsyncSession
import math
from app.repositories.alert_repository import AlertRepository
from app.schemas.alert import AlertListResponse

class AlertService:
    def __init__(self, db: AsyncSession):
        self.repo = AlertRepository(db)

    async def list_active_alerts(self, page: int, limit: int) -> AlertListResponse:
        alerts, total = await self.repo.list_active_alerts(page, limit)
        pages = math.ceil(total / limit) if total > 0 else 1
        return AlertListResponse(items=alerts, total=total, page=page, limit=limit, pages=pages)
