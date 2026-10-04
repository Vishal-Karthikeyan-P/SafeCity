"""
Notification Repository — extended with deduplication, metadata, and push notification support.
"""
import json
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification, NotificationType


class NotificationRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        user_id: str,
        title: str,
        message: str,
        type: NotificationType = NotificationType.SYSTEM,
        incident_id: str = None,
        sos_id: str = None,
        metadata: dict = None,
        dedup_key: str = None,
    ) -> Notification:
        """
        Create a notification. If dedup_key is provided and an unread notification
        with the same user_id+dedup_key already exists within 24h, skip creation.
        Returns the notification (new or existing) or None if deduplicated.
        """
        # Deduplication check
        if dedup_key:
            from datetime import datetime, timezone, timedelta
            cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
            existing = await self.db.execute(
                select(Notification).where(
                    Notification.user_id == user_id,
                    Notification.dedup_key == dedup_key,
                    Notification.created_at >= cutoff,
                )
            )
            if existing.scalar_one_or_none():
                return None  # Already notified recently

        n = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=type,
            incident_id=incident_id,
            sos_id=sos_id,
            metadata_json=json.dumps(metadata) if metadata else None,
            dedup_key=dedup_key,
        )
        self.db.add(n)
        await self.db.flush()
        await self.db.refresh(n)
        return n

    async def list_for_user(self, user_id: str, limit: int = 50) -> List[Notification]:
        result = await self.db.execute(
            select(Notification)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_unread(self, user_id: str) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user_id,
                Notification.is_read == False,
            )
        )
        return result.scalar_one()

    async def get_by_id(self, notif_id: str, user_id: str) -> Notification | None:
        result = await self.db.execute(
            select(Notification).where(
                Notification.id == notif_id,
                Notification.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def mark_read(self, notification: Notification) -> Notification:
        notification.is_read = True
        await self.db.flush()
        return notification

    async def mark_all_read(self, user_id: str) -> None:
        from sqlalchemy import update
        await self.db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
        await self.db.flush()

    async def has_recent_dedup(self, user_id: str, dedup_key: str, hours: int = 24) -> bool:
        """Check if a notification with this dedup_key was sent to user_id within the last N hours."""
        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        result = await self.db.execute(
            select(func.count()).select_from(Notification).where(
                Notification.user_id == user_id,
                Notification.dedup_key == dedup_key,
                Notification.created_at >= cutoff,
            )
        )
        return result.scalar_one() > 0
