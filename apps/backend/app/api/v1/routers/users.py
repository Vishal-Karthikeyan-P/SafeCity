"""
Users Router — /api/v1/users
"""
from typing import Optional
import os
import uuid

import aiofiles
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserSchema, UpdateProfileRequest, ChangePasswordRequest

router = APIRouter()


@router.get("/me", response_model=UserSchema)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserSchema)
async def update_my_profile(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    if data.full_name:
        await repo.update(current_user, full_name=data.full_name)
    profile_data = data.model_dump(exclude={"full_name"}, exclude_none=True)
    if profile_data:
        await repo.update_profile(current_user, **profile_data)
    return await repo.get_by_id(current_user.id)


@router.post("/me/avatar", response_model=UserSchema)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(status_code=400, detail="Invalid image format")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Avatar must be < 5MB")
    unique_name = f"avatar_{current_user.id}{ext}"
    save_path = os.path.join(settings.UPLOAD_DIR, unique_name)
    async with aiofiles.open(save_path, "wb") as f:
        await f.write(content)
    url = f"/uploads/{unique_name}"
    repo = UserRepository(db)
    return await repo.update_avatar(current_user, url)


@router.post("/me/change-password")
async def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    repo = UserRepository(db)
    new_hash = hash_password(data.new_password)
    await repo.update(current_user, hashed_password=new_hash)
    return {"message": "Password changed successfully"}
