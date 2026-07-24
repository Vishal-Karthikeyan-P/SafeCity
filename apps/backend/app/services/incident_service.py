"""
Incident Service — business logic for incident reporting, management, uploads
"""
import math
import os
import uuid
from typing import List, Optional

import aiofiles
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.incident import Incident, IncidentStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.repositories.incident_repository import IncidentRepository
from app.repositories.notification_repository import NotificationRepository
from app.schemas.incident import (
    CreateIncidentRequest, IncidentSchema, IncidentListResponse,
    UpdateIncidentStatusRequest, IncidentFilters
)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _serialize(incident: Incident) -> IncidentSchema:
    return IncidentSchema.model_validate(incident)


class IncidentService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = IncidentRepository(db)
        self.notif_repo = NotificationRepository(db)

    async def create_incident(
        self,
        data: CreateIncidentRequest,
        current_user: User,
    ) -> IncidentSchema:
        # Validate category exists
        cat = await self.repo.get_category_by_id(data.category_id)
        if not cat:
            raise HTTPException(status_code=400, detail="Category not found")

        incident = await self.repo.create(
            title=data.title,
            description=data.description,
            category_id=data.category_id,
            severity=data.severity.value,
            is_anonymous=data.is_anonymous,
            location_lat=data.location_lat,
            location_lng=data.location_lng,
            location_address=data.location_address,
            reporter_id=current_user.id,
        )
        return _serialize(incident)

    async def get_incident(self, incident_id: str) -> IncidentSchema:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        return _serialize(incident)

    async def list_incidents(self, filters: IncidentFilters) -> IncidentListResponse:
        incidents, total = await self.repo.list_incidents(
            page=filters.page,
            limit=filters.limit,
            category_id=filters.category_id,
            severity=filters.severity,
            status=filters.status,
            date_from=filters.date_from,
            date_to=filters.date_to,
            search=filters.search,
        )
        pages = math.ceil(total / filters.limit) if total > 0 else 1
        return IncidentListResponse(
            items=[_serialize(i) for i in incidents],
            total=total,
            page=filters.page,
            limit=filters.limit,
            pages=pages,
        )

    async def list_my_incidents(self, user_id: str, page: int, limit: int) -> IncidentListResponse:
        incidents, total = await self.repo.list_incidents(
            page=page, limit=limit, reporter_id=user_id
        )
        pages = math.ceil(total / limit) if total > 0 else 1
        return IncidentListResponse(
            items=[_serialize(i) for i in incidents],
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def list_nearby(
        self, lat: float, lng: float, radius_km: float,
        category_id: Optional[str], severity: Optional[str]
    ) -> List[IncidentSchema]:
        incidents = await self.repo.list_nearby(lat, lng, radius_km, category_id=category_id, severity=severity)
        return [_serialize(i) for i in incidents]

    async def upload_images(
        self,
        incident_id: str,
        files: List[UploadFile],
        current_user: User,
    ) -> IncidentSchema:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        # Only reporter or admin
        if incident.reporter_id != current_user.id and current_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Forbidden")
        if len(incident.images) + len(files) > 5:
            raise HTTPException(status_code=400, detail="Maximum 5 images per incident")

        for file in files:
            ext = os.path.splitext(file.filename or "")[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")
            content = await file.read()
            if len(content) > MAX_SIZE_BYTES:
                raise HTTPException(status_code=400, detail="File too large")
            # Save
            unique_name = f"{uuid.uuid4()}{ext}"
            save_path = os.path.join(settings.UPLOAD_DIR, unique_name)
            async with aiofiles.open(save_path, "wb") as f:
                await f.write(content)
            url = f"/uploads/{unique_name}"
            await self.repo.add_image(incident_id, file.filename or unique_name, url)

        return _serialize(await self.repo.get_by_id(incident_id))

    async def update_status(
        self,
        incident_id: str,
        data: UpdateIncidentStatusRequest,
        admin: User,
    ) -> IncidentSchema:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        updated = await self.repo.update_status(incident, data.status.value, data.admin_note)
        # Notify reporter
        if incident.reporter_id:
            await self.notif_repo.create(
                user_id=incident.reporter_id,
                title=f"Incident #{incident_id[:8]} Updated",
                message=f"Your report '{incident.title}' status changed to {data.status.value}.",
                type=NotificationType.INCIDENT_UPDATE,
                incident_id=incident_id,
            )
        return _serialize(updated)

    async def delete_incident(self, incident_id: str, admin: User) -> None:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")
        await self.repo.soft_delete(incident)

    async def get_stats(self) -> dict:
        by_status = await self.repo.count_by_status()
        by_category = await self.repo.count_by_category()
        by_severity = await self.repo.count_by_severity()
        last_30 = await self.repo.count_last_n_days(30)
        total = await self.repo.count_total()
        return {
            "total_incidents": total,
            "pending": by_status.get("pending", 0),
            "under_review": by_status.get("under_review", 0),
            "approved": by_status.get("approved", 0),
            "rejected": by_status.get("rejected", 0),
            "resolved": by_status.get("resolved", 0),
            "by_category": by_category,
            "by_severity": {k: v for k, v in by_severity.items()},
            "last_30_days": last_30,
        }
