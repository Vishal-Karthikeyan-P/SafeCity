from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class ArticleCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    icon: str = Field(default="📚", max_length=10)

class ArticleCategoryCreate(ArticleCategoryBase):
    pass

class ArticleCategorySchema(ArticleCategoryBase):
    id: str
    slug: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ArticleBase(BaseModel):
    title: str = Field(..., max_length=255)
    overview: str
    content_dos: Optional[str] = None
    content_donts: Optional[str] = None
    emergency_steps: Optional[str] = None
    helpline_numbers: Optional[str] = None
    legal_info: Optional[str] = None
    category_id: str

class ArticleCreate(ArticleBase):
    pass

class ArticleUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    overview: Optional[str] = None
    content_dos: Optional[str] = None
    content_donts: Optional[str] = None
    emergency_steps: Optional[str] = None
    helpline_numbers: Optional[str] = None
    legal_info: Optional[str] = None
    category_id: Optional[str] = None
    is_published: Optional[bool] = None

class ArticleSchema(ArticleBase):
    id: str
    slug: str
    is_published: bool
    created_at: datetime
    updated_at: datetime
    category: Optional[ArticleCategorySchema] = None

    class Config:
        from_attributes = True

class ArticleListResponse(BaseModel):
    items: List[ArticleSchema]
    total: int
    page: int
    limit: int
    pages: int
