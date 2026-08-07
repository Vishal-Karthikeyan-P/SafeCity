from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.models.alert import AlertType

class AlertBase(BaseModel):
    title: str = Field(..., max_length=255)
    message: str
    alert_type: AlertType
    location_lat: Optional[float] = None
    location_lng: Optional[float] = None
    radius_km: Optional[float] = None

class AlertCreate(AlertBase):
    expires_in_hours: Optional[int] = 24

class AlertSchema(AlertBase):
    id: str
    is_active: bool
    expires_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

class AlertListResponse(BaseModel):
    items: List[AlertSchema]
    total: int
    page: int
    limit: int
    pages: int
