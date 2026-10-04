"""
Contact Request Service — user-to-user emergency contact workflow.
Handles sending, accepting, rejecting, revoking, and SOS notifications.
"""
import json
import logging
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import NotificationType
from app.models.emergency import ContactRequestStatus
from app.repositories.contact_request_repository import ContactRequestRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.user_repository import UserRepository
from app.schemas.contacts import ContactRequestSend, ContactRequestSchema, UserSearchResult
from app.services.push_service import send_push_notification

logger = logging.getLogger(__name__)


class ContactRequestService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ContactRequestRepository(db)
        self.notif_repo = NotificationRepository(db)

    async def search_users(self, query: str, current_user_id: str) -> List[UserSearchResult]:
        if len(query.strip()) < 2:
            raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
        users = await self.repo.search_users(query.strip(), current_user_id)
        return [UserSearchResult(id=u.id, full_name=u.full_name, email=u.email) for u in users]

    async def send_request(
        self, requester_id: str, data: ContactRequestSend
    ) -> ContactRequestSchema:
        if requester_id == data.contact_id:
            raise HTTPException(status_code=400, detail="You cannot add yourself as an emergency contact")

        # Check for existing relationship (pending or accepted)
        existing = await self.repo.get_existing(requester_id, data.contact_id)
        if existing:
            if existing.status == ContactRequestStatus.PENDING:
                raise HTTPException(
                    status_code=409,
                    detail="A pending request already exists between these users"
                )
            if existing.status == ContactRequestStatus.ACCEPTED:
                raise HTTPException(
                    status_code=409,
                    detail="You are already emergency contacts"
                )
            if existing.status == ContactRequestStatus.REJECTED:
                # Allow re-sending after rejection — update to pending
                existing.status = ContactRequestStatus.PENDING
                existing.message = data.message
                await self.db.flush()
                await self.db.refresh(existing)
                req = existing
            else:
                req = existing
        else:
            req = await self.repo.send_request(requester_id, data.contact_id, data.message)

        await self.db.refresh(req)

        # Load requester for notification
        user_repo = UserRepository(self.db)
        requester = await user_repo.get_by_id(requester_id)
        contact_user = await user_repo.get_by_id(data.contact_id)

        if contact_user:
            # In-app notification
            await self.notif_repo.create(
                user_id=data.contact_id,
                title="Emergency Contact Request",
                message=f"{requester.full_name if requester else 'Someone'} wants to add you as their emergency contact.",
                type=NotificationType.EMERGENCY_CONTACT_REQUEST,
                metadata={"contact_request_id": req.id, "requester_id": requester_id},
                dedup_key=f"contact_request:{req.id}",
            )
            await self.db.commit()

            # Push notification
            if contact_user.push_token:
                await send_push_notification(
                    push_token=contact_user.push_token,
                    title="Emergency Contact Request",
                    body=f"{requester.full_name if requester else 'Someone'} wants to add you as their emergency contact.",
                    data={"type": "emergency_contact_request", "request_id": req.id},
                )
        else:
            await self.db.commit()

        return ContactRequestSchema.model_validate(req)

    async def respond_to_request(
        self, request_id: str, current_user_id: str, accept: bool
    ) -> ContactRequestSchema:
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Contact request not found")

        # Only the recipient (contact_id) can respond
        if req.contact_id != current_user_id:
            raise HTTPException(status_code=403, detail="You can only respond to requests sent to you")

        if req.status != ContactRequestStatus.PENDING:
            raise HTTPException(
                status_code=400,
                detail=f"Request is already {req.status.value}"
            )

        req = await self.repo.respond(req, accept)

        # Notify the requester
        action = "accepted" if accept else "rejected"
        notif_type = (
            NotificationType.EMERGENCY_CONTACT_ACCEPTED
            if accept else NotificationType.EMERGENCY_CONTACT_REJECTED
        )
        user_repo = UserRepository(self.db)
        contact_user = await user_repo.get_by_id(current_user_id)
        contact_name = contact_user.full_name if contact_user else "Your contact"

        await self.notif_repo.create(
            user_id=req.requester_id,
            title=f"Contact Request {action.capitalize()}",
            message=f"{contact_name} has {action} your emergency contact request.",
            type=notif_type,
            metadata={"contact_request_id": req.id},
            dedup_key=f"contact_response:{req.id}:{action}",
        )
        await self.db.commit()

        # Push notification to requester
        requester = await user_repo.get_by_id(req.requester_id)
        if requester and requester.push_token:
            await send_push_notification(
                push_token=requester.push_token,
                title=f"Contact Request {action.capitalize()}",
                body=f"{contact_name} has {action} your emergency contact request.",
                data={"type": f"emergency_contact_{action}", "request_id": req.id},
            )

        return ContactRequestSchema.model_validate(req)

    async def revoke_or_delete(self, request_id: str, current_user_id: str) -> None:
        """Requester can revoke a pending/accepted request; contact can also delete."""
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Contact request not found")

        # Both parties can remove the relationship
        if req.requester_id != current_user_id and req.contact_id != current_user_id:
            raise HTTPException(status_code=403, detail="Not authorized to remove this contact")

        await self.repo.delete(req)
        await self.db.commit()

    async def list_incoming(self, user_id: str) -> List[ContactRequestSchema]:
        reqs = await self.repo.list_incoming(user_id)
        return [ContactRequestSchema.model_validate(r) for r in reqs]

    async def list_outgoing(self, user_id: str) -> List[ContactRequestSchema]:
        reqs = await self.repo.list_outgoing(user_id)
        return [ContactRequestSchema.model_validate(r) for r in reqs]

    async def list_accepted(self, user_id: str) -> List[ContactRequestSchema]:
        reqs = await self.repo.list_accepted_contacts(user_id)
        return [ContactRequestSchema.model_validate(r) for r in reqs]

    async def notify_contacts_of_sos(
        self,
        user_id: str,
        user_name: str,
        sos_id: str,
        lat: float,
        lng: float,
    ) -> int:
        """
        Notify all accepted emergency contacts when an SOS is triggered.
        Only accepted contacts receive the location — never public.
        Returns the number of contacts notified.
        """
        contacts = await self.repo.get_accepted_contacts_for_sos(user_id)
        count = 0
        for contact in contacts:
            notif = await self.notif_repo.create(
                user_id=contact.id,
                title=f"🚨 SOS Alert — {user_name}",
                message=f"{user_name} has triggered an SOS emergency. Tap to see their location.",
                type=NotificationType.SOS_ALERT,
                sos_id=sos_id,
                metadata={"sos_id": sos_id, "lat": lat, "lng": lng, "reporter_name": user_name},
                dedup_key=f"sos_alert:{sos_id}:{contact.id}",
            )
            if notif and contact.push_token:
                await send_push_notification(
                    push_token=contact.push_token,
                    title=f"🚨 SOS Alert — {user_name}",
                    body=f"{user_name} has triggered an SOS emergency. Tap to see their location.",
                    data={
                        "type": "sos_alert",
                        "sos_id": sos_id,
                        "lat": lat,
                        "lng": lng,
                        "reporter_name": user_name,
                    },
                )
            count += 1

        await self.db.commit()
        return count
