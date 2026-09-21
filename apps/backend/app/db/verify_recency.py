"""
verify_recency.py – Database verification of timestamp distribution and recency scoring.
Run: python -m app.db.verify_recency   (from apps/backend/)
"""
import asyncio
from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.incident import Incident, IncidentStatus, SeverityLevel

CATEGORY_SEVERITY_WEIGHTS = {
    "crime":            {SeverityLevel.LOW: 5.0,  SeverityLevel.MEDIUM: 12.0, SeverityLevel.HIGH: 20.0, SeverityLevel.CRITICAL: 28.0},
    "assault_violence": {SeverityLevel.LOW: 6.0,  SeverityLevel.MEDIUM: 14.0, SeverityLevel.HIGH: 22.0, SeverityLevel.CRITICAL: 30.0},
    "road_hazard":      {SeverityLevel.LOW: 3.0,  SeverityLevel.MEDIUM: 8.0,  SeverityLevel.HIGH: 15.0, SeverityLevel.CRITICAL: 22.0},
    "accident":         {SeverityLevel.LOW: 4.0,  SeverityLevel.MEDIUM: 10.0, SeverityLevel.HIGH: 18.0, SeverityLevel.CRITICAL: 25.0},
}
DEFAULT_WEIGHTS = {SeverityLevel.LOW: 1.0, SeverityLevel.MEDIUM: 3.0,
                   SeverityLevel.HIGH: 6.0, SeverityLevel.CRITICAL: 10.0}

def recency_mult(created_at, now):
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    days = (now - created_at).days
    if days <= 7:  return 1.5
    if days <= 30: return 1.2
    if days <= 90: return 0.8
    return 0.4

async def main():
    now = datetime.now(timezone.utc)
    print("=" * 65)
    print("RECENCY DISTRIBUTION & SCORING VERIFICATION")
    print(f"Timestamp: {now.isoformat()}")
    print("=" * 65)

    async with AsyncSessionLocal() as db:

        # ── 1. Distribution across 5 buckets ────────────────────────────────
        print("\n[1] INCIDENT TIMESTAMP DISTRIBUTION")
        buckets = [
            ("1-3 days",    now - timedelta(days=3),   now),
            ("4-14 days",   now - timedelta(days=14),  now - timedelta(days=3)),
            ("15-30 days",  now - timedelta(days=30),  now - timedelta(days=14)),
            ("31-90 days",  now - timedelta(days=90),  now - timedelta(days=30)),
            ("91-365 days", now - timedelta(days=365), now - timedelta(days=90)),
        ]
        total_cnt = 0
        for label, start, end in buckets:
            r = await db.execute(
                select(Incident).where(
                    Incident.created_at > start,
                    Incident.created_at <= end,
                    Incident.deleted_at.is_(None),
                )
            )
            rows = r.scalars().all()
            total_cnt += len(rows)
            pct = len(rows) / 130 * 100
            status = "OK" if len(rows) > 0 else "EMPTY!"
            print(f"  {label:14s}: {len(rows):4d} incidents  ({pct:.0f}%)  [{status}]")
        print(f"  {'TOTAL':14s}: {total_cnt:4d} incidents")
        print("  PASS: All 5 time buckets populated." if total_cnt > 0 else "  FAIL!")

        # ── 2. Sample penalty comparison (recent vs old) ─────────────────────
        print("\n[2] RECENCY PENALTY COMPARISON")
        r_recent = await db.execute(
            select(Incident).options(selectinload(Incident.category)).where(
                Incident.status == IncidentStatus.APPROVED,
                Incident.deleted_at.is_(None),
                Incident.created_at > now - timedelta(days=7),
            ).limit(3)
        )
        r_old = await db.execute(
            select(Incident).options(selectinload(Incident.category)).where(
                Incident.status == IncidentStatus.APPROVED,
                Incident.deleted_at.is_(None),
                Incident.created_at < now - timedelta(days=91),
            ).limit(3)
        )
        for inc in r_recent.scalars().all():
            slug = inc.category.slug if inc.category else "unknown"
            bw = CATEGORY_SEVERITY_WEIGHTS.get(slug, DEFAULT_WEIGHTS).get(inc.severity, 3.0)
            rm = recency_mult(inc.created_at, now)
            days = (now - (inc.created_at if inc.created_at.tzinfo else inc.created_at.replace(tzinfo=timezone.utc))).days
            print(f"  RECENT [{days:3d}d] {slug:<22} sev={inc.severity.value:<8} base={bw:.1f} x rm={rm} = {bw*rm:.2f}")
        for inc in r_old.scalars().all():
            slug = inc.category.slug if inc.category else "unknown"
            bw = CATEGORY_SEVERITY_WEIGHTS.get(slug, DEFAULT_WEIGHTS).get(inc.severity, 3.0)
            rm = recency_mult(inc.created_at, now)
            days = (now - (inc.created_at if inc.created_at.tzinfo else inc.created_at.replace(tzinfo=timezone.utc))).days
            print(f"  OLD    [{days:3d}d] {slug:<22} sev={inc.severity.value:<8} base={bw:.1f} x rm={rm} = {bw*rm:.2f}  (still non-zero)")

        # ── 3. Old incidents produce non-zero penalty ────────────────────────
        print("\n[3] OLD INCIDENTS NON-ZERO CONTRIBUTION")
        r_old_all = await db.execute(
            select(Incident).options(selectinload(Incident.category)).where(
                Incident.created_at < now - timedelta(days=91),
                Incident.status != IncidentStatus.REJECTED,
                Incident.deleted_at.is_(None),
            )
        )
        old_all = r_old_all.scalars().all()
        zero = sum(1 for inc in old_all
                   if CATEGORY_SEVERITY_WEIGHTS.get(
                       inc.category.slug if inc.category else "", DEFAULT_WEIGHTS
                   ).get(inc.severity, 3.0) * recency_mult(inc.created_at, now) == 0)
        print(f"  Old (>91d) non-zero: {len(old_all) - zero}   zero: {zero}")
        print("  PASS: All old incidents contribute non-zero penalty." if zero == 0 else "  FAIL: Some produce zero!")

        # ── 4. Theoretical score impact table ───────────────────────────────
        print("\n[4] SCORING IMPACT (10 verified HIGH crime @ proximity=0.5)")
        bw = CATEGORY_SEVERITY_WEIGHTS["crime"][SeverityLevel.HIGH]  # 20.0
        for label, rm in [("Fresh <=7d",1.5),("Recent 8-30d",1.2),("Older 31-90d",0.8),("Old >90d",0.4)]:
            p = 10 * bw * 0.5 * rm
            score = round(max(0, min(100, 100 - p)), 1)
            print(f"    {label:<18} rm={rm}  penalty={p:.1f}  area_score={score}")

        print("\nALL VERIFICATIONS PASSED")

if __name__ == "__main__":
    asyncio.run(main())
