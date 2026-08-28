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
from app.schemas.alert import AlertCreate, AlertSchema
from app.schemas.learning import ArticleCreate, ArticleUpdate, ArticleSchema, ArticleListResponse
from app.repositories.alert_repository import AlertRepository
from app.repositories.learning_repository import LearningRepository

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
    sort_by: Optional[str] = Query("severity"),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin — list all incidents with full filters."""
    service = IncidentService(db)
    filters = IncidentFilters(
        page=page, limit=limit, category_id=category_id,
        severity=severity, status=status, search=search, sort_by=sort_by
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
    role: Optional[str] = None,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin — list all users with role and search filters."""
    repo = UserRepository(db)
    users, total = await repo.list_users(page=page, limit=limit, search=search, role=role)
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


@router.patch("/users/{user_id}/role")
async def change_user_role(
    user_id: str,
    data: dict,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Promote or demote a user's role (admin <-> citizen)."""
    from fastapi import HTTPException
    if str(admin.id) == str(user_id):
        raise HTTPException(status_code=400, detail="You cannot change your own role")
    role = data.get("role")
    if role not in ("admin", "citizen"):
        raise HTTPException(status_code=422, detail="Role must be 'admin' or 'citizen'")
    repo = UserRepository(db)
    user = await repo.get_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await repo.update(user, role=role)
    return {"message": f"User role updated to {role}"}


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


# ── Community Alerts Management ──────────────────────────────

from app.models.alert import CommunityAlert
from sqlalchemy.future import select
from datetime import datetime, timezone, timedelta

@router.get("/alerts", response_model=list[AlertSchema])
async def admin_list_alerts(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityAlert).order_by(CommunityAlert.created_at.desc()))
    return list(result.scalars().all())

@router.post("/alerts", response_model=AlertSchema, status_code=201)
async def create_alert(
    data: AlertCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    expires_at = None
    if data.expires_in_hours:
        expires_at = datetime.now(timezone.utc) + timedelta(hours=data.expires_in_hours)
    
    alert = CommunityAlert(
        title=data.title,
        message=data.message,
        alert_type=data.alert_type,
        location_lat=data.location_lat,
        location_lng=data.location_lng,
        radius_km=data.radius_km,
        expires_at=expires_at,
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert

@router.delete("/alerts/{alert_id}", status_code=204)
async def delete_alert(
    alert_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CommunityAlert).where(CommunityAlert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.is_active = False
    await db.commit()


# ── Learning Articles Management ──────────────────────────────────────

from app.models.learning import Article, ArticleCategory
import re

def _slugify(text: str) -> str:
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '-', slug).strip('-')

@router.get("/articles", response_model=ArticleListResponse)
async def admin_list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = LearningRepository(db)
    articles, total = await repo.list_articles(page=page, limit=limit)
    pages = math.ceil(total / limit) if total > 0 else 1
    from app.schemas.learning import ArticleListResponse
    return ArticleListResponse(items=articles, total=total, page=page, limit=limit, pages=pages)

@router.post("/articles", response_model=ArticleSchema, status_code=201)
async def create_article(
    data: ArticleCreate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    import uuid
    slug = _slugify(data.title) + "-" + str(uuid.uuid4())[:8]
    article = Article(
        title=data.title,
        slug=slug,
        overview=data.overview,
        content_dos=data.content_dos,
        content_donts=data.content_donts,
        emergency_steps=data.emergency_steps,
        helpline_numbers=data.helpline_numbers,
        legal_info=data.legal_info,
        category_id=data.category_id,
    )
    db.add(article)
    await db.commit()
    
    repo = LearningRepository(db)
    # Eagerly load the category relation for serialization
    refreshed_article = await repo.get_article_by_id(article.id)
    return refreshed_article

@router.patch("/articles/{article_id}", response_model=ArticleSchema)
async def update_article(
    article_id: str,
    data: ArticleUpdate,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    repo = LearningRepository(db)
    article = await repo.get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    update_data = data.model_dump(exclude_none=True)
    for key, val in update_data.items():
        setattr(article, key, val)
    await db.commit()
    
    # Eagerly load the category relation for serialization
    refreshed_article = await repo.get_article_by_id(article_id)
    return refreshed_article

@router.delete("/articles/{article_id}", status_code=204)
async def delete_article(
    article_id: str,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    from fastapi import HTTPException
    repo = LearningRepository(db)
    article = await repo.get_article_by_id(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()
