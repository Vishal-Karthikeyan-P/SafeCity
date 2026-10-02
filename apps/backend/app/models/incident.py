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
    RESOLVED_UNVERIFIED = "resolved_unverified"
    RESOLVED = "resolved"


class ResolutionStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


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
    resolution_requests: Mapped[List["ResolutionRequest"]] = relationship(
        "ResolutionRequest",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="ResolutionRequest.created_at.desc()",
    )
    status_history: Mapped[List["IncidentStatusHistory"]] = relationship(
        "IncidentStatusHistory",
        back_populates="incident",
        cascade="all, delete-orphan",
        order_by="IncidentStatusHistory.created_at.desc()",
    )

    __table_args__ = (
        sa.Index("ix_incidents_status_created", "status", "created_at"),
        sa.Index("ix_incidents_cat_status", "category_id", "status"),
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


class ResolutionRequest(Base):
    __tablename__ = "resolution_requests"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    incident_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    requester_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    status: Mapped[ResolutionStatus] = mapped_column(
        sa.Enum(ResolutionStatus, native_enum=False, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
        default=ResolutionStatus.PENDING,
        index=True,
    )
    explanation: Mapped[str] = mapped_column(sa.Text, nullable=False)
    evidence_url: Mapped[Optional[str]] = mapped_column(sa.String(512), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    reviewed_by_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="resolution_requests")
    requester: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[requester_id]
    )
    reviewed_by: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[reviewed_by_id]
    )


class IncidentStatusHistory(Base):
    __tablename__ = "incident_status_history"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    incident_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("incidents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_status: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    to_status: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    changed_by_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    reason: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    # Relationships
    incident: Mapped["Incident"] = relationship("Incident", back_populates="status_history")
    changed_by: Mapped[Optional["User"]] = relationship(  # type: ignore[name-defined]
        "User", foreign_keys=[changed_by_id]
    )

