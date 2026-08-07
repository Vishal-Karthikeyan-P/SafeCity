"""
Safety Learning Hub ORM models: ArticleCategory, Article
"""
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

class ArticleCategory(Base):
    __tablename__ = "article_categories"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(sa.String(100), nullable=False, unique=True)
    slug: Mapped[str] = mapped_column(sa.String(100), nullable=False, unique=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    icon: Mapped[str] = mapped_column(sa.String(10), nullable=False, default="📚")
    is_active: Mapped[bool] = mapped_column(sa.Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )

    # Relationships
    articles: Mapped[List["Article"]] = relationship("Article", back_populates="category")


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(
        sa.String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    title: Mapped[str] = mapped_column(sa.String(255), nullable=False)
    slug: Mapped[str] = mapped_column(sa.String(255), nullable=False, unique=True, index=True)
    overview: Mapped[str] = mapped_column(sa.Text, nullable=False)
    content_dos: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    content_donts: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    emergency_steps: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    helpline_numbers: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    legal_info: Mapped[Optional[str]] = mapped_column(sa.Text, nullable=True)
    
    category_id: Mapped[str] = mapped_column(
        sa.String(36),
        sa.ForeignKey("article_categories.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    
    is_published: Mapped[bool] = mapped_column(sa.Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        sa.DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )

    # Relationships
    category: Mapped["ArticleCategory"] = relationship(
        "ArticleCategory", back_populates="articles"
    )

    def __repr__(self) -> str:
        return f"<Article id={self.id} title={self.title!r}>"
