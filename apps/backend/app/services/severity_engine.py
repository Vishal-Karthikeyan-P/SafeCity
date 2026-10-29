"""
SeverityEngine — Context-Aware Incident Severity using Gemini LLM.
===================================================================

Design & Architecture:
----------------------
1. Contextual Comprehension over Keywords:
   - Real-world incident severity depends on situational nuances, not keyword matching.
   - Naive keyword boosting fails on negations (e.g., "no major injuries", "no fire",
     "nobody hurt", "already resolved", "minor scratch"), erroneously elevating minor
     events to "critical".
   - This engine uses Google Gemini (via `google-genai` SDK with fallback to direct
     REST `generateContent`) to read the full report (category + title + description)
     and evaluate the true hazard level, casualties, urgency, and vulnerability.

2. Severity Tiers:
   - critical (80 - 100): Immediate, ongoing threat to human life; active extreme violence;
     trapped victims; uncontained catastrophic explosion/fire endangering people.
   - high (60 - 79): Serious danger or confirmed severe injury; high likelihood of imminent
     physical harm; armed incidents; exposed live high-voltage cables.
   - medium (38 - 59): Public safety issues, property disruption, or collisions/accidents
     where there are NO major injuries or only minor harm.
   - low (0 - 37): Minor inconvenience, lost items, petty nuisance, or situations where
     danger has already passed or was averted ("minor scratch", "resolved").

3. Zero Keyword Weightage & Clean Fallback:
   - If the Gemini API key is not configured, or if an API call fails or times out,
     the engine falls back to category baselines WITHOUT blind keyword weightage.
   - Fallback also applies negation awareness so "no major injuries" never triggers "critical".

4. Config (from app.core.config.settings or OS environment):
   - SEVERITY_AI_ENABLED: "true" | "false" (default: "true")
   - SEVERITY_AI_PREVIEW: "true" | "false" (default: "true"; set "false" on free tier to run AI only on submit)
   - SEVERITY_AI_MODEL: Gemini model identifier (default: "gemini-1.5-flash")
   - SEVERITY_AI_API_KEY: Dedicated key; if empty, automatically falls back to GEMINI_API_KEY.
   - SEVERITY_AI_BASE_URL: Optional OpenAI-compatible endpoint URL if using openai_compat provider.

5. Public API:
   - acompute_severity(slug, title, description) -> str          (async, AI + safe fallback)
   - apreview_severity(slug, title, description) -> dict         (async, live preview {severity, score, source, reason, factors})
   - compute_severity(slug, title, description) -> str           (sync compatible)
   - preview_severity(slug, title, description) -> dict          (sync compatible)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

log = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Baseline Categories (Sensible defaults without keyword weightage)
# ─────────────────────────────────────────────────────────────────────────────
_CATEGORY_BASE: dict[str, int] = {
    "gas_leak": 75,
    "assault_violence": 75,
    "missing_person": 70,
    "crime": 58,
    "accident": 48,                  # Baseline accident without info is medium (NOT critical)
    "drainage_flooding": 45,
    "electrical_outage": 45,
    "road_hazard": 45,
    "animal_bite": 45,
    "theft_robbery": 45,
    "pedestrian_safety": 40,
    "traffic_signal_malfunction": 40,
    "harassment": 40,
    "suspicious_activity": 35,
    "construction_hazard": 35,
    "public_health_concern": 35,
    "poor_lighting": 30,
    "traffic_violation": 30,
    "fallen_tree_branch": 30,
    "water_leakage": 25,
    "sewage_issue": 25,
    "public_infrastructure": 25,
    "illegal_dumping": 20,
    "vandalism": 20,
    "lost_and_found": 15,
}
_CATEGORY_BASE_DEFAULT = 40

_THRESHOLDS = [(80, "critical"), (60, "high"), (38, "medium"), (0, "low")]

_FACTORS = [
    "threat_to_life",
    "injury_reported",
    "no_injuries_confirmed",
    "minor_or_resolved",
    "multiple_people",
    "vulnerable_people",
    "ongoing_hazard",
    "escalation_risk",
    "public_area",
    "property_damage_only",
]


def _score_to_severity(score: int) -> str:
    for threshold, label in _THRESHOLDS:
        if score >= threshold:
            return label
    return "low"


def _category_base(slug: Optional[str]) -> int:
    return _CATEGORY_BASE.get((slug or "").lower().strip(), _CATEGORY_BASE_DEFAULT)


# ─────────────────────────────────────────────────────────────────────────────
# Deterministic Fallback (NO blind keyword boost)
# ─────────────────────────────────────────────────────────────────────────────
_NEGATION_PATTERNS = re.compile(
    r"\b(no\s+(?:major\s+)?injur(?:y|ies)|nobody\s+(?:is\s+)?hurt|no\s+(?:one\s+)?hurt|"
    r"no\s+casualties|no\s+damage|minor\s+scratch|already\s+resolved|already\s+cleared|"
    r"under\s+control|false\s+alarm|nothing\s+serious)\b",
    re.IGNORECASE,
)

_URGENT_PATTERNS = re.compile(
    r"\b(trapped|unconscious|explosion|blast|active\s+fire|building\s+collapse|"
    r"gunfire|stabbing|fatal(?:ity)?|multiple\s+casualties)\b",
    re.IGNORECASE,
)


def _rule_score(slug: Optional[str], title: str, description: str) -> int:
    """
    Context-aware deterministic baseline score (0-100).
    Notice: NO blind keyword point boost!
    """
    base = _category_base(slug)
    text = f"{title or ''} {description or ''}"

    # If explicit negations like 'no major injuries' are present, cap or lower the score
    if _NEGATION_PATTERNS.search(text):
        # Cap at medium tier (score <= 45)
        return min(base, 45)

    # Only escalate baseline if explicit extreme life-safety markers exist in context
    if _URGENT_PATTERNS.search(text):
        return max(base, 82)

    return base


def compute_severity(category_slug: Optional[str], title: str, description: str) -> str:
    """Synchronous severity calculation (safe fallback)."""
    return _score_to_severity(_rule_score(category_slug, title, description))


def preview_severity(category_slug: Optional[str], title: str, description: str) -> dict:
    """Synchronous live preview calculation (safe fallback)."""
    score = _rule_score(category_slug, title, description)
    return {"severity": _score_to_severity(score), "score": score, "source": "rules"}


# ─────────────────────────────────────────────────────────────────────────────
# AI Configuration & Prompt
# ─────────────────────────────────────────────────────────────────────────────
PREVIEW_TIMEOUT_S = 6.0
SUBMIT_TIMEOUT_S = 10.0
MIN_PREVIEW_CHARS = 10
MAX_TITLE_CHARS = 200
MAX_DESC_CHARS = 1500
CONCURRENCY = 8
CACHE_TTL_S = 3600.0
CACHE_MAX = 512
BREAKER_FAILS = 3
BREAKER_COOLDOWN_S = 60.0
BREAKER_AUTH_COOLDOWN_S = 600.0

_SYSTEM_INSTRUCTION = """You are the AI Severity Classification Engine for SafeCity, an urban safety and civic issue platform in Coimbatore, India.
Your task is to analyze the full situational context of an incident report (category, title, description) and evaluate its true real-world severity.

CRITICAL INSTRUCTIONS:
1. CONTEXTUAL COMPREHENSION OVER KEYWORDS:
   - DO NOT assign severity based on isolated keywords!
   - You MUST read phrases in full and understand negation and qualification:
     * "no injuries", "no major injuries", "nobody was hurt", "everyone is safe", "no damage" -> This explicitly means NO severe physical trauma occurred. Downgrade severity accordingly!
     * "already resolved", "hazard has been cleared", "minor scratch", "small issue", "false alarm" -> Low or medium severity.
     * "under control", "past incident", "no immediate threat" -> Downgrade severity.
   - Contrast this with genuine active emergencies:
     * "people trapped in burning vehicle", "active armed shooter", "major gas pipeline rupture spreading towards houses" -> Critical!

2. SEVERITY TIERS & SCORE RANGES:
   - "critical" (80 - 100): Immediate, ongoing threat to human life; catastrophic emergency; severe active violence with weapons; trapped victims; uncontrolled explosions or fires endangering people right now.
   - "high" (60 - 79): Serious danger or active severe injury; hazardous conditions with high likelihood of imminent physical harm (e.g. major multi-vehicle pileup with confirmed injuries; exposed live high-voltage power lines on a flooded pedestrian path; armed robbery in progress).
   - "medium" (38 - 59): Public safety issues, property disruption, traffic bottlenecks, infrastructure defects, or accidents where there are NO major injuries or only minor bruises (e.g. "minor car collision, no major injuries, traffic blocked"; "large open pothole on busy street"; "streetlights completely out on main road"; "drainage overflow").
   - "low" (0 - 37): Minor inconvenience, petty nuisance, property loss without danger, or situations where danger has passed or was averted (e.g. "lost wallet"; "graffiti on public wall"; "bike skid with zero injuries, rider walking away"; "cleared debris").

3. OUTPUT FORMAT:
   Return ONLY a single valid JSON object with the following schema:
   {
     "severity": "low" | "medium" | "high" | "critical",
     "score": <integer from 0 to 100 corresponding to the tier>,
     "reason": "<One clear sentence explaining the decisive context (max 25 words)>",
     "factors": ["<factor1>", "<factor2>"]
   }
   Valid factors:
   "threat_to_life", "injury_reported", "no_injuries_confirmed", "minor_or_resolved",
   "multiple_people", "vulnerable_people", "ongoing_hazard", "escalation_risk", "public_area", "property_damage_only"
"""


@dataclass
class SeverityResult:
    severity: str
    score: int
    source: str                      # "ai" | "rules"
    reason: Optional[str] = None
    factors: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "severity": self.severity,
            "score": self.score,
            "source": self.source,
            "reason": self.reason,
            "factors": self.factors,
        }


# ─────────────────────────────────────────────────────────────────────────────
# Config / Client / Cache / Breaker
# ─────────────────────────────────────────────────────────────────────────────
def _cfg(name: str, default: Optional[str] = None) -> Optional[str]:
    try:
        from app.core.config import settings
        val = getattr(settings, name, None)
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    except Exception:
        pass
    val = os.getenv(name, default)
    return str(val).strip() if val is not None else None


_client: Optional[httpx.AsyncClient] = None
_sem: Optional[asyncio.Semaphore] = None
_cache: "OrderedDict[tuple, tuple[float, SeverityResult]]" = OrderedDict()
_fails = 0
_breaker_until = 0.0


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            limits=httpx.Limits(max_connections=CONCURRENCY, max_keepalive_connections=CONCURRENCY)
        )
    return _client


async def aclose_client() -> None:
    """Call during application shutdown."""
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None


def _flag(name: str, default: str = "true") -> bool:
    return (_cfg(name, default) or default).strip().lower() != "false"


def _get_api_key() -> Optional[str]:
    # Dedicated severity engine key takes priority, falls back to general Gemini API key
    key = _cfg("SEVERITY_AI_API_KEY") or _cfg("GEMINI_API_KEY")
    if key and key.strip() and key.strip() != "your_gemini_api_key_here":
        return key.strip()
    return None


def _get_model() -> str:
    return _cfg("SEVERITY_AI_MODEL") or _cfg("GEMINI_MODEL") or "gemini-1.5-flash"


def ai_enabled() -> bool:
    if not _flag("SEVERITY_AI_ENABLED"):
        return False
    return bool(_get_api_key())


def _breaker_open() -> bool:
    return time.monotonic() < _breaker_until


def _record_failure(auth: bool = False) -> None:
    global _fails, _breaker_until
    _fails += 1
    if auth or _fails >= BREAKER_FAILS:
        _breaker_until = time.monotonic() + (BREAKER_AUTH_COOLDOWN_S if auth else BREAKER_COOLDOWN_S)
        _fails = 0
        log.warning("Severity AI temporarily paused for %.0fs after repeated failures", _breaker_until - time.monotonic())


def _record_success() -> None:
    global _fails
    _fails = 0


_WS = re.compile(r"\s+")
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PHONE = re.compile(r"(?<!\w)(?:\+?\d[\s-]?){9,13}\d(?!\w)")


def _clean(text: Optional[str], limit: int) -> str:
    """Normalise, redact PII, truncate."""
    t = _WS.sub(" ", str(text or "")).strip()
    t = _EMAIL.sub("[email]", t)
    t = _PHONE.sub("[phone]", t)
    return t.replace("<", "‹").replace(">", "›")[:limit]


def _cache_get(key: tuple) -> Optional[SeverityResult]:
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_TTL_S:
        _cache.move_to_end(key)
        return hit[1]
    _cache.pop(key, None)
    return None


def _cache_put(key: tuple, res: SeverityResult) -> None:
    _cache[key] = (time.monotonic(), res)
    _cache.move_to_end(key)
    while len(_cache) > CACHE_MAX:
        _cache.popitem(last=False)


def _user_prompt(slug: Optional[str], title: str, description: str) -> str:
    return (
        f"Incident Category: {_clean(slug, 60) or 'Unspecified'}\n"
        f"Title: {title}\n"
        f"Description: {description}\n\n"
        "Evaluate the contextual severity and return JSON."
    )


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Tolerant JSON extraction: handles code fences or stray thoughts."""
    t = re.sub(r"<think>.*?</think>", "", text or "", flags=re.DOTALL)
    # Strip markdown code blocks ```json ... ```
    t = re.sub(r"^```(?:json)?\s*", "", t.strip(), flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t.strip())
    i, j = t.find("{"), t.rfind("}")
    if i < 0 or j <= i:
        return None
    try:
        obj = json.loads(t[i:j + 1])
    except ValueError:
        return None
    return obj if isinstance(obj, dict) else None


# ─────────────────────────────────────────────────────────────────────────────
# Gemini API Adapters (SDK + Direct REST)
# ─────────────────────────────────────────────────────────────────────────────
async def _gemini_sdk_answer(api_key: str, model: str, user_prompt: str, timeout: float) -> Optional[Dict[str, Any]]:
    try:
        # pyrefly: ignore [missing-import]
        from google import genai  # type: ignore[import-untyped,import-not-found]
        # pyrefly: ignore [missing-import]
        from google.genai import types  # type: ignore[import-untyped,import-not-found]

        client = genai.Client(api_key=api_key)
        config = types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            temperature=0.1,
            max_output_tokens=350,
            response_mime_type="application/json",
        )

        loop = asyncio.get_running_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: client.models.generate_content(
                    model=model,
                    contents=[user_prompt],
                    config=config,
                ),
            ),
            timeout=timeout,
        )
        if response and response.text:
            return _extract_json(response.text)
    except ImportError:
        pass
    except Exception as exc:
        log.warning("google-genai SDK call error: %s. Falling back to REST API...", exc)
    return None


async def _gemini_rest_answer(api_key: str, model: str, user_prompt: str, timeout: float) -> Optional[Dict[str, Any]]:
    """Secondary: Direct async REST call to Google Gemini endpoint."""
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    payload = {
        "system_instruction": {"parts": [{"text": _SYSTEM_INSTRUCTION}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 350,
            "responseMimeType": "application/json",
        },
    }

    global _sem
    if _sem is None:
        _sem = asyncio.Semaphore(CONCURRENCY)

    try:
        async with _sem:
            client = _get_client()
            resp = await client.post(url, json=payload, timeout=timeout)
            if resp.status_code in (401, 403):
                log.error("Gemini API rejected key (HTTP %s)", resp.status_code)
                _record_failure(auth=True)
                return None
            if resp.status_code != 200:
                log.warning("Gemini REST API error HTTP %s: %s", resp.status_code, resp.text[:150])
                _record_failure()
                return None

            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts and "text" in parts[0]:
                    return _extract_json(parts[0]["text"])
    except (httpx.TimeoutException, httpx.TransportError) as exc:
        log.warning("Gemini request network error: %s", type(exc).__name__)
        _record_failure()
    except Exception as exc:
        log.warning("Gemini REST parsing failed: %s", exc)
        _record_failure()
    return None


async def _call_llm(slug: Optional[str], title: str, description: str, timeout: float) -> Optional[SeverityResult]:
    api_key = _get_api_key()
    if not api_key:
        return None

    model = _get_model()
    prompt = _user_prompt(slug, title, description)

    # 1. Try SDK
    res_json = await _gemini_sdk_answer(api_key, model, prompt, timeout)
    # 2. Try REST fallback if SDK did not return
    if res_json is None:
        res_json = await _gemini_rest_answer(api_key, model, prompt, timeout)

    if res_json is None:
        return None

    try:
        raw_score = int(res_json.get("score", 50))
        score = max(0, min(100, raw_score))
        sev = str(res_json.get("severity", "")).lower().strip()
        expected_sev = _score_to_severity(score)
        if sev not in ("low", "medium", "high", "critical"):
            sev = expected_sev

        reason = str(res_json.get("reason") or "").strip()[:200] or None
        factors = [f for f in (res_json.get("factors") or []) if f in _FACTORS][:6]

        _record_success()
        return SeverityResult(
            severity=sev,
            score=score,
            source="ai",
            reason=reason,
            factors=factors,
        )
    except Exception as exc:
        log.warning("Failed to interpret Gemini response: %s", exc)
        _record_failure()
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Main Classification Entry Points
# ─────────────────────────────────────────────────────────────────────────────
async def classify_incident(
    category_slug: Optional[str],
    title: str,
    description: str,
    *,
    preview: bool = False,
) -> SeverityResult:
    """
    AI severity classification using Gemini LLM with safe deterministic fallback.
    Never raises an exception.
    """
    slug = (category_slug or "").lower().strip() or None
    clean_title = _clean(title, MAX_TITLE_CHARS)
    clean_desc = _clean(description, MAX_DESC_CHARS)

    rules_score = _rule_score(slug, clean_title, clean_desc)
    fallback = SeverityResult(
        severity=_score_to_severity(rules_score),
        score=rules_score,
        source="rules",
    )

    try:
        if not ai_enabled() or _breaker_open() or not (clean_title or clean_desc):
            return fallback

        # If live preview is disabled or input text is too short, use fallback to save quota
        if preview and (not _flag("SEVERITY_AI_PREVIEW") or (len(clean_title) + len(clean_desc) < MIN_PREVIEW_CHARS)):
            return fallback

        key = (slug, clean_title.lower(), clean_desc.lower())
        cached = _cache_get(key)
        if cached:
            return cached

        timeout = PREVIEW_TIMEOUT_S if preview else SUBMIT_TIMEOUT_S
        res = await _call_llm(slug, clean_title, clean_desc, timeout)
        if res is None:
            return fallback

        _cache_put(key, res)
        return res
    except Exception:
        log.exception("Severity classification failed; defaulting to safe rules")
        return fallback


async def apreview_severity(category_slug: Optional[str], title: str, description: str) -> dict:
    """Live-preview payload: {severity, score, source, reason, factors}."""
    return (await classify_incident(category_slug, title, description, preview=True)).as_dict()


async def acompute_severity(category_slug: Optional[str], title: str, description: str) -> str:
    """Final severity used when the incident is created."""
    return (await classify_incident(category_slug, title, description, preview=False)).severity
