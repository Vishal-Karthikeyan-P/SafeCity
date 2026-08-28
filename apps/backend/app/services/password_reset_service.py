"""
Password Reset Service -- OTP-based forgot-password flow.

Security design:
- OTP is a 6-digit random number, stored as bcrypt hash (never plaintext).
- Generic response always returned to prevent user enumeration.
- Max 5 verification attempts per OTP before it is invalidated.
- 60-second cooldown between OTP requests per email.
- Reset token is a short-lived JWT (15 min, type=password_reset).
- Old OTP records for a user are deleted before creating a new one.
"""
import secrets
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models.password_reset import PasswordResetOTP
from app.repositories.user_repository import UserRepository
from app.services.email_service import send_otp_email

# Import JWT utilities
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# Reset token parameters
RESET_TOKEN_EXPIRE_MINUTES = 15
RESET_TOKEN_TYPE = "password_reset"


def _create_reset_token(user_id: str) -> str:
    """Create a short-lived JWT for the password reset step."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "type": RESET_TOKEN_TYPE},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def _decode_reset_token(token: str) -> Optional[str]:
    """Decode and validate a password reset JWT. Returns user_id or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != RESET_TOKEN_TYPE:
            return None
        return payload.get("sub")
    except JWTError:
        return None


def _generate_otp() -> str:
    """Generate a cryptographically secure 6-digit OTP."""
    return f"{secrets.randbelow(1000000):06d}"


class PasswordResetService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)

    async def request_otp(self, email: str) -> dict:
        """
        Step 1: Request OTP for password reset.
        Always returns a generic success message to prevent user enumeration.
        """
        expiry_minutes = settings.OTP_EXPIRY_MINUTES

        user = await self.user_repo.get_by_email(email)
        if user and user.is_active:
            # Check rate limiting: prevent requests more than once per 60 seconds
            existing = await self._get_existing_otp(user.id)
            if existing:
                cooldown_cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
                if existing.created_at.replace(tzinfo=timezone.utc) > cooldown_cutoff:
                    # Still in cooldown -- return generic message silently
                    return {"message": "If the email is registered, an OTP has been sent."}

            # Delete all old OTP records for this user
            await self.db.execute(
                delete(PasswordResetOTP).where(PasswordResetOTP.user_id == user.id)
            )
            await self.db.flush()

            # Generate and hash OTP
            otp = _generate_otp()
            otp_hash = hash_password(otp)
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)

            record = PasswordResetOTP(
                user_id=user.id,
                otp_hash=otp_hash,
                expires_at=expires_at,
            )
            self.db.add(record)
            await self.db.commit()

            # Send email (non-blocking; failure does not expose whether email exists)
            await send_otp_email(email, otp, expiry_minutes)

        # Always return the same generic message
        return {"message": "If the email is registered, an OTP has been sent."}

    async def verify_otp(self, email: str, otp: str) -> dict:
        """
        Step 2: Verify OTP.
        Returns a short-lived reset token on success.
        """
        user = await self.user_repo.get_by_email(email)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP.",
            )

        record = await self._get_existing_otp(user.id)
        if not record:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired OTP.",
            )

        # Check validity (expiry, used, exhausted)
        if not record.is_valid():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="OTP has expired or has already been used. Please request a new one.",
            )

        # Verify the OTP hash
        if not verify_password(otp, record.otp_hash):
            # Increment attempt count
            record.attempt_count += 1
            await self.db.commit()
            remaining = max(0, 5 - record.attempt_count)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid OTP. {remaining} attempt(s) remaining." if remaining > 0
                       else "Maximum OTP attempts reached. Please request a new OTP.",
            )

        # Mark as used
        record.used_at = datetime.now(timezone.utc)
        await self.db.commit()

        reset_token = _create_reset_token(user.id)
        return {"reset_token": reset_token, "message": "OTP verified successfully."}

    async def reset_password(self, reset_token: str, new_password: str) -> dict:
        """
        Step 3: Reset the password using a validated reset token.
        Invalidates the OTP record after success.
        """
        user_id = _decode_reset_token(reset_token)
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired reset token. Please restart the password reset process.",
            )

        user = await self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User not found or account is inactive.",
            )

        # Hash new password and save
        new_hash = hash_password(new_password)
        await self.user_repo.update(user, hashed_password=new_hash)

        # Clean up all OTP records for this user
        await self.db.execute(
            delete(PasswordResetOTP).where(PasswordResetOTP.user_id == user_id)
        )
        await self.db.commit()

        logger.info("Password reset successfully for user_id=%s", user_id)
        return {"message": "Password reset successfully. You can now log in with your new password."}

    async def _get_existing_otp(self, user_id: str) -> Optional[PasswordResetOTP]:
        """Get the most recent OTP record for a user."""
        result = await self.db.execute(
            select(PasswordResetOTP)
            .where(PasswordResetOTP.user_id == user_id)
            .order_by(PasswordResetOTP.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
