"""
Chat Service for SafeCity Gemini-Powered Safety Assistant.

Handles:
- In-memory rate limiting and request length validation
- Strict zero-cost pre-flight guardrails (injection, immediate danger, off-topic filtering)
- Dynamic Learning Hub context retrieval from PostgreSQL
- Gemini API integration with timeout, error handling, token limits, and fallback
- Anti-hallucination source attribution and disclaimer enforcement
"""
import asyncio
import logging
import time
from collections import defaultdict, deque
from typing import Dict, List, Optional, Tuple

import httpx
from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.learning import Article
from app.schemas.chat import ChatMessage, ChatRequest, ChatResponse, ChatSuggestion, ChatSuggestionsResponse
from app.services.chatbot_knowledge import (
    STATIC_SUGGESTIONS,
    SYSTEM_SAFETY_INSTRUCTION,
    assemble_context,
    check_immediate_danger,
    check_prompt_injection,
    check_safety_relevance,
    get_canned_offtopic_response,
)

logger = logging.getLogger(__name__)

# In-memory sliding window rate limiter: client_id -> deque of timestamps
_rate_limits: Dict[str, deque] = defaultdict(deque)


class ChatService:
    def __init__(self, db: Optional[AsyncSession] = None):
        self.db = db

    def check_rate_limit(self, client_id: str) -> None:
        """Enforce per-minute rate limit on chat messages."""
        now = time.time()
        window = _rate_limits[client_id]

        # Purge timestamps older than 60 seconds
        while window and now - window[0] > 60:
            window.popleft()

        limit = settings.CHATBOT_RATE_LIMIT_PER_MINUTE
        if len(window) >= limit:
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Maximum {limit} questions per minute. Please pause before sending another message."
            )
        window.append(now)

    async def get_suggestions(self) -> ChatSuggestionsResponse:
        """Return curated starter prompts for web and mobile chips."""
        return ChatSuggestionsResponse(
            suggestions=[ChatSuggestion(**sug) for sug in STATIC_SUGGESTIONS]
        )

    async def _fetch_relevant_learning_articles(self, query: str) -> Tuple[str, List[str]]:
        """Retrieve dynamic Learning Hub articles matching user query from database."""
        if not self.db:
            return "", []

        try:
            # Extract basic search terms
            words = [w.strip() for w in query.lower().split() if len(w.strip()) > 3]
            if not words:
                return "", []

            clauses = []
            for w in words[:4]:
                clauses.append(Article.title.ilike(f"%{w}%"))
                clauses.append(Article.overview.ilike(f"%{w}%"))
                clauses.append(Article.legal_info.ilike(f"%{w}%"))

            stmt = select(Article).where(or_(*clauses)).limit(2)
            result = await self.db.execute(stmt)
            articles = result.scalars().all()

            if not articles:
                return "", []

            snippets = []
            sources = []
            for art in articles:
                sources.append(f"Learning Hub: {art.title}")
                snippet = (
                    f"ARTICLE: {art.title}\n"
                    f"Overview: {art.overview}\n"
                )
                if art.content_dos:
                    snippet += f"Do's: {art.content_dos}\n"
                if art.content_donts:
                    snippet += f"Don'ts: {art.content_donts}\n"
                if art.emergency_steps:
                    snippet += f"Emergency Steps: {art.emergency_steps}\n"
                if art.legal_info:
                    snippet += f"Legal Info: {art.legal_info}\n"
                if art.helpline_numbers:
                    snippet += f"Helplines: {art.helpline_numbers}\n"
                snippets.append(snippet)

            return "\n---\n".join(snippets), sources
        except Exception as e:
            logger.warning("Error fetching dynamic learning articles: %s", e)
            return "", []

    async def process_chat(self, req: ChatRequest, client_id: str) -> ChatResponse:
        """Process user message through guardrails, knowledge retrieval, and Gemini API."""
        user_msg = req.message.strip()

        # 1. Rate limiting
        self.check_rate_limit(client_id)

        # 2. Length check
        if len(user_msg) > settings.CHATBOT_MAX_MESSAGE_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Message exceeds maximum allowed length of {settings.CHATBOT_MAX_MESSAGE_LENGTH} characters."
            )

        # 3. Guardrail: Prompt Injection / System Override Check (0 Gemini API calls)
        injection_warning = check_prompt_injection(user_msg)
        if injection_warning:
            return ChatResponse(
                reply=injection_warning,
                is_emergency=False,
                suggested_actions=["Ask about SafeCity features", "Ask about emergency helplines"],
                sources=["SafeCity Security Policy"],
                grounded=True
            )

        # 4. Guardrail: Immediate Danger Detection (0 Gemini API calls, instant priority)
        emergency_alert = check_immediate_danger(user_msg)
        if emergency_alert:
            return ChatResponse(**emergency_alert)

        # 5. Guardrail: Relevance Filtering (0 Gemini API calls for off-topic/spam)
        if not check_safety_relevance(user_msg):
            return ChatResponse(
                reply=get_canned_offtopic_response(),
                is_emergency=False,
                suggested_actions=[
                    "Ask about SafeCity SOS",
                    "Ask about Safe Route Planner",
                    "Ask about emergency helplines in India"
                ],
                sources=["SafeCity Policy Guardrails"],
                grounded=True
            )

        # 6. Retrieve matching dynamic Learning Hub content
        db_articles_text, db_sources = await self._fetch_relevant_learning_articles(user_msg)

        # 7. Assemble Grounded Knowledge Context
        full_context = assemble_context(db_articles_text)
        sources = ["SafeCity Verified Knowledge Base"] + db_sources

        # 8. Check if Gemini API Key is configured
        api_key = settings.GEMINI_API_KEY
        if not api_key or not api_key.strip() or api_key.strip() == "your_gemini_api_key_here":
            # Graceful grounded answer when API key is not configured in local environment
            reply = self._generate_grounded_fallback(user_msg, db_articles_text)
            return ChatResponse(
                reply=reply,
                is_emergency=False,
                suggested_actions=self._infer_suggested_actions(user_msg),
                sources=sources,
                grounded=True
            )

        # 9. Call Gemini API with bounds, timeouts, and error handling
        try:
            reply = await self._call_gemini_api(
                api_key=api_key.strip(),
                user_msg=user_msg,
                history=req.history or [],
                grounded_context=full_context
            )
        except Exception as e:
            logger.error("Gemini API call failed or timed out: %s", str(e), exc_info=False)
            # Graceful fallback without exposing error internals or API key
            reply = self._generate_grounded_fallback(user_msg, db_articles_text)

        # 10. Ensure mandatory disclaimer is present
        disclaimer = "\n\n⚠️ *SafeCity AI is an informational tool and does not replace emergency authorities (112) or legal counsel.*"
        if "SafeCity AI is an informational" not in reply:
            reply += disclaimer

        return ChatResponse(
            reply=reply,
            is_emergency=False,
            suggested_actions=self._infer_suggested_actions(user_msg),
            sources=sources,
            grounded=True
        )

    async def _call_gemini_api(
        self,
        api_key: str,
        user_msg: str,
        history: List[ChatMessage],
        grounded_context: str
    ) -> str:
        """Call Gemini model using google-genai SDK or direct async REST fallback."""
        system_instruction = (
            f"{SYSTEM_SAFETY_INSTRUCTION}\n\n"
            f"=== VERIFIED PLATFORM & SAFETY KNOWLEDGE BASE ===\n"
            f"{grounded_context}\n"
            f"=== END OF KNOWLEDGE BASE ===\n\n"
            f"Always ground your response strictly in the knowledge above. "
            f"For legal questions, state jurisdiction: Republic of India. "
            f"FORMAT: Reply in compact Markdown for a small chat window. Open with one short sentence. "
            f"Use '###' headings only when there are 2+ sections, '-' bullets, and **bold** for key actions, "
            f"numbers and helplines. No tables, no horizontal rules (---), no HTML. "
            f"Keep it under about 200 words unless the user asks for detail."
        )

        # Bound history to last 4 turns (2 user, 2 assistant)
        bounded_history = history[-4:] if history else []

        # Try google-genai SDK first
        try:
            # pyrefly: ignore [missing-import]
            from google import genai
            # pyrefly: ignore [missing-import]
            from google.genai import types

            client = genai.Client(api_key=api_key)

            # Build contents
            contents = []
            for h in bounded_history:
                role = "user" if h.role == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=h.content)]
                ))
            contents.append(types.Content(
                role="user",
                parts=[types.Part.from_text(text=user_msg)]
            ))

            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                max_output_tokens=settings.GEMINI_MAX_OUTPUT_TOKENS,
                temperature=settings.GEMINI_TEMPERATURE,
            )

            # Run in thread with timeout to avoid blocking event loop
            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: client.models.generate_content(
                        model=settings.GEMINI_MODEL,
                        contents=contents,
                        config=config
                    )
                ),
                timeout=settings.GEMINI_TIMEOUT_SECONDS
            )

            if response and response.text:
                return response.text.strip()
        except ImportError:
            pass  # Fall back to async HTTP
        except Exception as sdk_err:
            logger.warning("google-genai SDK call error: %s. Trying direct REST API...", sdk_err)

        # Fallback to direct async REST call with httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={api_key}"
        
        contents_payload = []
        for h in bounded_history:
            role = "user" if h.role == "user" else "model"
            contents_payload.append({
                "role": role,
                "parts": [{"text": h.content}]
            })
        contents_payload.append({
            "role": "user",
            "parts": [{"text": user_msg}]
        })

        payload = {
            "system_instruction": {
                "parts": [{"text": system_instruction}]
            },
            "contents": contents_payload,
            "generationConfig": {
                "maxOutputTokens": settings.GEMINI_MAX_OUTPUT_TOKENS,
                "temperature": settings.GEMINI_TEMPERATURE
            }
        }

        async with httpx.AsyncClient(timeout=settings.GEMINI_TIMEOUT_SECONDS) as client:
            resp = await client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if candidates:
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if parts and "text" in parts[0]:
                        return parts[0]["text"].strip()
            else:
                logger.error("Gemini REST API error HTTP %d: %s", resp.status_code, resp.text[:200])
                raise RuntimeError(f"Gemini API returned status {resp.status_code}")

        raise RuntimeError("Empty response from Gemini API")

    def _generate_grounded_fallback(self, query: str, db_articles_text: str = "") -> str:
        """Generate high-quality verified answer from knowledge base when Gemini is unreachable."""
        q = query.lower()

        # SOS questions
        if "sos" in q or "emergency button" in q:
            return (
                "🚨 **SafeCity Emergency SOS**\n\n"
                "• **How it works:** Tap the red 'EMERGENCY SOS' card on mobile or web. A 10-second countdown with an alert sound begins.\n"
                "• **Safety Grace Period:** You can cancel the countdown if triggered by mistake.\n"
                "• **Activation:** If confirmed, your current GPS coordinates, battery level, and emergency status are broadcast immediately to your trusted emergency contacts.\n"
                "• **Active Tools:** The Active SOS screen gives you 1-tap direct dialing to 112, a high-decibel siren alarm, and flashlight strobe to draw public attention."
            )

        # Helplines
        if "helpline" in q or "number" in q or "call" in q or "phone" in q:
            return (
                "📞 **Official Emergency Helplines (Republic of India)**\n\n"
                "• **112:** All-in-One National Emergency (Police, Fire, Ambulance, Disaster)\n"
                "• **100:** Police Control Room\n"
                "• **101:** Fire Brigade\n"
                "• **108 / 102:** Ambulance & Emergency Medical\n"
                "• **1091 / 181:** Women's Helpline & Distress Support\n"
                "• **1098:** Childline (Child protection)\n"
                "• **14567:** Elder Line (Senior citizens)\n"
                "• **1930:** National Cyber Crime Helpline (Financial fraud)"
            )

        # Route / Navigation
        if "route" in q or "path" in q or "navigate" in q:
            return (
                "🗺️ **Safe Route Planner**\n\n"
                "• **How it works:** Combines OSRM turn-by-turn routing with SafeCity's incident-density safety algorithm.\n"
                "• **Risk Detours:** Instead of only looking at the shortest distance, SafeCity evaluates verified incident clusters and poor lighting zones to suggest the safest route.\n"
                "• **Comparison:** You can inspect risk difference percentages and safety score variations before starting your commute."
            )

        # Map / Score
        if "map" in q or "score" in q or "heat" in q:
            return (
                "🛡️ **Safety Map & Area Safety Scores**\n\n"
                "• **Live Map:** Visualizes user reports, hazard markers, and verified safe zones across your city.\n"
                "• **Area Safety Score (0-100):** Real-time safety rating calculated from nearby incident frequency, distance to police stations, and street lighting verification.\n"
                "• **Color Codes:** Green (80-100 Safe), Amber (50-79 Caution), Red (0-49 High Risk)."
            )

        # Legal / POSH / POCSO
        if "posh" in q or "workplace" in q or "harass" in q:
            return (
                "⚖️ **Workplace Harassment Rights (POSH Act 2013)**\n\n"
                "• **Jurisdiction:** Republic of India\n"
                "• **Mandatory Committee:** Every organisation with 10 or more employees must maintain an Internal Complaints Committee (ICC).\n"
                "• **Filing Timeline:** Submit complaints in writing within 3 months of the incident.\n"
                "• **Employer Penalty:** Organisations failing to comply face fines up to Rs. 50,000 and business license revocation.\n"
                "• **Legal Protections:** Protection against employer retaliation during and after the inquiry."
            )

        # Cyber fraud / scam
        if "cyber" in q or "scam" in q or "fraud" in q or "otp" in q:
            return (
                "🛡️ **Cyber Financial Scam Response (India)**\n\n"
                "• **Immediate Action:** Call **1930** (National Cyber Crime Helpline) within the 'Golden Hour' to request an immediate inter-bank freeze on the fraud account.\n"
                "• **Bank Block:** Call your bank helpline immediately to block card/UPI transactions.\n"
                "• **Official Complaint:** File an e-FIR on **cybercrime.gov.in**.\n"
                "• **Legal Act:** Covered under Sections 66C and 66D of the Information Technology Act, 2000."
            )

        # Night walking
        if "night" in q or "alone" in q or "walk" in q:
            return (
                "🌙 **Night Walking Safety Guidance**\n\n"
                "• **DO:** Stick to well-lit commercial streets; walk facing oncoming traffic.\n"
                "• **DO:** Share your live trip location with a trusted SafeCity contact.\n"
                "• **DO:** Carry a fully charged phone with the SOS trigger ready.\n"
                "• **DON'T:** Do not wear noise-cancelling headphones or look down at your screen constantly.\n"
                "• **DON'T:** Do not take deserted alleys, unlit shortcuts, or unverified paths."
            )

        # General verified safety reply
        return (
            "🛡️ **SafeCity Safety Assistant**\n\n"
            "I am ready to help you with:\n"
            "• **SafeCity Features:** Emergency SOS countdown, Safe Route planner, Live Map, and Incident Reporting.\n"
            "• **Emergency Procedures:** Immediate steps for being followed, rideshare verification, first aid, and fire evacuation.\n"
            "• **Verified Legal Frameworks:** POSH Act 2013, POCSO Act 2012, IT Act 2000, and Good Samaritan Law (Republic of India).\n"
            "• **Emergency Helplines:** Dial **112** for all integrated emergency services.\n\n"
            "Feel free to ask a specific safety question or choose from the quick prompts below."
        )

    def _infer_suggested_actions(self, query: str) -> List[str]:
        """Infer contextual follow-up actions based on user query."""
        q = query.lower()
        if "sos" in q or "danger" in q:
            return ["Review SOS emergency contacts", "Test SafeCity siren alarm", "Call 112"]
        if "route" in q or "walk" in q or "night" in q:
            return ["Plan route on Safe Route Planner", "Share live location", "Check area safety score"]
        if "legal" in q or "posh" in q or "harass" in q:
            return ["Read POSH Guide in Learning Hub", "Consult NALSA free legal aid (15100)", "Report incident anonymously"]
        if "cyber" in q or "scam" in q:
            return ["Call Cyber Helpline 1930", "Visit cybercrime.gov.in", "Contact bank to freeze card"]
        return [
            "Explore Learning Hub guides",
            "Check live safety map",
            "Review emergency helplines"
        ]
