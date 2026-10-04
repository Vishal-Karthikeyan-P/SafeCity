"""
Contact Request Repository — user-to-user emergency contact workflow.
"""
import json
from typing import List, Optional, Tuple

from sqlalchemy import select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.emergency import ContactRequest, ContactRequestStatus
from app.models.user import User


class ContactRequestRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_existing(
        self, requester_id: str, contact_id: str
    ) -> Optional[ContactRequest]:
        """Return any request between these two users (in either direction)."""
        result = await self.db.execute(
            select(ContactRequest).where(
                or_(
                    and_(
                        ContactRequest.requester_id == requester_id,
                        ContactRequest.contact_id == contact_id,
                    ),
                    and_(
                        ContactRequest.requester_id == contact_id,
                        ContactRequest.contact_id == requester_id,
                    ),
                )
            )
        )
        return result.scalar_one_or_none()

    async def send_request(
        self, requester_id: str, contact_id: str, message: Optional[str] = None
    ) -> ContactRequest:
        req = ContactRequest(
            requester_id=requester_id,
            contact_id=contact_id,
            status=ContactRequestStatus.PENDING,
            message=message,
        )
        self.db.add(req)
        await self.db.flush()
        await self.db.refresh(req)
        return req

    async def get_by_id(self, request_id: str) -> Optional[ContactRequest]:
        result = await self.db.execute(
            select(ContactRequest)
            .where(ContactRequest.id == request_id)
            .options(
                selectinload(ContactRequest.requester),
                selectinload(ContactRequest.contact),
            )
        )
        return result.scalar_one_or_none()

    async def list_incoming(self, user_id: str) -> List[ContactRequest]:
        """Requests where current user is the contact (recipient)."""
        result = await self.db.execute(
            select(ContactRequest)
            .where(
                ContactRequest.contact_id == user_id,
                ContactRequest.status == ContactRequestStatus.PENDING,
            )
            .options(selectinload(ContactRequest.requester))
            .order_by(ContactRequest.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_outgoing(self, user_id: str) -> List[ContactRequest]:
        """Requests sent by current user."""
        result = await self.db.execute(
            select(ContactRequest)
            .where(ContactRequest.requester_id == user_id)
            .options(selectinload(ContactRequest.contact))
            .order_by(ContactRequest.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_accepted_contacts(self, user_id: str) -> List[ContactRequest]:
        """All accepted contact relationships involving this user."""
        result = await self.db.execute(
            select(ContactRequest)
            .where(
                ContactRequest.status == ContactRequestStatus.ACCEPTED,
                or_(
                    ContactRequest.requester_id == user_id,
                    ContactRequest.contact_id == user_id,
                ),
            )
            .options(
                selectinload(ContactRequest.requester),
                selectinload(ContactRequest.contact),
            )
        )
        return list(result.scalars().all())

    async def get_accepted_contacts_for_sos(self, user_id: str) -> List[User]:
        """
        Get User objects who are accepted emergency contacts of user_id.
        Used to notify contacts when SOS is triggered.
        Only returns users who set user_id as their contact (contact_id == user_id)
        OR user_id set them as contact (requester_id == user_id).
        Authorization is symmetric — both directions are valid after acceptance.
        """
        result = await self.db.execute(
            select(ContactRequest)
            .where(
                ContactRequest.status == ContactRequestStatus.ACCEPTED,
                or_(
                    ContactRequest.requester_id == user_id,
                    ContactRequest.contact_id == user_id,
                ),
            )
            .options(
                selectinload(ContactRequest.requester),
                selectinload(ContactRequest.contact),
            )
        )
        contacts_rows = result.scalars().all()
        users = []
        for row in contacts_rows:
            # Return the OTHER person in the relationship
            if row.requester_id == user_id:
                users.append(row.contact)
            else:
                users.append(row.requester)
        return users

    async def respond(
        self, request: ContactRequest, accept: bool
    ) -> ContactRequest:
        request.status = (
            ContactRequestStatus.ACCEPTED if accept else ContactRequestStatus.REJECTED
        )
        await self.db.flush()
        await self.db.refresh(request)
        return request

    async def delete(self, request: ContactRequest) -> None:
        await self.db.delete(request)
        await self.db.flush()

    async def search_users(
        self, query: str, exclude_user_id: str, limit: int = 20
    ) -> List[User]:
        """Search SafeCity users by name or email for emergency contact requests."""
        from sqlalchemy import or_, func
        result = await self.db.execute(
            select(User)
            .where(
                User.id != exclude_user_id,
                User.is_active == True,
                or_(
                    User.full_name.ilike(f"%{query}%"),
                    User.email.ilike(f"%{query}%"),
                ),
            )
            .order_by(User.full_name)
            .limit(limit)
        )
        return list(result.scalars().all())
