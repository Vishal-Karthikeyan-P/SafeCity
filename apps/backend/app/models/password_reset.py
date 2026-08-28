import uuid
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class PasswordResetOTP(Base):
    __tablename__ = "password_reset_otps"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    otp_hash: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), nullable=False
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    attempt_count: Mapped[int] = mapped_column(sa.Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expires_at

    def is_used(self) -> bool:
        return self.used_at is not None

    def is_exhausted(self) -> bool:
        return self.attempt_count >= 5

    def is_valid(self) -> bool:
        return not self.is_expired() and not self.is_used() and not self.is_exhausted()

    def __repr__(self) -> str:
        return f"<PasswordResetOTP user_id={self.user_id} expires_at={self.expires_at}>"
