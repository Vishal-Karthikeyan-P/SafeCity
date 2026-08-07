from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException
import math
from app.repositories.learning_repository import LearningRepository
from app.schemas.learning import ArticleListResponse, ArticleSchema

class LearningService:
    def __init__(self, db: AsyncSession):
        self.repo = LearningRepository(db)

    async def get_categories(self):
        return await self.repo.get_categories()

    async def list_articles(self, page: int, limit: int, category_id: str = None, search: str = None) -> ArticleListResponse:
        articles, total = await self.repo.list_articles(page, limit, category_id, search)
        pages = math.ceil(total / limit) if total > 0 else 1
        return ArticleListResponse(items=articles, total=total, page=page, limit=limit, pages=pages)

    async def get_article(self, slug_or_id: str) -> ArticleSchema:
        article = await self.repo.get_article_by_slug(slug_or_id)
        if not article:
            article = await self.repo.get_article_by_id(slug_or_id)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        return article
