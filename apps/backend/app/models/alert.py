"""
Community Alert ORM model
"""
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column
from geoalchemy2 import Geography

from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class AlertType(str, enum.Enum):
    NEARBY_INCIDENT = "nearby_incident"
    HIGH_RISK_AREA = "high_risk_area"
    EMERGENCY_NOTICE = "emergency_notice"
    SYSTEM_ANNOUNCEMENT = "system_announcement"

class CommunityAlert(Base):
    __tablename__ = "community_alerts"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    message: Mapped[str] = mapped_column(sa.Text, nullable=False)
    alert_type: Mapped[AlertType] = mapped_column(
        sa.Enum(AlertType), nullable=False, default=AlertType.SYSTEM_ANNOUNCEMENT, index=True
    )
    # Scope of delivery: "all_users" (broadcast) or "location_based"
    target_scope: Mapped[str] = mapped_column(
        sa.String(30), nullable=False, default="all_users", index=True
    )
    
    # Optional geospatial area for the alert (radius around a point)
    location_lat: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    location_lng: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    radius_km: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    
    # PostGIS geography point for spatial queries (to see if user is in alert zone)
    location_geom: Mapped[Optional[object]] = mapped_column(
        Geography(geometry_type="POINT", srid=4326), nullable=True
    )
    
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True, nullable=False, index=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        sa.DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )

    def __repr__(self) -> str:
        return f"<CommunityAlert id={self.id} title={self.title!r}>"
