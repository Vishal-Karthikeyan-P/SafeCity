"""
Incidents Router — /api/v1/incidents
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.repositories.incident_repository import IncidentRepository
from app.schemas.incident import (
    CategorySchema,
    CreateIncidentRequest,
    IncidentListResponse,
    IncidentSchema,
    IncidentFilters,
    ResolutionRequestCreate,
    ResolutionRequestReview,
    ResolutionRequestSchema,
    IncidentStatusHistorySchema,
    UpdateIncidentStatusRequest,
)
from app.services.incident_service import IncidentService
from app.services.severity_engine import (
    compute_severity,
    preview_severity as _engine_preview,
    apreview_severity,
    acompute_severity,
)

router = APIRouter()


@router.get("/categories", response_model=List[CategorySchema])
async def list_categories(db: AsyncSession = Depends(get_db)):
    """Public — list active incident categories."""
    repo = IncidentRepository(db)
    cats = await repo.get_all_categories()
    if not cats:
        await repo.seed_categories()
        cats = await repo.get_all_categories()
    return cats


@router.get("/nearby", response_model=List[IncidentSchema])
async def list_nearby(
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(5.0, ge=0.1, le=50),
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get incidents within a radius (PostGIS spatial query)."""
    service = IncidentService(db)
    return await service.list_nearby(lat, lng, radius_km, category_id, severity)


@router.get("", response_model=IncidentListResponse)
async def list_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=1000),
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """List all approved incidents with optional filters."""
    service = IncidentService(db)
    filters = IncidentFilters(
        page=page, limit=limit, category_id=category_id, severity=severity,
        status=status, date_from=date_from, date_to=date_to, search=search,
        sort_by=sort_by
    )
    return await service.list_incidents(filters)

class HeatmapPoint(BaseModel):
    lat: float
    lng: float
    weight: int

@router.get("/heatmap", response_model=List[HeatmapPoint])
async def get_heatmap(
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Get points for heatmap visualization."""
    service = IncidentService(db)
    # Reusing list_incidents with large limit to get heatmap data
    filters = IncidentFilters(
        page=1, limit=5000, category_id=category_id, severity=severity,
        status="approved", date_from=date_from, date_to=date_to, search=None,
    )
    incidents_resp = await service.list_incidents(filters)
    
    weights = {"low": 1, "medium": 2, "high": 3, "critical": 4}
    
    points = []
    for inc in incidents_resp.items:
        points.append(HeatmapPoint(
            lat=inc.location_lat,
            lng=inc.location_lng,
            weight=weights.get(inc.severity, 1)
        ))
        
    return points


@router.get("/preview-severity")
async def preview_severity(
    category_id: Optional[str] = Query(None),
    title: str = Query(""),
    description: str = Query(""),
    db: AsyncSession = Depends(get_db),
):
    """
    Preview auto-determined severity without creating an incident.
    Used by frontend to show live severity feedback as user fills the form.
    category_slug is resolved from category_id internally.
    """
    cat_slug = ""
    if category_id:
        repo = IncidentRepository(db)
        cat = await repo.get_category_by_id(category_id)
        if cat:
            cat_slug = cat.slug
    result = await apreview_severity(cat_slug, title, description)
    return result


@router.post("", response_model=IncidentSchema, status_code=201)
async def create_incident(
    data: CreateIncidentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new incident report."""
    service = IncidentService(db)
    return await service.create_incident(data, current_user)


@router.get("/my/stats")
async def my_incident_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Per-status counts + this-month total for the authenticated user.
    Uses COALESCE(reporter_id, anonymous_reporter_id) so anonymous reports are included.
    """
    from sqlalchemy import case, extract, func, or_, select
    from app.models.incident import Incident, IncidentStatus
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    uid = str(current_user.id)
    owner_cond = or_(
        Incident.reporter_id == uid,
        Incident.anonymous_reporter_id == uid,
    )
    base = select(Incident.status, func.count(Incident.id).label("cnt")).where(
        owner_cond, Incident.deleted_at.is_(None)
    ).group_by(Incident.status)

    rows = (await db.execute(base)).all()
    status_counts: dict = {r[0].value if hasattr(r[0], "value") else str(r[0]): int(r[1]) for r in rows}
    total = sum(status_counts.values())

    # This-month count
    month_q = select(func.count(Incident.id)).where(
        owner_cond,
        Incident.deleted_at.is_(None),
        extract("year", Incident.created_at) == now.year,
        extract("month", Incident.created_at) == now.month,
    )
    this_month = (await db.execute(month_q)).scalar_one()

    return {
        "total": total,
        "this_month": int(this_month),
        "by_status": status_counts,
    }


@router.get("/my", response_model=IncidentListResponse)
async def list_my_incidents(
    page: int = 1,
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List incidents reported by the current user."""
    service = IncidentService(db)
    return await service.list_my_incidents(current_user.id, page, limit)


@router.get("/{incident_id}", response_model=IncidentSchema)
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    """Get a single incident by ID."""
    service = IncidentService(db)
    return await service.get_incident(incident_id)


@router.post("/{incident_id}/images", response_model=IncidentSchema)
async def upload_images(
    incident_id: str,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload evidence images for an incident."""
    service = IncidentService(db)
    return await service.upload_images(incident_id, files, current_user)


@router.post("/upload-evidence")
async def upload_evidence(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload resolution evidence image (returns URL)."""
    service = IncidentService(db)
    return await service.upload_evidence(file, current_user)


@router.post("/{incident_id}/resolution-requests", response_model=ResolutionRequestSchema, status_code=201)
async def create_resolution_request(
    incident_id: str,
    data: ResolutionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a resolution request with explanation and evidence for an incident."""
    service = IncidentService(db)
    return await service.create_resolution_request(incident_id, data, current_user)


@router.get("/{incident_id}/resolution-requests", response_model=List[ResolutionRequestSchema])
async def list_resolution_requests(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List all resolution requests for an incident."""
    service = IncidentService(db)
    return await service.get_resolution_requests(incident_id)


@router.post("/{incident_id}/resolution-requests/{request_id}/review", response_model=ResolutionRequestSchema)
async def review_resolution_request(
    incident_id: str,
    request_id: str,
    data: ResolutionRequestReview,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Incident creator reviews resolution request (Approve or Reject)."""
    service = IncidentService(db)
    return await service.review_resolution_request(incident_id, request_id, data, current_user)


@router.post("/{incident_id}/resolution-requests/{request_id}/approve", response_model=ResolutionRequestSchema)
async def approve_resolution_request(
    incident_id: str,
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Incident creator approves resolution request (moves incident to RESOLVED_UNVERIFIED)."""
    service = IncidentService(db)
    review_data = ResolutionRequestReview(action="approve")
    return await service.review_resolution_request(incident_id, request_id, review_data, current_user)


@router.post("/{incident_id}/resolution-requests/{request_id}/reject", response_model=ResolutionRequestSchema)
async def reject_resolution_request(
    incident_id: str,
    request_id: str,
    data: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Incident creator rejects resolution request with reason (keeps previous status)."""
    service = IncidentService(db)
    rejection_reason = data.get("rejection_reason") or data.get("reason", "")
    review_data = ResolutionRequestReview(action="reject", rejection_reason=rejection_reason)
    return await service.review_resolution_request(incident_id, request_id, review_data, current_user)


@router.get("/{incident_id}/status-history", response_model=List[IncidentStatusHistorySchema])
async def get_status_history(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get status change history and audit trail for an incident."""
    service = IncidentService(db)
    return await service.get_status_history(incident_id)

