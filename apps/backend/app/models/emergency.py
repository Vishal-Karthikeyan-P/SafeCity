"""
Emergency-related ORM models: SOSRequest, EmergencyContact
"""
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional, List

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geography

from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class SOSStatus(str, enum.Enum):
    ACTIVE = "active"
    RESOLVED = "resolved"
    FALSE_ALARM = "false_alarm"


class ContactRequestStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"


class ContactRequest(Base):
    """User-to-user in-app emergency contact request."""
    __tablename__ = "contact_requests"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    # The user who sent the request
    requester_id: Mapped[str] = mapped_column(
        sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    # The user being asked to be an emergency contact
    contact_id: Mapped[str] = mapped_column(
        sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False, index=True
    )
    status: Mapped[ContactRequestStatus] = mapped_column(
        sa.Enum(ContactRequestStatus, native_enum=False),
        nullable=False,
        default=ContactRequestStatus.PENDING,
        index=True
    )
    message: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    requester: Mapped["User"] = relationship("User", foreign_keys=[requester_id])  # type: ignore
    contact: Mapped["User"] = relationship("User", foreign_keys=[contact_id])  # type: ignore

    __table_args__ = (
        sa.UniqueConstraint("requester_id", "contact_id", name="uq_contact_request_pair"),
    )


class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    phone: Mapped[str] = mapped_column(sa.String(50), nullable=False)
    contact_relation: Mapped[Optional[str]] = mapped_column(sa.String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="emergency_contacts") # type: ignore[name-defined]


class SOSRequest(Base):
    __tablename__ = "sos_requests"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    
    # Location
    location_lat: Mapped[float] = mapped_column(sa.Float, nullable=False)
    location_lng: Mapped[float] = mapped_column(sa.Float, nullable=False)
    location_geom: Mapped[Optional[object]] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    
    status: Mapped[SOSStatus] = mapped_column(
        sa.Enum(SOSStatus), nullable=False, default=SOSStatus.ACTIVE, index=True
    )
    
    audio_recording_url: Mapped[Optional[str]] = mapped_column(sa.String(512), nullable=True)
    video_recording_url: Mapped[Optional[str]] = mapped_column(sa.String(512), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    resolved_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="sos_requests") # type: ignore[name-defined]
