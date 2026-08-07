from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.services.learning_service import LearningService
from app.schemas.learning import ArticleCategorySchema, ArticleSchema, ArticleListResponse

router = APIRouter()

@router.get("/categories", response_model=List[ArticleCategorySchema])
async def list_categories(db: AsyncSession = Depends(get_db)):
    service = LearningService(db)
    return await service.get_categories()

@router.get("/articles", response_model=ArticleListResponse)
async def list_articles(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    service = LearningService(db)
    return await service.list_articles(page, limit, category_id, search)

@router.get("/articles/{slug_or_id}", response_model=ArticleSchema)
async def get_article(slug_or_id: str, db: AsyncSession = Depends(get_db)):
    service = LearningService(db)
    return await service.get_article(slug_or_id)
