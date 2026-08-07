"""
SafeCity Seed Script
Populates the database with sample data for:
- Learning Article Categories & Articles
- Community Alerts
- Emergency Contacts (for existing users)

Usage: venv\Scripts\python seed_data.py
"""
import asyncio
import uuid
import re
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.core.config import settings
from app.models.learning import Article, ArticleCategory
from app.models.alert import CommunityAlert, AlertType

# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    return re.sub(r'[-\s]+', '-', slug).strip('-')

def utcnow():
    return datetime.now(timezone.utc)


# ─────────────────────────────────────────────────────────────
# Seed Data
# ─────────────────────────────────────────────────────────────

CATEGORIES = [
    {"name": "Personal Safety", "icon": "🛡️", "description": "Tips and guidelines for staying safe in public and at home."},
    {"name": "Emergency Response", "icon": "🚨", "description": "What to do in various emergency situations."},
    {"name": "Cyber Safety", "icon": "💻", "description": "Protecting yourself online and from digital threats."},
    {"name": "Women's Safety", "icon": "👩", "description": "Dedicated safety guidelines and resources for women."},
    {"name": "Child Safety", "icon": "🧒", "description": "Keeping children safe in various situations."},
    {"name": "Road Safety", "icon": "🚗", "description": "Safe driving, pedestrian, and road use tips."},
]

ARTICLES = [
    {
        "category": "Personal Safety",
        "title": "How to Stay Safe While Walking Alone at Night",
        "overview": "Walking alone at night can be risky. This guide covers practical tips to stay aware, use technology, and de-escalate threats.",
        "content_dos": "Stay in well-lit areas. Carry a fully charged phone. Share your live location with a trusted contact. Walk confidently and stay alert. Trust your instincts — if something feels wrong, leave.",
        "content_donts": "Avoid wearing headphones at high volume. Don't look at your phone constantly while walking. Avoid shortcuts through unfamiliar alleys. Don't ignore your gut feeling.",
        "emergency_steps": "1. Call 112 or local emergency services immediately. 2. Scream loudly to attract attention. 3. Run to the nearest public place (shop, restaurant, etc.). 4. Activate SOS on your SafeCity app.",
        "helpline_numbers": "Emergency: 112 | Police: 100 | Women's Helpline: 1091",
        "legal_info": "You have the right to defend yourself against unlawful assault. Self-defense laws permit reasonable force to protect yourself.",
    },
    {
        "category": "Emergency Response",
        "title": "What to Do During an Earthquake",
        "overview": "Earthquakes can strike without warning. Knowing the right actions can save your life. Drop, Cover, and Hold On is the globally recommended response.",
        "content_dos": "Drop to your hands and knees immediately. Take cover under a sturdy table or desk. Hold on until shaking stops. Move away from windows and heavy furniture.",
        "content_donts": "Don't run outside during shaking — most injuries occur from falling debris near exits. Don't use elevators. Don't stand in doorways.",
        "emergency_steps": "1. DROP, COVER, HOLD ON. 2. Stay inside until shaking stops. 3. Evacuate calmly using stairs. 4. Avoid damaged areas. 5. Check for gas leaks.",
        "helpline_numbers": "NDRF: 011-24363260 | Emergency: 112",
        "legal_info": "After a major disaster, local authorities may issue mandatory evacuation orders. Compliance is legally required for public safety zones.",
    },
    {
        "category": "Cyber Safety",
        "title": "Protecting Yourself from Online Scams",
        "overview": "Online scams including phishing, fake job offers, and romance scams are increasingly common. Learn how to identify and avoid them.",
        "content_dos": "Verify the sender's email address carefully. Use two-factor authentication (2FA). Check URLs before clicking. Report suspicious messages to the platform.",
        "content_donts": "Don't share OTPs, passwords, or bank details with anyone. Don't click links from unknown senders. Don't install apps from unofficial sources.",
        "emergency_steps": "1. Stop all communication with the suspected scammer. 2. Report to the National Cyber Crime Portal (cybercrime.gov.in). 3. Contact your bank immediately if financial info was shared.",
        "helpline_numbers": "Cyber Crime Helpline: 1930 | cybercrime.gov.in",
        "legal_info": "Online fraud is punishable under the IT Act 2000 Sections 66C and 66D with up to 3 years imprisonment.",
    },
    {
        "category": "Women's Safety",
        "title": "Staying Safe Using Ride-Sharing Apps",
        "overview": "Ride-sharing apps are convenient but require precautions. This guide covers essential safety checks before and during your ride.",
        "content_dos": "Always verify the driver's name, photo, and car number before entering. Share your ride details with a friend. Sit in the back seat. Keep your phone charged.",
        "content_donts": "Don't accept rides from unlicensed drivers. Don't share your destination with strangers nearby. Don't fall asleep during the ride.",
        "emergency_steps": "1. Trust your instincts — ask the driver to stop at a safe public place. 2. Call 100 or 1091 immediately. 3. Use the SOS feature in your SafeCity app. 4. Alert nearby people.",
        "helpline_numbers": "Women's Helpline: 1091 | Emergency: 112 | Mahila Suraksha: 181",
        "legal_info": "Drivers are legally required to be registered and carry valid permits. You can file a complaint with local transport authority for license violations.",
    },
    {
        "category": "Road Safety",
        "title": "Pedestrian Safety Guidelines",
        "overview": "Pedestrians account for a significant portion of road accident fatalities. Simple habits can drastically reduce your risk.",
        "content_dos": "Use designated pedestrian crossings. Make eye contact with drivers before crossing. Walk on the pavement/footpath. Look both ways before crossing.",
        "content_donts": "Don't use your phone while crossing. Avoid wearing dark clothing at night without reflective gear. Don't jaywalk. Don't assume vehicles will stop for you.",
        "emergency_steps": "1. If you witness an accident, call 108 (Ambulance) and 100 (Police). 2. Do not move an injured person unless there is immediate danger. 3. Keep the injured person calm until help arrives.",
        "helpline_numbers": "Ambulance: 108 | Police: 100 | Traffic Control: 103",
        "legal_info": "Jaywalking is illegal in many jurisdictions and can result in fines. Pedestrians have right-of-way at designated crossings.",
    },
    {
        "category": "Child Safety",
        "title": "Teaching Children About Stranger Danger",
        "overview": "Children need clear, age-appropriate education about identifying unsafe situations with strangers and trusted adults.",
        "content_dos": "Teach the 'no, go, yell, tell' rule. Help children identify trusted adults (teachers, police, family). Practice safety scenarios. Keep communication open.",
        "content_donts": "Don't use fear-based approaches that make children anxious. Don't teach children to be rude to adults — rather teach assertive refusal.",
        "emergency_steps": "1. Teach children to find a safe adult and say 'I need help'. 2. Children should run to a crowded public space. 3. They should call a parent or 112 at first opportunity.",
        "helpline_numbers": "Childline: 1098 | Emergency: 112",
        "legal_info": "The Protection of Children from Sexual Offences (POCSO) Act protects minors. Any offence against a child should be reported to police immediately.",
    },
]

COMMUNITY_ALERTS = [
    {
        "title": "High Crime Area Advisory - Downtown District",
        "message": "Our analysis shows elevated theft and mugging reports in the Downtown area over the past 7 days. Exercise extra caution, especially after dark. Travel in groups and avoid displaying valuables.",
        "alert_type": AlertType.HIGH_RISK_AREA,
        "expires_in_hours": 168,  # 1 week
    },
    {
        "title": "System Announcement: SafeCity App Now Available",
        "message": "Welcome to SafeCity! Our community safety platform is now live. You can report incidents, view the live safety map, plan safe routes, and access emergency contacts all in one place.",
        "alert_type": AlertType.SYSTEM_ANNOUNCEMENT,
        "expires_in_hours": None,  # permanent
    },
    {
        "title": "Flash Flood Warning - Low-Lying Areas",
        "message": "Heavy rainfall is expected over the next 48 hours. Residents in low-lying and flood-prone areas are advised to move to higher ground. Avoid crossing flooded roads.",
        "alert_type": AlertType.EMERGENCY_NOTICE,
        "expires_in_hours": 48,
    },
]


async def seed():
    # Build async engine from config
    db_url = settings.DATABASE_URL.replace("postgresql+psycopg2://", "postgresql+asyncpg://").replace("postgresql://", "postgresql+asyncpg://")
    
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        print("=== SafeCity Seeder ===")
        
        # ── Article Categories ────────────────────────────
        print("\n[1/3] Seeding Article Categories and Articles...")
        cat_map = {}
        for cat_data in CATEGORIES:
            from sqlalchemy import select
            # Check if already exists
            result = await session.execute(
                select(ArticleCategory).where(ArticleCategory.name == cat_data["name"])
            )
            existing = result.scalar_one_or_none()
            if existing:
                cat_map[cat_data["name"]] = existing
                print(f"  SKIP (exists): {cat_data['name']}")
                continue
            
            cat = ArticleCategory(
                id=str(uuid.uuid4()),
                name=cat_data["name"],
                slug=_slugify(cat_data["name"]),
                description=cat_data["description"],
                icon=cat_data["icon"],
            )
            session.add(cat)
            cat_map[cat_data["name"]] = cat
            print(f"  CREATED category: {cat_data['name']}")
        
        await session.commit()
        
        # Reload cats to get IDs after commit
        for cat_data in CATEGORIES:
            result = await session.execute(
                select(ArticleCategory).where(ArticleCategory.name == cat_data["name"])
            )
            cat_map[cat_data["name"]] = result.scalar_one()
        
        # ── Articles ──────────────────────────────────────
        for art_data in ARTICLES:
            category = cat_map.get(art_data["category"])
            if not category:
                continue
            
            slug = _slugify(art_data["title"])
            result = await session.execute(
                select(Article).where(Article.slug == slug)
            )
            if result.scalar_one_or_none():
                print(f"  SKIP (exists): {art_data['title']}")
                continue
            
            article = Article(
                id=str(uuid.uuid4()),
                title=art_data["title"],
                slug=slug,
                overview=art_data["overview"],
                content_dos=art_data.get("content_dos"),
                content_donts=art_data.get("content_donts"),
                emergency_steps=art_data.get("emergency_steps"),
                helpline_numbers=art_data.get("helpline_numbers"),
                legal_info=art_data.get("legal_info"),
                category_id=category.id,
            )
            session.add(article)
            print(f"  CREATED article: {art_data['title']}")
        
        await session.commit()
        
        # ── Community Alerts ──────────────────────────────
        print("\n[2/3] Seeding Community Alerts...")
        from sqlalchemy import select as sa_select
        for alert_data in COMMUNITY_ALERTS:
            result = await session.execute(
                sa_select(CommunityAlert).where(CommunityAlert.title == alert_data["title"])
            )
            if result.scalar_one_or_none():
                print(f"  SKIP (exists): {alert_data['title']}")
                continue
            
            expires_at = None
            if alert_data.get("expires_in_hours"):
                expires_at = utcnow() + timedelta(hours=alert_data["expires_in_hours"])
            
            alert = CommunityAlert(
                id=str(uuid.uuid4()),
                title=alert_data["title"],
                message=alert_data["message"],
                alert_type=alert_data["alert_type"],
                expires_at=expires_at,
            )
            session.add(alert)
            print(f"  CREATED alert: {alert_data['title']}")
        
        await session.commit()
        
        print("\n[3/3] Done!")
        print("\n=== Seeding Complete ===")
    
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
