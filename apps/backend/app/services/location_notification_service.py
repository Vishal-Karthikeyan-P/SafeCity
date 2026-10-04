"""
Location Notification Service — generates location-based notifications.

Handles:
- Nearby incident detection (PostGIS ST_DWithin, 5km)
- Unsafe area entry detection (area safety score < 40)
- Deduplication via notification_repository.has_recent_dedup()

Called by mobile client via POST /notifications/location-check
Only triggers when valid coordinates are provided (permission already granted on mobile).
"""
import json
import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationType
from app.repositories.notification_repository import NotificationRepository
from app.services.push_service import send_push_notification
from app.services.safety_score_service import SafetyScoreService

logger = logging.getLogger(__name__)

NEARBY_RADIUS_KM = 5.0
UNSAFE_SCORE_THRESHOLD = 40.0   # below this = unsafe
UNSAFE_AREA_COOLDOWN_HOURS = 6  # only re-notify after 6h in same unsafe zone
NEARBY_INCIDENT_COOLDOWN_HOURS = 24  # re-notify at most once per day per incident


class LocationNotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notif_repo = NotificationRepository(db)

    async def check_and_notify(
        self,
        user_id: str,
        user_name: str,
        push_token: Optional[str],
        lat: float,
        lng: float,
    ) -> dict:
        """
        Main entry point — called when the user's location changes.
        Returns a summary of what was triggered.
        """
        triggered = {"nearby_incidents": 0, "unsafe_area": False}

        # 1. Check for nearby incidents (approved, within 5km)
        nearby_count = await self._check_nearby_incidents(
            user_id, push_token, lat, lng
        )
        triggered["nearby_incidents"] = nearby_count

        # 2. Check if user is in an unsafe area
        unsafe = await self._check_unsafe_area(user_id, user_name, push_token, lat, lng)
        triggered["unsafe_area"] = unsafe

        await self.db.commit()
        return triggered

    async def _check_nearby_incidents(
        self,
        user_id: str,
        push_token: Optional[str],
        lat: float,
        lng: float,
    ) -> int:
        """
        Find recently created (last 2h) approved incidents within 5km
        that the user hasn't been notified about yet.
        Uses PostGIS ST_DWithin for accuracy.
        """
        try:
            radius_m = NEARBY_RADIUS_KM * 1000
            # Query recent approved incidents near the user using PostGIS
            result = await self.db.execute(
                text("""
                    SELECT i.id, i.title, i.severity,
                           ST_Distance(
                               i.location_geom::geography,
                               ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
                           ) AS dist_m
                    FROM incidents i
                    WHERE i.status = 'APPROVED'
                      AND i.deleted_at IS NULL
                      AND i.location_geom IS NOT NULL
                      AND ST_DWithin(
                            i.location_geom::geography,
                            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                            :radius_m
                          )
                      AND i.created_at >= NOW() - INTERVAL '2 hours'
                    ORDER BY dist_m ASC
                    LIMIT 5
                """),
                {"lat": lat, "lng": lng, "radius_m": radius_m},
            )
            rows = result.fetchall()
        except Exception as e:
            logger.warning("nearby_incidents query failed: %s", e)
            await self.db.rollback()
            return 0

        notified = 0
        for row in rows:
            incident_id, title, severity, dist_m = row
            dedup_key = f"nearby_incident:{incident_id}"
            if await self.notif_repo.has_recent_dedup(user_id, dedup_key, NEARBY_INCIDENT_COOLDOWN_HOURS):
                continue

            dist_km = dist_m / 1000
            notif = await self.notif_repo.create(
                user_id=user_id,
                title=f"⚠️ Nearby Incident: {title}",
                message=f"A {severity} incident was reported {dist_km:.1f}km from your location.",
                type=NotificationType.NEARBY_INCIDENT,
                incident_id=incident_id,
                metadata={"lat": lat, "lng": lng, "dist_km": round(dist_km, 2)},
                dedup_key=dedup_key,
            )
            if notif and push_token:
                await send_push_notification(
                    push_token=push_token,
                    title=f"⚠️ Nearby Incident",
                    body=f"{title} — {dist_km:.1f}km away",
                    data={"type": "nearby_incident", "incident_id": incident_id},
                )
            notified += 1

        return notified

    async def _check_unsafe_area(
        self,
        user_id: str,
        user_name: str,
        push_token: Optional[str],
        lat: float,
        lng: float,
    ) -> bool:
        """
        Check if the user's current area has an unsafe safety score.
        Only triggers once per UNSAFE_AREA_COOLDOWN_HOURS to avoid spam.
        """
        # Grid-cell based dedup key (0.01° ≈ 1km)
        grid_lat = round(lat, 2)
        grid_lng = round(lng, 2)
        dedup_key = f"unsafe_area:{grid_lat}:{grid_lng}"

        if await self.notif_repo.has_recent_dedup(user_id, dedup_key, UNSAFE_AREA_COOLDOWN_HOURS):
            return False

        try:
            svc = SafetyScoreService(self.db)
            score_data = await svc.calculate_area_score_detailed(lat, lng, radius_km=1.0)
            score = score_data.get("score", 100.0)
        except Exception as e:
            logger.warning("Safety score lookup failed: %s", e)
            return False

        if score >= UNSAFE_SCORE_THRESHOLD:
            return False  # Area is safe/moderate, no notification needed

        notif = await self.notif_repo.create(
            user_id=user_id,
            title="⚠️ You've entered an unsafe area",
            message=f"The area around your current location has a safety score of {score:.0f}/100. Stay alert.",
            type=NotificationType.UNSAFE_AREA,
            metadata={"lat": lat, "lng": lng, "safety_score": round(score, 1)},
            dedup_key=dedup_key,
        )
        if notif and push_token:
            await send_push_notification(
                push_token=push_token,
                title="⚠️ Unsafe Area Warning",
                body=f"Safety score: {score:.0f}/100. Stay alert and be aware of your surroundings.",
                data={"type": "unsafe_area", "lat": lat, "lng": lng, "score": score},
            )
        return True
