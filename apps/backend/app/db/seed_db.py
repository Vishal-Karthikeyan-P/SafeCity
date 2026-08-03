"""
Comprehensive Seed Script for SafeCity Database
Populates:
- Default categories (8)
- Admin user (admin@safecity.com)
- 25 Citizen users with profiles
- 85 Realistic incident reports across categories, severities, statuses, and PostGIS geometries
- Incident evidence images
- Notifications (45+)
"""
import asyncio
import logging
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.core.security import get_password_hash
from app.models.user import User, UserProfile, UserRole
from app.models.incident import (
    Incident, IncidentCategory, IncidentImage, SeverityLevel, IncidentStatus
)
from app.models.notification import Notification, NotificationType

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Base location for sample city grid (e.g., Bangalore Metro Area)
CITY_BASE_LAT = 12.9716
CITY_BASE_LNG = 77.5946

CATEGORIES_DATA = [
    {"name": "Crime", "slug": "crime", "icon": "🚨", "color": "#EF4444", "description": "Theft, assault, robbery, or vandalism."},
    {"name": "Harassment", "slug": "harassment", "icon": "⚠️", "color": "#F97316", "description": "Verbal or physical harassment, stalking, catcalling."},
    {"name": "Poor Lighting", "slug": "poor_lighting", "icon": "💡", "color": "#EAB308", "description": "Broken streetlights, unlit walkways, dark alleys."},
    {"name": "Road Hazard", "slug": "road_hazard", "icon": "🚧", "color": "#F59E0B", "description": "Potholes, missing manhole covers, blocked roads."},
    {"name": "Accident", "slug": "accident", "icon": "🚗", "color": "#EC4899", "description": "Traffic collisions, vehicle crashes, hit-and-run."},
    {"name": "Public Infrastructure", "slug": "public_infrastructure", "icon": "🏗️", "color": "#8B5CF6", "description": "Damaged bus stops, broken railings, water pipe leaks."},
    {"name": "Emergency", "slug": "emergency", "icon": "🆘", "color": "#DC2626", "description": "Fire hazards, medical emergencies, severe distress."},
    {"name": "Other", "slug": "other", "icon": "📋", "color": "#6B7280", "description": "General urban safety concerns not covered above."},
]

FIRST_NAMES = [
    "Aarav", "Ananya", "Rohan", "Priya", "Vikram", "Neha", "Rahul", "Sneha",
    "Aditya", "Kavya", "Siddharth", "Meera", "Arjun", "Pooja", "Karan", "Divya",
    "Varun", "Riya", "Akash", "Shreya", "Nikhil", "Tanvi", "Suresh", "Lakshmi", "Rajesh"
]
LAST_NAMES = [
    "Sharma", "Verma", "Patel", "Rao", "Nair", "Gupta", "Kumar", "Singh",
    "Joshi", "Deshmukh", "Reddy", "Iyer", "Kulkarni", "Mehta", "Bhat"
]

STREETS = [
    "100 Feet Road, Indiranagar", "MG Road Metro Station", "Koramangala 4th Block",
    "Brigade Road Junction", "Commercial Street", "HSR Layout Sector 1",
    "Whitefield Main Road", "Jayanagar 4th T Block", "Malleshwaram 8th Cross",
    "Electronic City Phase 1", "Hebbal Flyover Junction", "Marathahalli Bridge",
    "BTM Layout 2nd Stage", "Rajajinagar Metro Station", "Richmond Road Plaza",
    "Old Airport Road", "Ulsoor Lake Road", "Domlur Intermediate Ring Road",
    "Residency Road", "Cunningham Road", "Kalyan Nagar Main Road",
    "Banashankari 3rd Stage", "Vasanth Nagar", "Bellandur Flyover", "Yelahanka New Town"
]

INCIDENT_TITLES = {
    "crime": [
        "Snatch and Grab near Bus Stop", "Pickpocketing reported during peak hour",
        "Vehicle Window Smashed in Parking Lot", "Attempted Break-in at Residential Alley",
        "Bicycle Stolen from Metro Station Racks", "Stolen Wallet near ATM Kiosk"
    ],
    "harassment": [
        "Group Catcalling near Metro Entrance", "Followed along Dark Footpath",
        "Persistent Stalking at Bus Terminus", "Inappropriate Behavior near College Gate",
        "Aggressive Panhandling & Threats"
    ],
    "poor_lighting": [
        "All Streetlights Out on 5th Cross Road", "Flickering Lights along Pedestrian Pathway",
        "Complete Blackout under Railway Bridge", "Broken Lamp Post near Park Entrance",
        "Dark Corridor near Public Library"
    ],
    "road_hazard": [
        "Deep Open Pothole causing Vehicle Damage", "Uncovered Manhole in Middle of Lane",
        "Spilled Oil on Curved Road", "Broken Construction Barrier Blocked Pathway",
        "Fallen Tree Branch Obstructing Traffic"
    ],
    "accident": [
        "Two-Wheeler Collision near Signal", "Minor Rear-End Crash at Intersection",
        "Car Skidded off Wet Road Surface", "Pedestrian Struck near Zebra Crossing",
        "Collision between Auto and Delivery Bike"
    ],
    "public_infrastructure": [
        "Water Main Pipeline Burst & Flooding", "Broken Bus Shelter Glass Panes",
        "Collapsed Footpath Curb Tile", "Exposed High-Voltage Electrical Wires",
        "Damaged Guard Rail on Overbridge"
    ],
    "emergency": [
        "Electrical Transformer Sparking Fire", "Chemical Spill near Industrial Gate",
        "Building Facade Plaster Falling", "Gas Leak Odor in Commercial Alley"
    ],
    "other": [
        "Unattended Suspicious Baggage", "Illegal Dumping of Toxic Waste",
        "Stray Animals Aggressive Behavior", "Loud Unauthorized Construction at Midnight"
    ]
}

SAMPLE_IMAGE_URLS = [
    "/uploads/sample_pothole.jpg",
    "/uploads/sample_lighting.jpg",
    "/uploads/sample_hazard.jpg",
    "/uploads/sample_accident.jpg",
    "/uploads/sample_infrastructure.jpg"
]


async def seed_database(db: AsyncSession):
    logger.info("Starting database seeding...")

    # 1. Categories
    category_map = {}
    for cat_data in CATEGORIES_DATA:
        result = await db.execute(select(IncidentCategory).where(IncidentCategory.slug == cat_data["slug"]))
        cat = result.scalar_one_or_none()
        if not cat:
            cat = IncidentCategory(**cat_data)
            db.add(cat)
            await db.flush()
        category_map[cat.slug] = cat
    logger.info(f"Seeded {len(category_map)} incident categories.")

    # 2. Admin User
    admin_email = "admin@safecity.com"
    result = await db.execute(select(User).where(User.email == admin_email))
    admin_user = result.scalar_one_or_none()
    if not admin_user:
        admin_user = User(
            email=admin_email,
            full_name="System Administrator",
            hashed_password=get_password_hash("AdminPass123!"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        db.add(admin_user)
        await db.flush()
        profile = UserProfile(
            user_id=admin_user.id,
            phone="+18005550199",
            bio="SafeCity Central Administration Operations",
            city="Central Hub",
            country="India"
        )
        db.add(profile)
        await db.flush()
        logger.info(f"Created Admin account: {admin_email}")

    # 3. Citizen Users (25)
    users = [admin_user]
    for i in range(25):
        fname = FIRST_NAMES[i % len(FIRST_NAMES)]
        lname = LAST_NAMES[i % len(LAST_NAMES)]
        email = f"{fname.lower()}.{lname.lower()}{i+1}@safecity.demo"

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email=email,
                full_name=f"{fname} {lname}",
                hashed_password=get_password_hash("UserPass123!"),
                role=UserRole.CITIZEN,
                is_active=True,
                is_verified=True,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(30, 180))
            )
            db.add(user)
            await db.flush()

            profile = UserProfile(
                user_id=user.id,
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={fname}{lname}",
                phone=f"+9198{random.randint(10000000, 99999999)}",
                bio=f"Active citizen contributor residing in Metro Zone {i%5 + 1}.",
                emergency_contact_name=f"{LAST_NAMES[(i+2)%len(LAST_NAMES)]} Contact",
                emergency_contact_phone=f"+9197{random.randint(10000000, 99999999)}",
                city="Bangalore",
                country="India"
            )
            db.add(profile)
            await db.flush()
        users.append(user)

    logger.info(f"Ensured {len(users)} users (1 Admin + 25 Citizens).")

    # Check existing incidents count
    result = await db.execute(select(Incident))
    existing_incidents = result.scalars().all()
    if len(existing_incidents) >= 75:
        logger.info(f"Database already contains {len(existing_incidents)} incidents. Skipping incident generation.")
        return

    # 4. Generate 85 Realistic Incidents
    severities = [SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH, SeverityLevel.CRITICAL]
    statuses = [IncidentStatus.PENDING, IncidentStatus.UNDER_REVIEW, IncidentStatus.APPROVED, IncidentStatus.REJECTED, IncidentStatus.RESOLVED]
    status_weights = [0.15, 0.20, 0.40, 0.10, 0.15]  # Most are approved/review

    created_incidents = []
    now = datetime.now(timezone.utc)

    for idx in range(85):
        cat_slug = random.choice(list(category_map.keys()))
        category = category_map[cat_slug]
        title_template = random.choice(INCIDENT_TITLES[cat_slug])
        street = STREETS[idx % len(STREETS)]
        title = f"{title_template} - {street.split(',')[0]}"

        # Location around city base with jitter
        lat = round(CITY_BASE_LAT + random.uniform(-0.06, 0.06), 6)
        lng = round(CITY_BASE_LNG + random.uniform(-0.06, 0.06), 6)
        geom = f"SRID=4326;POINT({lng} {lat})"

        reporter = random.choice(users[1:]) if random.random() > 0.15 else None
        is_anon = True if reporter is None or random.random() < 0.2 else False

        severity = random.choices(severities, weights=[0.25, 0.45, 0.20, 0.10])[0]
        status = random.choices(statuses, weights=status_weights)[0]

        days_ago = random.randint(0, 60)
        created_time = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
        updated_time = created_time + timedelta(hours=random.randint(1, 12))

        admin_note = None
        if status == IncidentStatus.APPROVED:
            admin_note = "Verified by community moderation team. Dispatched to local authority."
        elif status == IncidentStatus.RESOLVED:
            admin_note = "Issue resolved by municipal maintenance crew."
        elif status == IncidentStatus.REJECTED:
            admin_note = "Insufficient details or duplicate report."
        elif status == IncidentStatus.UNDER_REVIEW:
            admin_note = "Assigned to administrator for verification."

        inc = Incident(
            title=title,
            description=f"Detailed report: {title_template} observed near {street}. Urgent attention requested to ensure safety of pedestrians and commuters.",
            category_id=category.id,
            severity=severity,
            status=status,
            is_anonymous=is_anon,
            location_address=f"{street}, Bangalore, Karnataka",
            location_lat=lat,
            location_lng=lng,
            location_geom=geom,
            admin_note=admin_note,
            reporter_id=None if is_anon else reporter.id,
            created_at=created_time,
            updated_at=updated_time,
        )
        db.add(inc)
        await db.flush()
        created_incidents.append(inc)

        # 5. Add Images to ~40% of incidents
        if random.random() < 0.4:
            img_url = random.choice(SAMPLE_IMAGE_URLS)
            img = IncidentImage(
                incident_id=inc.id,
                filename=img_url.split("/")[-1],
                url=img_url,
                created_at=created_time
            )
            db.add(img)

    await db.flush()
    logger.info(f"Successfully generated {len(created_incidents)} incident reports.")

    # 6. Generate Notifications (45+)
    notif_count = 0
    for user in users:
        # User notifications
        user_incidents = [i for i in created_incidents if i.reporter_id == user.id]
        for inc in user_incidents[:3]:
            notif = Notification(
                user_id=user.id,
                title=f"Incident Status: {inc.status.value.replace('_', ' ').title()}",
                message=f"Your incident report '{inc.title}' status was updated to {inc.status.value}.",
                type=NotificationType.INCIDENT_UPDATE,
                is_read=random.choice([True, False]),
                incident_id=inc.id,
                created_at=inc.updated_at
            )
            db.add(notif)
            notif_count += 1

        # Broadcast / System notification
        notif = Notification(
            user_id=user.id,
            title="Welcome to SafeCity Platform",
            message="Thank you for joining SafeCity. Report issues in your neighborhood to help build a safer community.",
            type=NotificationType.SYSTEM,
            is_read=True,
            created_at=now - timedelta(days=30)
        )
        db.add(notif)
        notif_count += 1

    await db.commit()
    logger.info(f"Successfully seeded {notif_count} notifications.")
    logger.info("Database seeding complete!")


if __name__ == "__main__":
    async def main():
        async with AsyncSessionLocal() as session:
            await seed_database(session)
    asyncio.run(main())
