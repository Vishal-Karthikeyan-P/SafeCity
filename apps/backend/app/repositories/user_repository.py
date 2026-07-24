"""
User Repository — all DB access for users
"""
from typing import Optional, List, Tuple
import math

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload

from app.models.user import User, UserProfile


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, user_id: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.profile)).where(User.id == user_id)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[User]:
        result = await self.db.execute(
            select(User).options(selectinload(User.profile)).where(User.email == email)
        )
        return result.scalar_one_or_none()

    async def create(self, email: str, full_name: str, hashed_password: str, role: str = "citizen") -> User:
        from app.models.user import UserRole
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=hashed_password,
            role=UserRole(role),
        )
        self.db.add(user)
        await self.db.flush()

        # Auto-create profile
        profile = UserProfile(user_id=user.id)
        self.db.add(profile)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update(self, user: User, **kwargs) -> User:
        for key, value in kwargs.items():
            if hasattr(user, key) and value is not None:
                setattr(user, key, value)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def update_profile(self, user: User, **kwargs) -> User:
        if user.profile is None:
            profile = UserProfile(user_id=user.id)
            self.db.add(profile)
            await self.db.flush()
            await self.db.refresh(user)
        for key, value in kwargs.items():
            if hasattr(user.profile, key) and value is not None:
                setattr(user.profile, key, value)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def list_users(
        self, page: int = 1, limit: int = 10, search: Optional[str] = None
    ) -> Tuple[List[User], int]:
        query = select(User).options(selectinload(User.profile))
        if search:
            query = query.where(
                or_(
                    User.full_name.ilike(f"%{search}%"),
                    User.email.ilike(f"%{search}%"),
                )
            )
        total_q = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(total_q)).scalar_one()
        query = query.offset((page - 1) * limit).limit(limit).order_by(User.created_at.desc())
        result = await self.db.execute(query)
        return result.scalars().all(), total

    async def count(self) -> int:
        result = await self.db.execute(select(func.count()).select_from(User))
        return result.scalar_one()

    async def count_active(self) -> int:
        result = await self.db.execute(
            select(func.count()).select_from(User).where(User.is_active == True)
        )
        return result.scalar_one()

    async def update_avatar(self, user: User, avatar_url: str) -> User:
        if user.profile is None:
            profile = UserProfile(user_id=user.id)
            self.db.add(profile)
            await self.db.flush()
            await self.db.refresh(user)
        user.profile.avatar_url = avatar_url
        await self.db.flush()
        return user
