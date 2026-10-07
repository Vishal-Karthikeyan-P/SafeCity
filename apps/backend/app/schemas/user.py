"""
User Pydantic schemas
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserProfileSchema(BaseModel):
    id: str
    user_id: str
    avatar_url: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserSchema(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    created_at: datetime
    updated_at: datetime
    profile: Optional[UserProfileSchema] = None
    incidents_count: int = 0

    class Config:
        from_attributes = True


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    bio: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    items: list[UserSchema]
    total: int
    page: int
    limit: int
    pages: int
