from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
from typing import List
from app.repositories.emergency_repository import EmergencyRepository
from app.schemas.emergency import EmergencyContactCreate, EmergencyContactUpdate, SOSRequestCreate
from app.models.emergency import SOSStatus

class EmergencyService:
    def __init__(self, db: AsyncSession):
        self.repo = EmergencyRepository(db)

    async def list_contacts(self, user_id: str):
        return await self.repo.list_contacts(user_id)

    async def add_contact(self, user_id: str, data: EmergencyContactCreate):
        contacts = await self.repo.list_contacts(user_id)
        if len(contacts) >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 emergency contacts allowed")
        return await self.repo.create_contact(user_id, data)

    async def update_contact(self, contact_id: str, user_id: str, data: EmergencyContactUpdate):
        contact = await self.repo.get_contact(contact_id, user_id)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        return await self.repo.update_contact(contact, data)

    async def delete_contact(self, contact_id: str, user_id: str):
        contact = await self.repo.get_contact(contact_id, user_id)
        if not contact:
            raise HTTPException(status_code=404, detail="Contact not found")
        await self.repo.delete_contact(contact)

    async def get_active_sos(self, user_id: str):
        return await self.repo.get_active_sos(user_id)

    async def trigger_sos(self, user_id: str, data: SOSRequestCreate):
        active = await self.repo.get_active_sos(user_id)
        if active:
            raise HTTPException(status_code=400, detail="An SOS request is already active")
        return await self.repo.create_sos(user_id, data)

    async def update_sos_location(self, user_id: str, lat: float, lng: float):
        active = await self.repo.get_active_sos(user_id)
        if not active:
            raise HTTPException(status_code=404, detail="No active SOS request found")
        return await self.repo.update_sos_location(active, lat, lng)

    async def resolve_sos(self, user_id: str, status: SOSStatus):
        active = await self.repo.get_active_sos(user_id)
        if not active:
            raise HTTPException(status_code=404, detail="No active SOS request found")
        return await self.repo.resolve_sos(active, status)

