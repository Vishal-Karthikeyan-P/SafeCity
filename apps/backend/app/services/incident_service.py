"""
Incident Service — business logic for incident reporting, management, uploads
"""
import math
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import aiofiles
from fastapi import HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.incident import Incident, IncidentStatus, ResolutionStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.repositories.incident_repository import IncidentRepository
from app.repositories.notification_repository import NotificationRepository
from app.schemas.incident import (
    CreateIncidentRequest, IncidentSchema, IncidentListResponse,
    UpdateIncidentStatusRequest, IncidentFilters,
    ResolutionRequestCreate, ResolutionRequestReview, ResolutionRequestSchema,
    IncidentStatusHistorySchema
)
from app.services.severity_engine import compute_severity, preview_severity as _engine_preview

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
MAX_SIZE_BYTES = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024


def _serialize(incident: Incident) -> IncidentSchema:
    schema = IncidentSchema.model_validate(incident)
    # Strip reporter identity for anonymous incidents — applies to ALL callers
    # including admin and public views (anonymity guarantee).
    if incident.is_anonymous:
        schema.reporter_id = None
        schema.reporter = None
    return schema


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

        # Auto-determine severity from category + title + description
        # (client-supplied severity is ignored to ensure consistency)
        auto_severity = compute_severity(
            category_slug=cat.slug,
            title=data.title,
            description=data.description,
        )

        incident = await self.repo.create(
            title=data.title,
            description=data.description,
            category_id=data.category_id,
            severity=auto_severity,
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
            sort_by=filters.sort_by,
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
        # Use dedicated repo method that includes anonymous_reporter_id matches
        incidents, total = await self.repo.list_my_incidents(
            user_id=user_id, page=page, limit=limit
        )
        pages = math.ceil(total / limit) if total > 0 else 1
        serialized = []
        for inc in incidents:
            schema = _serialize(inc)
            # For anonymous incidents the reporter object is hidden (reporter_id=NULL),
            # but the schema may still expose anonymous_reporter_id through the ORM.
            # Explicitly nullify reporter fields in the serialized output so no
            # identity is leaked even in the owner's own list.
            if inc.is_anonymous:
                schema.reporter = None
                schema.reporter_id = None
            serialized.append(schema)
        return IncidentListResponse(
            items=serialized,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def list_nearby(
        self, lat: float, lng: float, radius_km: float,
        category_id: Optional[str], severity: Optional[str],
        include_unapproved: bool = False
    ) -> List[IncidentSchema]:
        incidents = await self.repo.list_nearby(
            lat, lng, radius_km, category_id=category_id, severity=severity, include_unapproved=include_unapproved
        )
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

        await self.db.flush()
        refreshed = await self.repo.get_by_id(incident_id)
        if refreshed:
            await self.db.refresh(refreshed, ["images"])
        return _serialize(refreshed)

    # Valid Admin State Transitions
    VALID_STATUS_TRANSITIONS = {
        IncidentStatus.PENDING: {IncidentStatus.APPROVED, IncidentStatus.REJECTED},
        IncidentStatus.APPROVED: {
            IncidentStatus.UNDER_REVIEW,
            IncidentStatus.RESOLVED_UNVERIFIED,
            IncidentStatus.RESOLVED,
            IncidentStatus.REJECTED,
        },
        IncidentStatus.UNDER_REVIEW: {
            IncidentStatus.APPROVED,
            IncidentStatus.RESOLVED_UNVERIFIED,
            IncidentStatus.RESOLVED,
            IncidentStatus.REJECTED,
        },
        IncidentStatus.RESOLVED_UNVERIFIED: {
            IncidentStatus.RESOLVED,
            IncidentStatus.UNDER_REVIEW,
            IncidentStatus.APPROVED,
            IncidentStatus.REJECTED,
        },
        IncidentStatus.RESOLVED: {
            IncidentStatus.UNDER_REVIEW,
            IncidentStatus.APPROVED,
        },
        IncidentStatus.REJECTED: {
            IncidentStatus.PENDING,
            IncidentStatus.APPROVED,
        },
    }

    async def update_status(
        self,
        incident_id: str,
        data: UpdateIncidentStatusRequest,
        admin: User,
    ) -> IncidentSchema:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        current_status = incident.status
        target_status = data.status

        if current_status == target_status:
            raise HTTPException(
                status_code=400,
                detail=f"Incident is already in '{current_status.value}' status."
            )

        valid_targets = self.VALID_STATUS_TRANSITIONS.get(current_status, set())
        if target_status not in valid_targets:
            valid_names = [s.value for s in valid_targets]
            raise HTTPException(
                status_code=400,
                detail=f"Invalid status transition from '{current_status.value}' to '{target_status.value}'. Valid transitions are: {', '.join(valid_names)}."
            )

        # Require rejection / resolution reason where appropriate
        if target_status in (IncidentStatus.REJECTED, IncidentStatus.RESOLVED):
            if not data.admin_note or not data.admin_note.strip():
                raise HTTPException(
                    status_code=400,
                    detail=f"A reason/note is required when setting status to '{target_status.value}'."
                )

        updated = await self.repo.update_status(
            incident,
            target_status,
            data.admin_note.strip() if data.admin_note else None,
            changed_by_id=admin.id
        )

        # Notify reporter (both anonymous and non-anonymous)
        notif_user_id = incident.reporter_id or incident.anonymous_reporter_id
        if notif_user_id:
            await self.notif_repo.create(
                user_id=notif_user_id,
                title=f"Incident #{incident_id[:8]} Updated",
                message=f"Your report '{incident.title}' status changed to {target_status.value}.",
                type=NotificationType.INCIDENT_UPDATE,
                incident_id=incident_id,
            )

        return _serialize(updated)

    async def upload_evidence(self, file: UploadFile, current_user: User) -> dict:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"File type {ext} not allowed")
        content = await file.read()
        if len(content) > MAX_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="File too large")
        unique_name = f"evidence_{uuid.uuid4()}{ext}"
        save_path = os.path.join(settings.UPLOAD_DIR, unique_name)
        async with aiofiles.open(save_path, "wb") as f:
            await f.write(content)
        url = f"/uploads/{unique_name}"
        return {"url": url, "filename": file.filename or unique_name}

    async def create_resolution_request(
        self,
        incident_id: str,
        data: ResolutionRequestCreate,
        current_user: User,
    ) -> ResolutionRequestSchema:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Must be in APPROVED or UNDER_REVIEW status to request resolution
        if incident.status not in (IncidentStatus.APPROVED, IncidentStatus.UNDER_REVIEW):
            raise HTTPException(
                status_code=400,
                detail="Resolution can only be requested for incidents that are Approved or Under Review."
            )

        # Check if already a pending request
        existing_requests = await self.repo.get_resolution_requests(incident_id)
        if any(r.status == ResolutionStatus.PENDING for r in existing_requests):
            raise HTTPException(
                status_code=400,
                detail="A resolution request is already pending review for this incident."
            )

        # Check if this user is the incident creator (handles both anonymous and non-anonymous)
        is_creator = (
            str(incident.reporter_id) == str(current_user.id)
            or str(incident.anonymous_reporter_id) == str(current_user.id)
        )

        if is_creator:
            # Incident creator submitting their own resolution request:
            # Creator approval moves it to RESOLVED_UNVERIFIED for Admin review
            req = await self.repo.create_resolution_request(
                incident_id=incident_id,
                requester_id=current_user.id,
                explanation=data.explanation,
                evidence_url=data.evidence_url,
                status=ResolutionStatus.APPROVED,
                reviewed_by_id=current_user.id,
                reviewed_at=datetime.now(timezone.utc),
            )
            old_status = incident.status.value if hasattr(incident.status, "value") else str(incident.status)
            await self.repo.update_status(
                incident,
                IncidentStatus.RESOLVED_UNVERIFIED,
                admin_note=f"Resolution requested by incident creator: {data.explanation}",
                changed_by_id=current_user.id,
            )
            return ResolutionRequestSchema.model_validate(req)
        else:
            # Normal user submitting resolution request:
            req = await self.repo.create_resolution_request(
                incident_id=incident_id,
                requester_id=current_user.id,
                explanation=data.explanation,
                evidence_url=data.evidence_url,
                status=ResolutionStatus.PENDING,
            )
            # Notify incident creator
            if incident.reporter_id:
                await self.notif_repo.create(
                    user_id=incident.reporter_id,
                    title="Resolution Requested",
                    message=f"{current_user.full_name} requested resolution for your incident '{incident.title}'. Please review the evidence.",
                    type=NotificationType.INCIDENT_UPDATE,
                    incident_id=incident_id,
                )
            return ResolutionRequestSchema.model_validate(req)

    async def review_resolution_request(
        self,
        incident_id: str,
        request_id: str,
        data: ResolutionRequestReview,
        current_user: User,
    ) -> ResolutionRequestSchema:
        incident = await self.repo.get_by_id(incident_id)
        if not incident:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Security check: ONLY creator (or admin) can review
        # For anonymous incidents, check anonymous_reporter_id as well
        is_creator = (
            str(incident.reporter_id) == str(current_user.id)
            or str(incident.anonymous_reporter_id) == str(current_user.id)
        )
        if not is_creator and current_user.role != UserRole.ADMIN:
            raise HTTPException(
                status_code=403,
                detail="Only the incident creator can review resolution requests."
            )

        req = await self.repo.get_resolution_request_by_id(request_id)
        if not req or req.incident_id != incident_id:
            raise HTTPException(status_code=404, detail="Resolution request not found")

        if req.status != ResolutionStatus.PENDING:
            raise HTTPException(
                status_code=400,
                detail=f"Resolution request has already been reviewed ({req.status.value})."
            )

        now = datetime.now(timezone.utc)
        if data.action == "approve":
            # Creator approves resolution -> Incident becomes RESOLVED (UNVERIFIED)
            # Must NOT immediately become RESOLVED
            updated_req = await self.repo.update_resolution_request(
                req,
                status=ResolutionStatus.APPROVED,
                reviewed_by_id=current_user.id,
                reviewed_at=now,
            )
            await self.repo.update_status(
                incident,
                IncidentStatus.RESOLVED_UNVERIFIED,
                admin_note=f"Creator approved resolution request: {req.explanation}",
                changed_by_id=current_user.id,
            )
            # Notify requester
            if req.requester_id:
                await self.notif_repo.create(
                    user_id=req.requester_id,
                    title="Resolution Request Approved by Creator",
                    message=f"The incident creator approved your resolution request for '{incident.title}'. It is now pending admin verification.",
                    type=NotificationType.INCIDENT_UPDATE,
                    incident_id=incident_id,
                )
            return ResolutionRequestSchema.model_validate(updated_req)
        else:
            # Creator rejects resolution -> Keep incident in previous status, record rejection reason
            if not data.rejection_reason or not data.rejection_reason.strip():
                raise HTTPException(status_code=400, detail="Rejection reason is required.")

            rejection_reason = data.rejection_reason.strip()
            updated_req = await self.repo.update_resolution_request(
                req,
                status=ResolutionStatus.REJECTED,
                rejection_reason=rejection_reason,
                reviewed_by_id=current_user.id,
                reviewed_at=now,
            )
            # Record in status history
            current_status_val = incident.status.value if hasattr(incident.status, "value") else str(incident.status)
            await self.repo.add_status_history(
                incident_id=incident.id,
                from_status=current_status_val,
                to_status=current_status_val,
                changed_by_id=current_user.id,
                reason=f"Resolution request rejected by creator: {rejection_reason}",
            )
            # Notify requester
            if req.requester_id:
                await self.notif_repo.create(
                    user_id=req.requester_id,
                    title="Resolution Request Rejected",
                    message=f"Your resolution request for '{incident.title}' was rejected by the creator: {rejection_reason}",
                    type=NotificationType.INCIDENT_UPDATE,
                    incident_id=incident_id,
                )
            return ResolutionRequestSchema.model_validate(updated_req)

    async def get_resolution_requests(self, incident_id: str) -> List[ResolutionRequestSchema]:
        requests = await self.repo.get_resolution_requests(incident_id)
        return [ResolutionRequestSchema.model_validate(r) for r in requests]

    async def get_status_history(self, incident_id: str) -> List[IncidentStatusHistorySchema]:
        history = await self.repo.get_status_history(incident_id)
        return [IncidentStatusHistorySchema.model_validate(h) for h in history]

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
        recent = await self.repo.get_recent_incidents(limit=5)
        daily_trend = await self.repo.get_daily_counts(days=7)

        recent_serialized = [
            {
                "id": inc.id,
                "title": inc.title,
                "status": inc.status,
                "severity": inc.severity,
                "category_name": inc.category.name if inc.category else "Uncategorized",
                "category_icon": inc.category.icon if inc.category else "📋",
                "created_at": inc.created_at.isoformat() if inc.created_at else None,
            }
            for inc in recent
        ]

        return {
            "total_incidents": total,
            "pending": by_status.get(IncidentStatus.PENDING, by_status.get("pending", by_status.get("PENDING", 0))),
            "under_review": by_status.get(IncidentStatus.UNDER_REVIEW, by_status.get("under_review", by_status.get("UNDER_REVIEW", 0))),
            "approved": by_status.get(IncidentStatus.APPROVED, by_status.get("approved", by_status.get("APPROVED", 0))),
            "rejected": by_status.get(IncidentStatus.REJECTED, by_status.get("rejected", by_status.get("REJECTED", 0))),
            "resolved_unverified": by_status.get(IncidentStatus.RESOLVED_UNVERIFIED, by_status.get("resolved_unverified", by_status.get("RESOLVED_UNVERIFIED", 0))),
            "resolved": by_status.get(IncidentStatus.RESOLVED, by_status.get("resolved", by_status.get("RESOLVED", 0))),
            "by_category": by_category,
            "by_severity": {k: v for k, v in by_severity.items()},
            "last_30_days": last_30,
            "recent_incidents": recent_serialized,
            "daily_trend": daily_trend,
        }


