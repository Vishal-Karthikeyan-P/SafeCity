from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Tuple
from app.models.alert import CommunityAlert, AlertType

class AlertRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_active_alerts(self, page: int = 1, limit: int = 10) -> Tuple[List[CommunityAlert], int]:
        from datetime import datetime, timezone
        now = datetime.now(timezone.utc)
        
        query = select(CommunityAlert).where(
            CommunityAlert.is_active == True,
            (CommunityAlert.expires_at == None) | (CommunityAlert.expires_at > now)
        )
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0
        
        # Pagination
        query = query.order_by(CommunityAlert.created_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        alerts = list(result.scalars().all())
        
        return alerts, total
