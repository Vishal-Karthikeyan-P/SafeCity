from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from typing import List, Optional, Tuple
from app.models.learning import Article, ArticleCategory

class LearningRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_categories(self) -> List[ArticleCategory]:
        result = await self.db.execute(select(ArticleCategory).where(ArticleCategory.is_active == True))
        return list(result.scalars().all())

    async def get_article_by_slug(self, slug: str) -> Optional[Article]:
        result = await self.db.execute(
            select(Article).options(selectinload(Article.category)).where(Article.slug == slug)
        )
        return result.scalar_one_or_none()
        
    async def get_article_by_id(self, article_id: str) -> Optional[Article]:
        result = await self.db.execute(
            select(Article).options(selectinload(Article.category)).where(Article.id == article_id)
        )
        return result.scalar_one_or_none()

    async def list_articles(self, page: int = 1, limit: int = 10, category_id: Optional[str] = None, search: Optional[str] = None) -> Tuple[List[Article], int]:
        query = select(Article).where(Article.is_published == True)
        
        if category_id:
            query = query.where(Article.category_id == category_id)
            
        if search:
            query = query.where(Article.title.ilike(f"%{search}%") | Article.overview.ilike(f"%{search}%"))
            
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = await self.db.scalar(count_query) or 0
        
        # Pagination
        query = query.options(selectinload(Article.category)).order_by(Article.created_at.desc()).offset((page - 1) * limit).limit(limit)
        result = await self.db.execute(query)
        articles = list(result.scalars().all())
        
        return articles, total

