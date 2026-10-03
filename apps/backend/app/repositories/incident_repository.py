"""
Incident Repository — all DB access for incidents and categories
"""
import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, case, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.incident import (
    Incident, IncidentCategory, IncidentImage, IncidentStatus, SeverityLevel,
    ResolutionRequest, ResolutionStatus, IncidentStatusHistory
)


class IncidentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    # ── Helpers ────────────────────────────────────────────────

    def _base_query(self):
        return (
            select(Incident)
            .options(
                selectinload(Incident.category),
                selectinload(Incident.images),
                selectinload(Incident.reporter),
                selectinload(Incident.resolution_requests).selectinload(ResolutionRequest.requester),
                selectinload(Incident.resolution_requests).selectinload(ResolutionRequest.reviewed_by),
                selectinload(Incident.status_history).selectinload(IncidentStatusHistory.changed_by),
            )
            .where(Incident.deleted_at.is_(None))
        )

    # ── Categories ─────────────────────────────────────────────

    async def get_all_categories(self) -> List[IncidentCategory]:
        result = await self.db.execute(
            select(IncidentCategory).where(IncidentCategory.is_active == True)
        )
        return list(result.scalars().all())

    async def get_all_categories_admin(self) -> List[IncidentCategory]:
        result = await self.db.execute(select(IncidentCategory))
        return list(result.scalars().all())

    async def get_category_by_id(self, cat_id: str) -> Optional[IncidentCategory]:
        result = await self.db.execute(
            select(IncidentCategory).where(IncidentCategory.id == cat_id)
        )
        return result.scalar_one_or_none()

    async def get_category_by_slug(self, slug: str) -> Optional[IncidentCategory]:
        result = await self.db.execute(
            select(IncidentCategory).where(IncidentCategory.slug == slug)
        )
        return result.scalar_one_or_none()

    async def create_category(self, **kwargs) -> IncidentCategory:
        cat = IncidentCategory(**kwargs)
        self.db.add(cat)
        await self.db.flush()
        await self.db.refresh(cat)
        return cat

    async def update_category(self, cat: IncidentCategory, **kwargs) -> IncidentCategory:
        for key, value in kwargs.items():
            if hasattr(cat, key) and value is not None:
                setattr(cat, key, value)
        await self.db.flush()
        return cat

    async def seed_categories(self):
        """Seed default incident categories if none exist."""
        from app.models.incident import IncidentCategory
        from app.db.seed_db import CATEGORIES_DATA
        for d in CATEGORIES_DATA:
            existing = await self.get_category_by_slug(d["slug"])
            if not existing:
                cat = IncidentCategory(**d)
                self.db.add(cat)
        await self.db.flush()

    # ── Incidents ──────────────────────────────────────────────

    async def get_by_id(self, incident_id: str) -> Optional[Incident]:
        result = await self.db.execute(
            self._base_query().where(Incident.id == incident_id)
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        title: str,
        description: str,
        category_id: str,
        severity: str,
        is_anonymous: bool,
        location_lat: float,
        location_lng: float,
        location_address: Optional[str],
        reporter_id: Optional[str],
    ) -> Incident:
        geom = f"SRID=4326;POINT({location_lng} {location_lat})"
        incident = Incident(
            title=title,
            description=description,
            category_id=category_id,
            severity=severity,
            is_anonymous=is_anonymous,
            location_lat=location_lat,
            location_lng=location_lng,
            location_address=location_address,
            location_geom=geom,
            # For anonymous reports: hide reporter_id from public/admin views
            # but store internally as anonymous_reporter_id for ownership tracking.
            reporter_id=None if is_anonymous else reporter_id,
            anonymous_reporter_id=reporter_id if is_anonymous else None,
        )
        self.db.add(incident)
        await self.db.flush()
        # Reload with relationships
        return await self.get_by_id(incident.id)

    async def update_status(
        self,
        incident: Incident,
        status: IncidentStatus,
        admin_note: Optional[str] = None,
        changed_by_id: Optional[str] = None,
    ) -> Incident:
        old_status = incident.status.value if hasattr(incident.status, "value") else str(incident.status)
        new_status = status.value if hasattr(status, "value") else str(status)
        incident.status = status
        if admin_note:
            incident.admin_note = admin_note
        await self.add_status_history(
            incident_id=incident.id,
            from_status=old_status,
            to_status=new_status,
            changed_by_id=changed_by_id,
            reason=admin_note,
        )
        await self.db.flush()
        return await self.get_by_id(incident.id)

    async def add_status_history(
        self,
        incident_id: str,
        from_status: str,
        to_status: str,
        changed_by_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> IncidentStatusHistory:
        history = IncidentStatusHistory(
            incident_id=incident_id,
            from_status=from_status,
            to_status=to_status,
            changed_by_id=changed_by_id,
            reason=reason,
        )
        self.db.add(history)
        await self.db.flush()
        return history

    async def get_status_history(self, incident_id: str) -> List[IncidentStatusHistory]:
        result = await self.db.execute(
            select(IncidentStatusHistory)
            .options(selectinload(IncidentStatusHistory.changed_by))
            .where(IncidentStatusHistory.incident_id == incident_id)
            .order_by(IncidentStatusHistory.created_at.desc())
        )
        return list(result.scalars().all())

    async def create_resolution_request(
        self,
        incident_id: str,
        requester_id: Optional[str],
        explanation: str,
        evidence_url: Optional[str] = None,
        status: ResolutionStatus = ResolutionStatus.PENDING,
        reviewed_by_id: Optional[str] = None,
        reviewed_at: Optional[datetime] = None,
        rejection_reason: Optional[str] = None,
    ) -> ResolutionRequest:
        req = ResolutionRequest(
            incident_id=incident_id,
            requester_id=requester_id,
            explanation=explanation,
            evidence_url=evidence_url,
            status=status,
            reviewed_by_id=reviewed_by_id,
            reviewed_at=reviewed_at,
            rejection_reason=rejection_reason,
        )
        self.db.add(req)
        await self.db.flush()
        return await self.get_resolution_request_by_id(req.id)

    async def get_resolution_request_by_id(self, request_id: str) -> Optional[ResolutionRequest]:
        result = await self.db.execute(
            select(ResolutionRequest)
            .options(
                selectinload(ResolutionRequest.requester),
                selectinload(ResolutionRequest.reviewed_by),
                selectinload(ResolutionRequest.incident),
            )
            .where(ResolutionRequest.id == request_id)
        )
        return result.scalar_one_or_none()

    async def get_resolution_requests(self, incident_id: str) -> List[ResolutionRequest]:
        result = await self.db.execute(
            select(ResolutionRequest)
            .options(
                selectinload(ResolutionRequest.requester),
                selectinload(ResolutionRequest.reviewed_by),
            )
            .where(ResolutionRequest.incident_id == incident_id)
            .order_by(ResolutionRequest.created_at.desc())
        )
        return list(result.scalars().all())

    async def update_resolution_request(self, req: ResolutionRequest, **kwargs) -> ResolutionRequest:
        for key, value in kwargs.items():
            if hasattr(req, key):
                setattr(req, key, value)
        await self.db.flush()
        return await self.get_resolution_request_by_id(req.id)

    async def soft_delete(self, incident: Incident) -> None:
        incident.deleted_at = datetime.now(timezone.utc)
        await self.db.flush()

    async def add_image(self, incident_id: str, filename: str, url: str) -> IncidentImage:
        image = IncidentImage(incident_id=incident_id, filename=filename, url=url)
        self.db.add(image)
        await self.db.flush()
        await self.db.refresh(image)
        return image

    async def list_incidents(
        self,
        page: int = 1,
        limit: int = 10,
        category_id: Optional[str] = None,
        severity: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        search: Optional[str] = None,
        reporter_id: Optional[str] = None,
        sort_by: Optional[str] = "severity",
    ) -> Tuple[List[Incident], int]:
        query = self._base_query()
        if category_id:
            query = query.where(Incident.category_id == category_id)
        if severity:
            sev_val = severity.upper() if isinstance(severity, str) else severity
            query = query.where(Incident.severity == sev_val)
        if status:
            stat_val = status.upper() if isinstance(status, str) else status
            query = query.where(Incident.status == stat_val)
        if date_from:
            dt_from = datetime.fromisoformat(date_from.replace("Z", "+00:00")) if isinstance(date_from, str) else date_from
            if dt_from.tzinfo is None:
                dt_from = dt_from.replace(tzinfo=timezone.utc)
            query = query.where(Incident.created_at >= dt_from)
        if date_to:
            dt_to = datetime.fromisoformat(date_to.replace("Z", "+00:00")) if isinstance(date_to, str) else date_to
            if isinstance(date_to, str) and len(date_to.strip()) <= 10:
                dt_to = dt_to.replace(hour=23, minute=59, second=59, microsecond=999999)
            if dt_to.tzinfo is None:
                dt_to = dt_to.replace(tzinfo=timezone.utc)
            query = query.where(Incident.created_at <= dt_to)
        if search:
            query = query.where(
                or_(
                    Incident.title.ilike(f"%{search}%"),
                    Incident.description.ilike(f"%{search}%"),
                )
            )
        if reporter_id:
            # Include incidents where:
            # - reporter_id matches (non-anonymous), OR
            # - anonymous_reporter_id matches (anonymous, internal ownership)
            query = query.where(
                or_(
                    Incident.reporter_id == reporter_id,
                    Incident.anonymous_reporter_id == reporter_id,
                )
            )

        # Count
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        # Custom Sorting
        sb = (sort_by or "severity").lower()
        if sb == "status":
            status_order = case(
                (Incident.status == IncidentStatus.PENDING, 1),
                (Incident.status == IncidentStatus.UNDER_REVIEW, 2),
                (Incident.status == IncidentStatus.APPROVED, 3),
                (Incident.status == IncidentStatus.RESOLVED_UNVERIFIED, 4),
                (Incident.status == IncidentStatus.RESOLVED, 5),
                (Incident.status == IncidentStatus.REJECTED, 6),
                else_=7
            )
            query = query.order_by(status_order, Incident.created_at.desc())
        elif sb in ["date_desc", "date", "created_at"]:
            query = query.order_by(Incident.created_at.desc())
        elif sb == "date_asc":
            query = query.order_by(Incident.created_at.asc())
        elif sb == "category":
            query = query.join(Incident.category).order_by(IncidentCategory.name.asc(), Incident.created_at.desc())
        else:
            # Default: Severity (CRITICAL -> HIGH -> MEDIUM -> LOW)
            severity_order = case(
                (Incident.severity == SeverityLevel.CRITICAL, 1),
                (Incident.severity == SeverityLevel.HIGH, 2),
                (Incident.severity == SeverityLevel.MEDIUM, 3),
                (Incident.severity == SeverityLevel.LOW, 4),
                else_=5
            )
            query = query.order_by(severity_order, Incident.created_at.desc())

        query = query.offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total

    async def list_nearby(
        self,
        lat: float,
        lng: float,
        radius_km: float = 5.0,
        limit: int = 50,
        category_id: Optional[str] = None,
        severity: Optional[str] = None,
        include_unapproved: bool = False,
    ) -> List[Incident]:
        """Use PostGIS ST_DWithin for spatial proximity search."""
        radius_m = radius_km * 1000
        point_wkt = f"SRID=4326;POINT({lng} {lat})"
        query = self._base_query().where(
            text(
                f"ST_DWithin(location_geom::geography, "
                f"ST_GeogFromText('{point_wkt}'), {radius_m})"
            )
        )
        if not include_unapproved:
            query = query.where(Incident.status == IncidentStatus.APPROVED)
        if category_id:
            query = query.where(Incident.category_id == category_id)
        if severity:
            query = query.where(Incident.severity == severity)
        query = query.limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def count_by_status(self) -> dict:
        result = await self.db.execute(
            select(Incident.status, func.count(Incident.id))
            .where(Incident.deleted_at.is_(None))
            .group_by(Incident.status)
        )
        return {row[0]: row[1] for row in result.all()}

    async def count_by_category(self) -> dict:
        result = await self.db.execute(
            select(IncidentCategory.name, func.count(Incident.id))
            .join(Incident, Incident.category_id == IncidentCategory.id)
            .where(Incident.deleted_at.is_(None))
            .group_by(IncidentCategory.name)
        )
        return {row[0]: row[1] for row in result.all()}

    async def count_by_severity(self) -> dict:
        result = await self.db.execute(
            select(Incident.severity, func.count(Incident.id))
            .where(Incident.deleted_at.is_(None))
            .group_by(Incident.severity)
        )
        return {row[0]: row[1] for row in result.all()}

    async def count_last_n_days(self, days: int = 30) -> int:
        cutoff = text(f"NOW() - INTERVAL '{days} days'")
        result = await self.db.execute(
            select(func.count(Incident.id)).where(
                and_(Incident.created_at >= cutoff, Incident.deleted_at.is_(None))
            )
        )
        return result.scalar_one()

    async def count_total(self) -> int:
        result = await self.db.execute(
            select(func.count(Incident.id)).where(Incident.deleted_at.is_(None))
        )
        return result.scalar_one()

    async def get_recent_incidents(self, limit: int = 5) -> List[Incident]:
        query = self._base_query().order_by(Incident.created_at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_daily_counts(self, days: int = 7) -> List[dict]:
        from datetime import datetime, timedelta, timezone
        from sqlalchemy import cast, Date
        
        now = datetime.now(timezone.utc)
        start_date = (now - timedelta(days=days - 1)).date()
        
        result = await self.db.execute(
            select(
                cast(Incident.created_at, Date).label("date"),
                func.count(Incident.id).label("count")
            )
            .where(
                and_(
                    Incident.created_at >= start_date,
                    Incident.deleted_at.is_(None)
                )
            )
            .group_by(cast(Incident.created_at, Date))
            .order_by(cast(Incident.created_at, Date).asc())
        )
        
        counts_map = {
            row.date.strftime("%Y-%m-%d") if hasattr(row.date, 'strftime') else str(row.date): row.count
            for row in result.all()
        }
        
        trend = []
        for i in range(days):
            d = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
            trend.append({"date": d, "count": counts_map.get(d, 0)})
            
        return trend


    async def list_my_incidents(
        self,
        user_id: str,
        page: int = 1,
        limit: int = 15,
    ) -> Tuple[List[Incident], int]:
        """
        Returns all incidents that belong to the authenticated user,
        including anonymous ones (matched via anonymous_reporter_id).
        reporter fields on anonymous incidents are stripped by the service
        before returning to any API caller.
        """
        query = (
            self._base_query()
            .where(
                or_(
                    Incident.reporter_id == user_id,
                    Incident.anonymous_reporter_id == user_id,
                )
            )
            .order_by(Incident.created_at.desc())
        )

        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        query = query.offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all()), total
