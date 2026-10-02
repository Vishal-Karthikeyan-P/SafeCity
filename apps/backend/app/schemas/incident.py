"""
Incident Pydantic schemas
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, field_validator

from app.models.incident import SeverityLevel, IncidentStatus


class CategorySchema(BaseModel):
    id: str
    name: str
    slug: str
    description: Optional[str] = None
    icon: str
    color: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CategoryCreateRequest(BaseModel):
    name: str
    slug: str
    description: Optional[str] = None
    icon: str = "📋"
    color: str = "#6B7280"


class CategoryUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None


class IncidentImageSchema(BaseModel):
    id: str
    incident_id: str
    url: str
    filename: str
    created_at: datetime

    class Config:
        from_attributes = True


class ReporterSummary(BaseModel):
    id: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


class ResolutionRequestSchema(BaseModel):
    id: str
    incident_id: str
    requester_id: Optional[str] = None
    requester: Optional[ReporterSummary] = None
    status: str
    explanation: str
    evidence_url: Optional[str] = None
    rejection_reason: Optional[str] = None
    reviewed_by_id: Optional[str] = None
    reviewed_by: Optional[ReporterSummary] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IncidentStatusHistorySchema(BaseModel):
    id: str
    incident_id: str
    from_status: str
    to_status: str
    changed_by_id: Optional[str] = None
    changed_by: Optional[ReporterSummary] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class IncidentSchema(BaseModel):
    id: str
    title: str
    description: str
    category_id: str
    category: CategorySchema
    severity: str
    status: str
    is_anonymous: bool
    location_address: Optional[str] = None
    location_lat: float
    location_lng: float
    admin_note: Optional[str] = None
    images: List[IncidentImageSchema] = []
    resolution_requests: List[ResolutionRequestSchema] = []
    status_history: List[IncidentStatusHistorySchema] = []
    reporter_id: Optional[str] = None
    reporter: Optional[ReporterSummary] = None
    created_at: datetime
    updated_at: datetime
    deleted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CreateIncidentRequest(BaseModel):
    title: str
    description: str
    category_id: str
    severity: SeverityLevel = SeverityLevel.MEDIUM
    is_anonymous: bool = False
    location_address: Optional[str] = None
    location_lat: float
    location_lng: float

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        if len(v.strip()) < 5:
            raise ValueError("Title must be at least 5 characters")
        return v.strip()

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str) -> str:
        if len(v.strip()) < 10:
            raise ValueError("Description must be at least 10 characters")
        return v.strip()

    @field_validator("location_lat")
    @classmethod
    def validate_lat(cls, v: float) -> float:
        if not (-90 <= v <= 90):
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("location_lng")
    @classmethod
    def validate_lng(cls, v: float) -> float:
        if not (-180 <= v <= 180):
            raise ValueError("Longitude must be between -180 and 180")
        return v


class ResolutionRequestCreate(BaseModel):
    explanation: str
    evidence_url: Optional[str] = None

    @field_validator("explanation")
    @classmethod
    def validate_explanation(cls, v: str) -> str:
        if len(v.strip()) < 5:
            raise ValueError("Explanation must be at least 5 characters")
        return v.strip()


class ResolutionRequestReview(BaseModel):
    action: str  # "approve" or "reject"
    rejection_reason: Optional[str] = None

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ("approve", "reject"):
            raise ValueError("Action must be 'approve' or 'reject'")
        return clean


class UpdateIncidentStatusRequest(BaseModel):
    status: IncidentStatus
    admin_note: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def parse_status(cls, v: any) -> any:
        if isinstance(v, str):
            clean = v.strip().lower()
            for member in IncidentStatus:
                if member.value == clean or member.name.lower() == clean:
                    return member
        return v


class IncidentListResponse(BaseModel):
    items: List[IncidentSchema]
    total: int
    page: int
    limit: int
    pages: int


class IncidentFilters(BaseModel):
    category_id: Optional[str] = None
    severity: Optional[str] = None
    status: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    search: Optional[str] = None
    sort_by: Optional[str] = "severity"
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = None
    page: int = 1
    limit: int = 10

