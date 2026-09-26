from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.emergency import SOSStatus

class EmergencyContactBase(BaseModel):
    name: str = Field(..., max_length=255)
    phone: str = Field(..., max_length=50)
    contact_relation: Optional[str] = Field(None, max_length=100)

class EmergencyContactCreate(EmergencyContactBase):
    pass

class EmergencyContactUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    contact_relation: Optional[str] = Field(None, max_length=100)

class EmergencyContactSchema(EmergencyContactBase):
    id: str
    user_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class SOSRequestBase(BaseModel):
    location_lat: float
    location_lng: float

class SOSRequestCreate(SOSRequestBase):
    pass

class SOSLocationUpdate(SOSRequestBase):
    pass


class SOSRequestSchema(SOSRequestBase):
    id: str
    user_id: str
    status: SOSStatus
    audio_recording_url: Optional[str] = None
    video_recording_url: Optional[str] = None
    created_at: datetime
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True

class SOSListResponse(BaseModel):
    items: List[SOSRequestSchema]
    total: int
    page: int
    limit: int
    pages: int
