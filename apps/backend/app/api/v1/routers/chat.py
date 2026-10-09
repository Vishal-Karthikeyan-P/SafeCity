"""
SafeCity Chatbot API Router — Gemini-Powered Safety Assistant.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.schemas.chat import ChatRequest, ChatResponse, ChatSuggestionsResponse
from app.services.chat_service import ChatService

router = APIRouter()


def get_client_id(request: Request) -> str:
    """Extract client identifier (IP address or forwarded header) for rate limiting."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "anonymous-client"


@router.post("/message", response_model=ChatResponse, summary="Send a message to SafeCity AI Assistant")
async def send_chat_message(
    payload: ChatRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Process user query with strict safety guardrails, Learning Hub grounding, and Gemini AI.
    Zero Gemini cost for prompt injection attempts, immediate danger, and off-topic questions.
    """
    client_id = get_client_id(request)
    service = ChatService(db=db)
    return await service.process_chat(payload, client_id=client_id)


@router.get("/suggestions", response_model=ChatSuggestionsResponse, summary="Get safety starter prompts")
async def get_chat_suggestions():
    """Return verified safety and platform feature starter questions."""
    service = ChatService()
    return await service.get_suggestions()


@router.get("/status", summary="Chatbot service status")
async def get_chat_status():
    """Return status and active model configuration without exposing secrets."""
    is_key_configured = bool(
        settings.GEMINI_API_KEY
        and settings.GEMINI_API_KEY.strip()
        and settings.GEMINI_API_KEY.strip() != "your_gemini_api_key_here"
    )
    return {
        "status": "online",
        "service": "SafeCity Safety Assistant",
        "model": settings.GEMINI_MODEL,
        "max_output_tokens": settings.GEMINI_MAX_OUTPUT_TOKENS,
        "gemini_api_configured": is_key_configured,
        "rate_limit_per_minute": settings.CHATBOT_RATE_LIMIT_PER_MINUTE,
        "max_message_length": settings.CHATBOT_MAX_MESSAGE_LENGTH,
        "jurisdiction": "Republic of India",
        "emergency_number": "112"
    }
