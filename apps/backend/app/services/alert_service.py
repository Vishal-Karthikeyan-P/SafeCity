import math
import logging
from typing import Optional, List, Tuple
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import text
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from fastapi import HTTPException

from app.models.alert import CommunityAlert, AlertType
from app.models.user import User
from app.models.notification import NotificationType
from app.repositories.alert_repository import AlertRepository
from app.repositories.notification_repository import NotificationRepository
from app.services.push_service import send_push_notification
from app.schemas.alert import AlertCreate, AlertListResponse

logger = logging.getLogger(__name__)


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = AlertRepository(db)
        self.notif_repo = NotificationRepository(db)

    async def list_active_alerts(self, page: int, limit: int) -> AlertListResponse:
        alerts, total = await self.repo.list_active_alerts(page, limit)
        pages = math.ceil(total / limit) if total > 0 else 1
        return AlertListResponse(items=alerts, total=total, page=page, limit=limit, pages=pages)

    async def create_and_dispatch_alert(self, data: AlertCreate) -> CommunityAlert:
        """
        Create a community alert and dispatch notifications according to target mode:
        A. LOCATION-BASED: targets users whose last known location falls within radius_km (via PostGIS ST_DWithin).
           Users without location permission/data (NULL geom) are excluded.
        B. ALL USERS (BROADCAST): targets all active users regardless of location.

        Reuses the existing notification and push-notification infrastructure with deduplication.
        """
        expires_at = None
        if data.expires_in_hours and data.expires_in_hours > 0:
            expires_at = datetime.now(timezone.utc) + timedelta(hours=data.expires_in_hours)

        target_scope = (data.target_scope or "all_users").strip().lower()
        if target_scope not in ("all_users", "location_based"):
            target_scope = "all_users"

        geom = None
        loc_lat = None
        loc_lng = None
        radius_km = None

        if target_scope == "location_based":
            if data.location_lat is None or data.location_lng is None:
                raise HTTPException(
                    status_code=422,
                    detail="Coordinates (latitude and longitude) are required for location-based alerts."
                )
            if data.radius_km is None or data.radius_km <= 0:
                raise HTTPException(
                    status_code=422,
                    detail="A positive radius in kilometers is required for location-based alerts."
                )
            loc_lat = float(data.location_lat)
            loc_lng = float(data.location_lng)
            radius_km = float(data.radius_km)
            geom = from_shape(Point(loc_lng, loc_lat), srid=4326)

        alert = CommunityAlert(
            title=data.title.strip(),
            message=data.message.strip(),
            alert_type=data.alert_type,
            target_scope=target_scope,
            location_lat=loc_lat,
            location_lng=loc_lng,
            radius_km=radius_km,
            location_geom=geom,
            expires_at=expires_at,
            is_active=True,
        )
        self.db.add(alert)
        await self.db.commit()
        await self.db.refresh(alert)

        # ── Target Resolution & Notification Dispatch ──────────────────────────
        recipients_count = 0
        try:
            if target_scope == "location_based":
                # Find all active users whose known location falls within radius_km using PostGIS ST_DWithin
                radius_m = radius_km * 1000.0
                stmt = text("""
                    SELECT u.id, u.push_token, u.full_name
                    FROM users u
                    WHERE u.is_active = TRUE
                      AND u.last_location_geom IS NOT NULL
                      AND ST_DWithin(
                          u.last_location_geom::geography,
                          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                          :radius_m
                      )
                """)
                res = await self.db.execute(stmt, {
                    "lng": loc_lng,
                    "lat": loc_lat,
                    "radius_m": radius_m,
                })
                eligible_users = res.fetchall()
            else:
                # Broadcast / All Users mode: all active users
                stmt = select(User.id, User.push_token, User.full_name).where(User.is_active == True)
                res = await self.db.execute(stmt)
                eligible_users = res.all()

            # Dispatch notification to each eligible recipient with deduplication
            for user_row in eligible_users:
                user_id = user_row[0]
                push_token = user_row[1]
                dedup_key = f"community_alert:{alert.id}:{user_id}"

                # Prevent duplicate delivery
                if await self.notif_repo.has_recent_dedup(user_id, dedup_key, hours=72):
                    continue

                notif = await self.notif_repo.create(
                    user_id=user_id,
                    title=f"🚨 {alert.title}",
                    message=alert.message,
                    type=NotificationType.COMMUNITY_ALERT,
                    metadata={
                        "alert_id": alert.id,
                        "alert_type": alert.alert_type.value if hasattr(alert.alert_type, "value") else str(alert.alert_type),
                        "target_scope": target_scope,
                        "lat": loc_lat,
                        "lng": loc_lng,
                        "radius_km": radius_km,
                    },
                    dedup_key=dedup_key,
                )

                # Send mobile push notification if registered
                if push_token:
                    icon_prefix = "📍" if target_scope == "location_based" else "📢"
                    await send_push_notification(
                        push_token=push_token,
                        title=f"{icon_prefix} {alert.title}",
                        body=alert.message,
                        data={
                            "type": "community_alert",
                            "alert_id": alert.id,
                            "target_scope": target_scope,
                        },
                    )
                recipients_count += 1

            await self.db.commit()
        except Exception as e:
            logger.error("Failed dispatching alert notifications: %s", e)

        # Attach dynamic count for API response inspection
        setattr(alert, "recipients_count", recipients_count)
        return alert
