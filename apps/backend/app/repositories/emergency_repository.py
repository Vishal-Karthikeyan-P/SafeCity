from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from app.models.emergency import EmergencyContact, SOSRequest, SOSStatus
from app.schemas.emergency import EmergencyContactCreate, EmergencyContactUpdate, SOSRequestCreate

class EmergencyRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_contacts(self, user_id: str) -> List[EmergencyContact]:
        result = await self.db.execute(select(EmergencyContact).where(EmergencyContact.user_id == user_id))
        return list(result.scalars().all())

    async def get_contact(self, contact_id: str, user_id: str) -> Optional[EmergencyContact]:
        result = await self.db.execute(
            select(EmergencyContact).where(EmergencyContact.id == contact_id, EmergencyContact.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def create_contact(self, user_id: str, data: EmergencyContactCreate) -> EmergencyContact:
        contact = EmergencyContact(
            user_id=user_id,
            name=data.name,
            phone=data.phone,
            contact_relation=data.contact_relation
        )
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def update_contact(self, contact: EmergencyContact, data: EmergencyContactUpdate) -> EmergencyContact:
        if data.name is not None:
            contact.name = data.name
        if data.phone is not None:
            contact.phone = data.phone
        if data.contact_relation is not None:
            contact.contact_relation = data.contact_relation
            
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def delete_contact(self, contact: EmergencyContact) -> None:
        await self.db.delete(contact)
        await self.db.commit()

    async def create_sos(self, user_id: str, data: SOSRequestCreate) -> SOSRequest:
        from geoalchemy2.shape import from_shape
        from shapely.geometry import Point
        
        geom = from_shape(Point(data.location_lng, data.location_lat), srid=4326)
        
        sos = SOSRequest(
            user_id=user_id,
            location_lat=data.location_lat,
            location_lng=data.location_lng,
            location_geom=geom
        )
        self.db.add(sos)
        await self.db.commit()
        await self.db.refresh(sos)
        return sos
        
    async def get_active_sos(self, user_id: str) -> Optional[SOSRequest]:
        result = await self.db.execute(
            select(SOSRequest).where(SOSRequest.user_id == user_id, SOSRequest.status == SOSStatus.ACTIVE)
        )
        return result.scalar_one_or_none()

    async def resolve_sos(self, sos: SOSRequest, status: SOSStatus) -> SOSRequest:
        from app.models.emergency import utcnow
        sos.status = status
        sos.resolved_at = utcnow()
        await self.db.commit()
        await self.db.refresh(sos)
        return sos
