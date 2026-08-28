"""
Notification Pydantic schemas
"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class NotificationSchema(BaseModel):
    id: str
    user_id: str
    type: str
    title: str
    message: str
    is_read: bool
    incident_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    items: List[NotificationSchema]
    total: int
    unread_count: int


class AdminStatsResponse(BaseModel):
    total_incidents: int
    pending: int
    under_review: int
    approved: int
    rejected: int
    resolved: int
    by_category: dict
    by_severity: dict
    last_30_days: int
    total_users: int
    active_users: int
    new_users_this_month: int
    recent_incidents: List[dict] = []
    daily_trend: List[dict] = []

