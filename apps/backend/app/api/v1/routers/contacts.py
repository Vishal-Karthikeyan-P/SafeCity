"""
Contacts Router — /api/v1/contacts
User-to-user emergency contact request workflow.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.contacts import (
    ContactRequestSend,
    ContactRequestSchema,
    UserSearchResult,
    RegisterPushTokenRequest,
    LocationCheckRequest,
)
from app.services.contact_request_service import ContactRequestService
from app.services.location_notification_service import LocationNotificationService

router = APIRouter()


# ── User Search ────────────────────────────────────────────────────────────────

@router.get("/search", response_model=List[UserSearchResult])
async def search_users(
    q: str = Query(..., min_length=2, description="Search by name or email"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Search SafeCity users to send emergency contact requests."""
    svc = ContactRequestService(db)
    return await svc.search_users(q, current_user.id)


# ── Contact Requests ───────────────────────────────────────────────────────────

@router.post("/requests", response_model=ContactRequestSchema, status_code=201)
async def send_contact_request(
    data: ContactRequestSend,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send an emergency contact request to another SafeCity user."""
    svc = ContactRequestService(db)
    return await svc.send_request(current_user.id, data)


@router.get("/requests/incoming", response_model=List[ContactRequestSchema])
async def list_incoming_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List pending emergency contact requests received by the current user."""
    svc = ContactRequestService(db)
    return await svc.list_incoming(current_user.id)


@router.get("/requests/outgoing", response_model=List[ContactRequestSchema])
async def list_outgoing_requests(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List emergency contact requests sent by the current user."""
    svc = ContactRequestService(db)
    return await svc.list_outgoing(current_user.id)


@router.patch("/requests/{request_id}/accept", response_model=ContactRequestSchema)
async def accept_contact_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept an incoming emergency contact request."""
    svc = ContactRequestService(db)
    return await svc.respond_to_request(request_id, current_user.id, accept=True)


@router.patch("/requests/{request_id}/reject", response_model=ContactRequestSchema)
async def reject_contact_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Reject an incoming emergency contact request."""
    svc = ContactRequestService(db)
    return await svc.respond_to_request(request_id, current_user.id, accept=False)


@router.delete("/requests/{request_id}", status_code=204)
async def revoke_contact_request(
    request_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a pending request (requester) or remove an accepted contact (either party)."""
    svc = ContactRequestService(db)
    await svc.revoke_or_delete(request_id, current_user.id)


# ── Accepted Contacts ──────────────────────────────────────────────────────────

@router.get("", response_model=List[ContactRequestSchema])
async def list_accepted_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all accepted emergency contacts for the current user."""
    svc = ContactRequestService(db)
    return await svc.list_accepted(current_user.id)


# ── Push Token Registration ────────────────────────────────────────────────────

@router.post("/push-token", status_code=204)
async def register_push_token(
    data: RegisterPushTokenRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register/update the Expo push token for the current user."""
    current_user.push_token = data.push_token
    await db.commit()


# ── Location-Based Notification Check ─────────────────────────────────────────

@router.post("/location-check")
async def location_notification_check(
    data: LocationCheckRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Called by mobile when user location changes.
    Checks for nearby incidents and unsafe area entry.
    Only triggers when location permission is granted (mobile enforces this before calling).
    """
    svc = LocationNotificationService(db)
    result = await svc.check_and_notify(
        user_id=current_user.id,
        user_name=current_user.full_name,
        push_token=current_user.push_token,
        lat=data.lat,
        lng=data.lng,
    )
    return {"triggered": result}
