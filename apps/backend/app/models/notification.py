"""
Notification ORM model
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
    INCIDENT_UPDATE = "incident_update"
    SYSTEM = "system"
    ALERT = "alert"
    ADMIN_MESSAGE = "admin_message"


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
        sa.Enum(NotificationType), nullable=False, default=NotificationType.SYSTEM
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(sa.Boolean, default=False, nullable=False, index=True)
    incident_id: Mapped[Optional[str]] = mapped_column(
        sa.String(36),
        sa.ForeignKey("incidents.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")  # type: ignore[name-defined]
    incident: Mapped[Optional["Incident"]] = relationship("Incident")  # type: ignore[name-defined]

    __table_args__ = (
        sa.Index("ix_notifications_user_created", "user_id", "created_at"),
    )

