"""
Incident Repository — all DB access for incidents and categories
"""
import math
from datetime import datetime, timezone
from typing import List, Optional, Tuple

from sqlalchemy import and_, func, or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.incident import Incident, IncidentCategory, IncidentImage, IncidentStatus


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
        from shared.constants import INCIDENT_CATEGORIES  # fallback to hardcoded
        defaults = [
            {"name": "Crime", "slug": "crime", "icon": "🚨", "color": "#EF4444"},
            {"name": "Harassment", "slug": "harassment", "icon": "⚠️", "color": "#F97316"},
            {"name": "Poor Lighting", "slug": "poor_lighting", "icon": "💡", "color": "#EAB308"},
            {"name": "Road Hazard", "slug": "road_hazard", "icon": "🚧", "color": "#F59E0B"},
            {"name": "Accident", "slug": "accident", "icon": "🚗", "color": "#EC4899"},
            {"name": "Public Infrastructure", "slug": "public_infrastructure", "icon": "🏗️", "color": "#8B5CF6"},
            {"name": "Emergency", "slug": "emergency", "icon": "🆘", "color": "#DC2626"},
            {"name": "Other", "slug": "other", "icon": "📋", "color": "#6B7280"},
        ]
        for d in defaults:
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
            reporter_id=None if is_anonymous else reporter_id,
        )
        self.db.add(incident)
        await self.db.flush()
        # Reload with relationships
        return await self.get_by_id(incident.id)

    async def update_status(
        self, incident: Incident, status: str, admin_note: Optional[str] = None
    ) -> Incident:
        incident.status = status
        if admin_note:
            incident.admin_note = admin_note
        await self.db.flush()
        return await self.get_by_id(incident.id)

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
            query = query.where(Incident.reporter_id == reporter_id)

        # Count
        count_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_q)).scalar_one()

        query = query.order_by(Incident.created_at.desc()).offset((page - 1) * limit).limit(limit)
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
        from sqlalchemy import cast, Date
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
