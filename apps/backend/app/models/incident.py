"""
Incident-related ORM models: IncidentCategory, Incident, IncidentImage
Uses PostGIS Geography type for spatial data.
"""
import uuid
import enum
from datetime import datetime, timezone
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class SeverityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class IncidentStatus(str, enum.Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    RESOLVED = "resolved"


class IncidentCategory(Base):
    __tablename__ = "incident_categories"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(sa.String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(sa.String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    icon: Mapped[str] = mapped_column(sa.String(10), nullable=False, default="📋")
    color: Mapped[str] = mapped_column(sa.String(20), nullable=False, default="#6B7280")
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    incidents: Mapped[List["Incident"]] = relationship("Incident", back_populates="category")


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    description: Mapped[str] = mapped_column(sa.Text, nullable=False)

    # Category FK
    category_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("incident_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )

    severity: Mapped[SeverityLevel] = mapped_column(
        sa.Enum(SeverityLevel), nullable=False, default=SeverityLevel.MEDIUM, index=True
    )
    status: Mapped[IncidentStatus] = mapped_column(
        sa.Enum(IncidentStatus), nullable=False, default=IncidentStatus.PENDING, index=True
    )
    is_anonymous: Mapped[bool] = mapped_column(sa.Boolean, default=False, nullable=False)

    # Location
    location_address: Mapped[Optional[str]] = mapped_column(sa.String(512), nullable=True)
    location_lat: Mapped[float] = mapped_column(sa.Float, nullable=False)
    location_lng: Mapped[float] = mapped_column(sa.Float, nullable=False)
    # PostGIS geography point for spatial queries
    location_geom: Mapped[Optional[object]] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )

    # Admin note
    admin_note: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)

    # Reporter (nullable for anonymous)
    reporter_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    category: Mapped["IncidentCategory"] = relationship(
        "IncidentCategory", back_populates="incidents"
    )
    reporter: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", back_populates="incidents", foreign_keys=[reporter_id]
    )
    images: Mapped[List["IncidentImage"]] = relationship(
        "IncidentImage", back_populates="incident", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Incident id={self.id} title={self.title!r}>"


class IncidentImage(Base):
    __tablename__ = "incident_images"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    incident_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    filename: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    url: Mapped[str] = mapped_column(sa.String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="images")
