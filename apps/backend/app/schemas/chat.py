"""
Pydantic Schemas for SafeCity Gemini Chatbot
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Role of the sender ('user' or 'assistant')")
    content: str = Field(..., max_length=1200, description="Message text content")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=600, description="User question or query")
    history: Optional[List[ChatMessage]] = Field(default=[], description="Previous conversation turns (max 6)")


class ChatResponse(BaseModel):
    reply: str = Field(..., description="Assistant response text")
    is_emergency: bool = Field(default=False, description="Flag indicating if the query is an active emergency")
    suggested_actions: List[str] = Field(default=[], description="Actionable safety recommendations or next steps")
    sources: List[str] = Field(default=[], description="Grounded knowledge sources / Learning Hub topics referenced")
    grounded: bool = Field(default=True, description="Whether the answer is grounded in SafeCity knowledge")


class ChatSuggestion(BaseModel):
    id: str
    category: str
    question: str
    icon: str


class ChatSuggestionsResponse(BaseModel):
    suggestions: List[ChatSuggestion]
