"""
fix_incident_timestamps.py
==========================
Updates the created_at / updated_at timestamps of ALL existing incidents
to demonstrate the recency-decay factor in the SafeCity scoring algorithm.

Distribution applied:
  Bucket A –  ~15% : 1–3 days ago   (recency_mult = 1.5×)
  Bucket B –  ~20% : 4–14 days ago  (recency_mult = 1.5× → 1.2×)
  Bucket C –  ~25% : 15–30 days ago (recency_mult = 1.2×)
  Bucket D –  ~20% : 31–90 days ago (recency_mult = 0.8×)
  Bucket E –  ~20% : 91–365 days ago (recency_mult = 0.4×)

Rules:
  - GPS coordinates, categories, severity, status, descriptions unchanged.
  - updated_at = created_at + (1–12 hours) to remain logically consistent.
  - Hour/minute of each timestamp is randomised across the full day.
  - Incidents are shuffled before assignment so every category ends up
    represented across all buckets.
"""

import asyncio
import logging
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.incident import Incident

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger(__name__)


# ── Bucket definitions ────────────────────────────────────────────────────────
# Each bucket: (label, day_min, day_max, fraction, recency_note)
BUCKETS = [
    ("A – Very Recent (1–3d)",    1,   3,  0.15, "recency_mult=1.5"),
    ("B – Recent (4–14d)",        4,  14,  0.20, "recency_mult=1.2–1.5"),
    ("C – Moderate (15–30d)",    15,  30,  0.25, "recency_mult=1.2"),
    ("D – Older (31–90d)",       31,  90,  0.20, "recency_mult=0.8"),
    ("E – Much Older (91–365d)", 91, 365,  0.20, "recency_mult=0.4"),
]


def _random_ts(days_min: int, days_max: int, now: datetime) -> datetime:
    """Return a random timezone-aware timestamp within the given age window."""
    days_ago = random.randint(days_min, days_max)
    hour     = random.randint(0, 23)
    minute   = random.randint(0, 59)
    second   = random.randint(0, 59)
    return now - timedelta(days=days_ago, hours=23 - hour,
                           minutes=59 - minute, seconds=59 - second)


async def fix_timestamps(db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)

    # 1. Fetch all non-deleted incidents (id only – we only need to update timestamps)
    result = await db.execute(
        select(Incident.id).where(Incident.deleted_at.is_(None))
        .order_by(Incident.id)
    )
    ids: list[str] = [row[0] for row in result.all()]
    total = len(ids)

    if total == 0:
        log.warning("No incidents found. Run seed_db.py first.")
        return

    log.info(f"Found {total} incidents to redistribute across 5 time buckets.")

    # 2. Shuffle so every category/severity ends up in multiple buckets
    random.shuffle(ids)

    # 3. Assign each incident id to a bucket proportionally
    assignments: list[tuple[str, int, int]] = []   # (id, days_min, days_max)
    cursor = 0
    for label, d_min, d_max, fraction, note in BUCKETS:
        count = round(total * fraction)
        bucket_ids = ids[cursor: cursor + count]
        cursor += count
        for inc_id in bucket_ids:
            assignments.append((inc_id, d_min, d_max))
        log.info(f"  {label} [{note}] → {len(bucket_ids)} incidents")

    # Any remainder (from rounding) goes into bucket B
    remainder_ids = ids[cursor:]
    if remainder_ids:
        for inc_id in remainder_ids:
            assignments.append((inc_id, 4, 14))
        log.info(f"  Remainder → {len(remainder_ids)} incidents → Bucket B (4–14d)")

    # 4. Build update payloads
    update_payloads: list[dict] = []
    for inc_id, d_min, d_max in assignments:
        created = _random_ts(d_min, d_max, now)
        # updated_at is 1–12 hours after created_at, but never in the future
        delta_hours = random.randint(1, 12)
        updated = created + timedelta(hours=delta_hours)
        if updated > now:
            updated = now - timedelta(minutes=random.randint(1, 60))
        update_payloads.append({
            "_id": inc_id,
            "created_at": created,
            "updated_at": updated,
        })

    # 5. Apply updates in a single bulk pass
    log.info(f"Applying {len(update_payloads)} timestamp updates…")
    for payload in update_payloads:
        await db.execute(
            update(Incident)
            .where(Incident.id == payload["_id"])
            .values(created_at=payload["created_at"], updated_at=payload["updated_at"])
        )

    await db.commit()
    log.info("All timestamps committed.")


async def verify_distribution(db: AsyncSession) -> None:
    """Confirm the five buckets are all populated."""
    now = datetime.now(timezone.utc)
    cutoffs = [
        ("1–3 days",    now - timedelta(days=3),   now),
        ("4–14 days",   now - timedelta(days=14),  now - timedelta(days=3)),
        ("15–30 days",  now - timedelta(days=30),  now - timedelta(days=14)),
        ("31–90 days",  now - timedelta(days=90),  now - timedelta(days=30)),
        ("91–365 days", now - timedelta(days=365), now - timedelta(days=90)),
    ]

    log.info("\n── Verification: incident counts per time bucket ──")
    for label, start, end in cutoffs:
        result = await db.execute(
            select(Incident).where(
                Incident.created_at > start,
                Incident.created_at <= end,
                Incident.deleted_at.is_(None),
            )
        )
        rows = result.scalars().all()
        log.info(f"  {label:14s}: {len(rows):4d} incidents")

    # Total
    total_result = await db.execute(
        select(Incident).where(Incident.deleted_at.is_(None))
    )
    total = len(total_result.scalars().all())
    log.info(f"  {'TOTAL':14s}: {total:4d} incidents")


async def verify_scoring_recency(db: AsyncSession) -> None:
    """
    Quick scoring sanity check:
      - Pick one APPROVED crime incident from Bucket A (≤3 days old)
      - Pick one APPROVED crime incident from Bucket E (≥91 days old)
      - Compare their expected recency multipliers (1.5 vs 0.4)
    """
    from app.models.incident import IncidentStatus
    from sqlalchemy.orm import selectinload

    now = datetime.now(timezone.utc)

    recent_q = await db.execute(
        select(Incident).options(selectinload(Incident.category)).where(
            Incident.status == IncidentStatus.APPROVED,
            Incident.deleted_at.is_(None),
            Incident.created_at > now - timedelta(days=3),
        ).limit(1)
    )
    recent_inc = recent_q.scalars().first()

    old_q = await db.execute(
        select(Incident).options(selectinload(Incident.category)).where(
            Incident.status == IncidentStatus.APPROVED,
            Incident.deleted_at.is_(None),
            Incident.created_at < now - timedelta(days=91),
        ).limit(1)
    )
    old_inc = old_q.scalars().first()

    log.info("\n── Scoring Recency Sanity Check ──")
    if recent_inc:
        age = (now - recent_inc.created_at).days
        mult = 1.5
        log.info(
            f"  Recent incident : '{recent_inc.title[:60]}' "
            f"| age={age}d | recency_mult={mult} "
            f"| cat={recent_inc.category.slug if recent_inc.category else '?'} "
            f"| sev={recent_inc.severity.value}"
        )
    else:
        log.warning("  No recent (≤3d) APPROVED incident found.")

    if old_inc:
        age = (now - old_inc.created_at).days
        mult = 0.4
        log.info(
            f"  Old incident    : '{old_inc.title[:60]}' "
            f"| age={age}d | recency_mult={mult} "
            f"| cat={old_inc.category.slug if old_inc.category else '?'} "
            f"| sev={old_inc.severity.value}"
        )
    else:
        log.warning("  No old (≥91d) APPROVED incident found.")

    if recent_inc and old_inc:
        log.info(
            f"\n  Same category+severity pair would produce "
            f"{mult / 0.4:.1f}× more recency penalty for the recent incident "
            f"vs the old one (1.5 vs 0.4 multiplier)."
        )


async def main() -> None:
    async with AsyncSessionLocal() as session:
        await fix_timestamps(session)

    async with AsyncSessionLocal() as session:
        await verify_distribution(session)

    async with AsyncSessionLocal() as session:
        await verify_scoring_recency(session)


if __name__ == "__main__":
    asyncio.run(main())
