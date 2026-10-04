"""
Notification ORM model — extended with unified notification types,
metadata_json for deep-link context, sos_id, and dedup_key.
"""
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class NotificationType(str, enum.Enum):
    # Existing
    INCIDENT_UPDATE = "incident_update"
    SYSTEM = "system"
    ALERT = "alert"
    ADMIN_MESSAGE = "admin_message"
    # Emergency contacts
    EMERGENCY_CONTACT_REQUEST = "emergency_contact_request"
    EMERGENCY_CONTACT_ACCEPTED = "emergency_contact_accepted"
    EMERGENCY_CONTACT_REJECTED = "emergency_contact_rejected"
    # SOS
    SOS_ALERT = "sos_alert"
    SOS_RESOLVED = "sos_resolved"
    # Location-based
    NEARBY_INCIDENT = "nearby_incident"
    UNSAFE_AREA = "unsafe_area"
    # Resolution workflow
    RESOLUTION_REQUEST = "resolution_request"
    RESOLUTION_APPROVED = "resolution_approved"
    RESOLUTION_REJECTED = "resolution_rejected"
    # Community
    COMMUNITY_ALERT = "community_alert"


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[NotificationType] = mapped_column(
        sa.Enum(NotificationType, native_enum=False), nullable=False, default=NotificationType.SYSTEM
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(sa.Boolean, default=False, nullable=False, index=True)

    # FKs for linking to specific objects
    incident_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("incidents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sos_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("sos_requests.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Extra JSON metadata for client-side deep-link navigation
    # e.g. {"contact_request_id": "...", "lat": 11.02, "lng": 76.95}
    metadata_json: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)

    # Deduplication key — prevents generating the same notification twice
    # Format: "{type}:{object_id}" e.g. "nearby_incident:abc123"
    dedup_key: Mapped[Optional[str]] = mapped_column(sa.String(255), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")  # type: ignore[name-defined]
    incident: Mapped[Optional["Incident"]] = relationship("Incident")  # type: ignore[name-defined]

    __table_args__ = (
        sa.Index("ix_notifications_user_created", "user_id", "created_at"),
        sa.Index("ix_notifications_dedup", "user_id", "dedup_key"),
    )
