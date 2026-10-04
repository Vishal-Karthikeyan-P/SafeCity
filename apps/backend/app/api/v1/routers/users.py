"""
Users Router — /api/v1/users
"""
from typing import Optional
import os
import uuid

import aiofiles
from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserSchema, UpdateProfileRequest, ChangePasswordRequest
from app.schemas.emergency import EmergencyContactCreate, EmergencyContactUpdate, EmergencyContactSchema
from app.services.emergency_service import EmergencyService

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

@router.delete("/me", status_code=204)
async def delete_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    repo = UserRepository(db)
    # Perform soft or hard delete depending on policy. We will soft-delete here for safety.
    await repo.update(current_user, is_active=False)
    return None

# ── Emergency Contacts ───────────────────────────────────────

@router.get("/me/contacts", response_model=list[EmergencyContactSchema])
async def list_emergency_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = EmergencyService(db)
    return await service.list_contacts(current_user.id)

@router.post("/me/contacts", response_model=EmergencyContactSchema, status_code=201)
async def add_emergency_contact(
    data: EmergencyContactCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = EmergencyService(db)
    return await service.add_contact(current_user.id, data)

@router.patch("/me/contacts/{contact_id}", response_model=EmergencyContactSchema)
async def update_emergency_contact(
    contact_id: str,
    data: EmergencyContactUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = EmergencyService(db)
    return await service.update_contact(contact_id, current_user.id, data)

@router.delete("/me/contacts/{contact_id}", status_code=204)
async def delete_emergency_contact(
    contact_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = EmergencyService(db)
    await service.delete_contact(contact_id, current_user.id)
    return None


class UserLocationUpdate(BaseModel):
    lat: float
    lng: float


@router.post("/me/location", status_code=204)
async def update_my_location(
    data: UserLocationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Update the authenticated user's current known coordinates.
    Only called when the user has granted location permission.
    """
    from geoalchemy2.shape import from_shape
    from shapely.geometry import Point
    from app.models.user import utcnow

    current_user.last_location_lat = data.lat
    current_user.last_location_lng = data.lng
    current_user.last_location_geom = from_shape(Point(data.lng, data.lat), srid=4326)
    current_user.location_updated_at = utcnow()
    await db.commit()


