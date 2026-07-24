"""
Admin Router — /api/v1/admin (admin role required)
"""
import math
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_admin
from app.models.user import User
from app.repositories.incident_repository import IncidentRepository
from app.repositories.user_repository import UserRepository
from app.schemas.incident import (
    CategoryCreateRequest, CategorySchema, CategoryUpdateRequest,
    IncidentListResponse, IncidentSchema, IncidentFilters,
    UpdateIncidentStatusRequest,
)
from app.schemas.notification import AdminStatsResponse
from app.schemas.user import UserListResponse
from app.services.incident_service import IncidentService

router = APIRouter()


@router.get("/stats", response_model=AdminStatsResponse)
async def admin_stats(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Overall platform statistics."""
    service = IncidentService(db)
    stats = await service.get_stats()
    user_repo = UserRepository(db)
    total_users = await user_repo.count()
    active_users = await user_repo.count_active()
    return {
        **stats,
        "total_users": total_users,
        "active_users": active_users,
        "new_users_this_month": 0,  # can be enhanced later
    }


# ── Incidents Management ──────────────────────────────────────

@router.get("/incidents", response_model=IncidentListResponse)
async def admin_list_incidents(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin — list all incidents with full filters."""
    service = IncidentService(db)
    filters = IncidentFilters(
        page=page, limit=limit, category_id=category_id,
        severity=severity, status=status, search=search
    )
    return await service.list_incidents(filters)


@router.patch("/incidents/{incident_id}/status", response_model=IncidentSchema)
async def update_incident_status(
    incident_id: str,
    data: UpdateIncidentStatusRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Approve, reject, or resolve an incident."""
    service = IncidentService(db)
    return await service.update_status(incident_id, data, admin)


@router.delete("/incidents/{incident_id}", status_code=204)
async def delete_incident(
    incident_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete an incident."""
    service = IncidentService(db)
    await service.delete_incident(incident_id, admin)


# ── Users Management ─────────────────────────────────────────

@router.get("/users", response_model=UserListResponse)
async def admin_list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    search: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin — list all users."""
    repo = UserRepository(db)
    users, total = await repo.list_users(page=page, limit=limit, search=search)
    pages = math.ceil(total / limit) if total > 0 else 1
    return UserListResponse(items=users, total=total, page=page, limit=limit, pages=pages)


@router.patch("/users/{user_id}/deactivate")
async def deactivate_user(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user account."""
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    await repo.update(user, is_active=False)
    return {"message": "User deactivated"}


@router.patch("/users/{user_id}/activate")
async def activate_user(
    user_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="User not found")
    await repo.update(user, is_active=True)
    return {"message": "User activated"}


# ── Category Management ───────────────────────────────────────

@router.get("/categories", response_model=list[CategorySchema])
async def admin_list_categories(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = IncidentRepository(db)
    return await repo.get_all_categories_admin()


@router.post("/categories", response_model=CategorySchema, status_code=201)
async def create_category(
    data: CategoryCreateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = IncidentRepository(db)
    return await repo.create_category(**data.model_dump())


@router.patch("/categories/{cat_id}", response_model=CategorySchema)
async def update_category(
    cat_id: str,
    data: CategoryUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = IncidentRepository(db)
    cat = await repo.get_category_by_id(cat_id)
    if not cat:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Category not found")
    return await repo.update_category(cat, **data.model_dump(exclude_none=True))
