"""
Auth Router — /api/v1/auth
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, RegisterRequest, TokenResponse, RefreshRequest,
    ForgotPasswordRequest, VerifyOTPRequest, VerifyOTPResponse,
    ResetPasswordRequest, GenericMessageResponse
)
from app.schemas.user import UserSchema
from app.services.auth_service import AuthService
from app.services.password_reset_service import PasswordResetService

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new citizen account."""
    service = AuthService(db)
    return await service.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Refresh access token using a valid refresh token."""
    service = AuthService(db)
    return await service.refresh(data)


@router.post("/forgot-password", response_model=GenericMessageResponse)
async def forgot_password(data: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 1: Request a numeric OTP sent via email for password reset.
    Returns a generic success message regardless of whether the email exists.
    """
    service = PasswordResetService(db)
    return await service.request_otp(data.email)


@router.post("/verify-reset-otp", response_model=VerifyOTPResponse)
async def verify_reset_otp(data: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 2: Verify the 6-digit OTP received via email.
    Returns a reset token to use in Step 3.
    """
    service = PasswordResetService(db)
    return await service.verify_otp(data.email, data.otp)


@router.post("/reset-password", response_model=GenericMessageResponse)
async def reset_password(data: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 3: Reset password using the reset token obtained in Step 2.
    """
    if data.new_password != data.confirm_password:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="New password and confirm password do not match.",
        )
    service = PasswordResetService(db)
    return await service.reset_password(data.reset_token, data.new_password)


@router.get("/me", response_model=UserSchema)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get the currently authenticated user."""
    return current_user

