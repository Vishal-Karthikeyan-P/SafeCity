"""
Pydantic schemas for contact requests and push token registration.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, field_validator


class UserSearchResult(BaseModel):
    id: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


class ContactRequestSend(BaseModel):
    contact_id: str
    message: Optional[str] = None

    @field_validator("message")
    @classmethod
    def trim_message(cls, v):
        if v:
            return v.strip()[:500]
        return v


class ContactRequestSchema(BaseModel):
    id: str
    requester_id: str
    contact_id: str
    status: str
    message: Optional[str] = None
    requester: Optional[UserSearchResult] = None
    contact: Optional[UserSearchResult] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegisterPushTokenRequest(BaseModel):
    push_token: str

    @field_validator("push_token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("ExponentPushToken["):
            raise ValueError("Invalid Expo push token format")
        return v


class LocationCheckRequest(BaseModel):
    """Used by mobile client to check for location-based notification triggers."""
    lat: float
    lng: float

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v):
        if not -90 <= v <= 90:
            raise ValueError("lat must be between -90 and 90")
        return v

    @field_validator("lng")
    @classmethod
    def validate_lng(cls, v):
        if not -180 <= v <= 180:
            raise ValueError("lng must be between -180 and 180")
        return v
