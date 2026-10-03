"""
SeverityEngine — Deterministic, rule-based severity scoring.

Scoring Strategy
────────────────
1. Category baseline     → derived from INCIDENT_SPECS probability tables in seed_db
2. Title keyword boost   → matched against curated danger-word lists
3. Description boost     → same keyword scan on the longer text (lower weight)
4. Final tier mapping    → total score → low / medium / high / critical

All weights and thresholds are expressed as integers (0-100 scale) to keep
the logic inspectable and testable without a ML runtime.

The result is **deterministic**: same inputs → same output, always.
"""
from __future__ import annotations

from typing import Optional

# ─────────────────────────────────────────────────────────────────────────────
# Category baseline scores (0-100 scale, derived from seed severity weights)
# ─────────────────────────────────────────────────────────────────────────────
_CATEGORY_BASE: dict[str, int] = {
    # Critical-leaning categories
    "gas_leak":              85,
    "assault_violence":      80,
    "missing_person":        75,
    "animal_bite":           75,
    "crime":                 70,
    "accident":              70,
    "theft_robbery":         60,
    "drainage_flooding":     55,
    "electrical_outage":     55,
    "road_hazard":           55,
    "harassment":            50,
    "pedestrian_safety":     50,
    "traffic_signal_malfunction": 48,
    "suspicious_activity":   45,
    "construction_hazard":   45,
    "public_health_concern": 43,
    "poor_lighting":         40,
    "traffic_violation":     40,
    "fallen_tree_branch":    40,
    "water_leakage":         35,
    "sewage_issue":          35,
    "public_infrastructure": 35,
    "illegal_dumping":       28,
    "vandalism":             28,
    "lost_and_found":        15,
}

_CATEGORY_BASE_DEFAULT = 40   # for any unmapped / future category

# ─────────────────────────────────────────────────────────────────────────────
# Keyword boost tables — matched on lowercased title + description
# ─────────────────────────────────────────────────────────────────────────────
_CRITICAL_KEYWORDS = {
    # immediate life threat
    "fire", "burning", "explosion", "blast", "bomb", "deadly", "death",
    "fatality", "fatal", "killed", "murder", "gunshot", "shot", "stab",
    "stabbing", "unconscious", "unresponsive", "overdose", "drowning",
    "gas leak", "toxic", "poison", "chemical", "ambulance", "critical",
    "urgent", "emergency", "life threatening", "multiple casualties",
    "major accident", "building collapse",
}

_HIGH_KEYWORDS = {
    "injured", "injury", "blood", "assault", "attack", "violent", "violence",
    "serious", "severe", "dangerous", "hazardous", "immediate", "urgent",
    "robbery", "robbed", "abducted", "kidnapped", "missing child",
    "missing woman", "street fight", "brawl", "weapon", "knife", "gang",
    "crash", "collision", "hit and run", "major", "critical",
    "broken bone", "fracture", "hospital", "surgery",
}

_MEDIUM_KEYWORDS = {
    "accident", "suspicious", "harass", "threat", "damage", "leak",
    "flood", "block", "pothole", "malfunction", "broken", "unsafe",
    "dark", "unlit", "missing", "vandal", "nuisance", "concern",
    "overcrowd", "illegal", "overflooding", "waterlogged", "slippery",
    "speeding", "drunk", "signal", "spilled",
}


def _keyword_boost(text: str) -> int:
    """Return 0-30 point bonus based on keyword matches in the text."""
    lower = text.lower()
    if any(kw in lower for kw in _CRITICAL_KEYWORDS):
        return 30
    if any(kw in lower for kw in _HIGH_KEYWORDS):
        return 18
    if any(kw in lower for kw in _MEDIUM_KEYWORDS):
        return 8
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# Score → Severity tier
# ─────────────────────────────────────────────────────────────────────────────
_THRESHOLDS = [
    (80, "critical"),
    (60, "high"),
    (38, "medium"),
    (0,  "low"),
]

def _score_to_severity(score: int) -> str:
    for threshold, label in _THRESHOLDS:
        if score >= threshold:
            return label
    return "low"


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────
def compute_severity(
    category_slug: str,
    title: str,
    description: str,
) -> str:
    """
    Deterministically compute severity from category + title + description.

    Returns one of: "low", "medium", "high", "critical"
    """
    base = _CATEGORY_BASE.get(category_slug.lower().strip(), _CATEGORY_BASE_DEFAULT)

    # Title carries more weight (40 %) than description (60 %) keyword scan
    title_boost = _keyword_boost(title)
    desc_boost  = int(_keyword_boost(description) * 0.60)   # dampen

    total = min(100, base + title_boost + desc_boost)
    return _score_to_severity(total)


def preview_severity(
    category_slug: Optional[str],
    title: str,
    description: str,
) -> dict:
    """
    Returns {severity, score} suitable for a live-preview API response.
    If category_slug is None/empty, uses the default base.
    """
    slug  = (category_slug or "").lower().strip()
    base  = _CATEGORY_BASE.get(slug, _CATEGORY_BASE_DEFAULT)
    tb    = _keyword_boost(title)
    db    = int(_keyword_boost(description) * 0.60)
    total = min(100, base + tb + db)
    sev   = _score_to_severity(total)
    return {"severity": sev, "score": total}
