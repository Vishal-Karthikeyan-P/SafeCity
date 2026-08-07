from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.services.incident_service import IncidentService
from app.services.learning_service import LearningService
from app.schemas.incident import IncidentFilters

router = APIRouter()

class SearchResult(BaseModel):
    id: str
    type: str # "incident", "article", "category"
    title: str
    description: str
    url: str

class GlobalSearchResponse(BaseModel):
    results: List[SearchResult]
    total: int

@router.get("", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., min_length=2),
    db: AsyncSession = Depends(get_db)
):
    results = []
    
    # 1. Search Incidents
    incident_service = IncidentService(db)
    filters = IncidentFilters(search=q, limit=5, page=1)
    incidents_resp = await incident_service.list_incidents(filters)
    for inc in incidents_resp.items:
        results.append(SearchResult(
            id=inc.id,
            type="incident",
            title=inc.title,
            description=inc.description[:100] + "...",
            url=f"/incidents/{inc.id}"
        ))
        
    # 2. Search Articles
    learning_service = LearningService(db)
    articles_resp = await learning_service.list_articles(page=1, limit=5, search=q)
    for art in articles_resp.items:
        results.append(SearchResult(
            id=art.id,
            type="article",
            title=art.title,
            description=art.overview[:100] + "...",
            url=f"/learning/{art.slug}"
        ))
        
    # 3. We could also search Locations here via a geocoding API, 
    # but for local DB search, we stick to our entities.
    
    return GlobalSearchResponse(results=results, total=len(results))
