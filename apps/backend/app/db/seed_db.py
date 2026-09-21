"""
SafeCity Seed Script — 130 Realistic Incidents across Coimbatore
=================================================================
Incidents are placed in geographically meaningful clusters:
  Zone A (Hot Zone) – Gandhipuram / Town Hall / RS Puram: HIGH density, crime/harassment/road
  Zone B (Moderate) – Singanallur / Trichy Road: medium density, traffic/accidents/infrastructure
  Zone C (Safe)     – Saravanampatti / IT Corridor: low density, minor issues
  Zone D (Roads)    – Along major arterial roads: road hazards, poor lighting
  Zone E (Scattered)– Rest of city: diverse minor incidents

Run: python -m app.db.seed_db   OR   python apps/backend/app/db/seed_db.py
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

# ─────────────────────────────────────────────────────────────────────────────
# Base coordinates – Coimbatore, Tamil Nadu, India
# ─────────────────────────────────────────────────────────────────────────────
CITY_BASE_LAT = 11.0168
CITY_BASE_LNG = 76.9558

# ─────────────────────────────────────────────────────────────────────────────
# Incident clusters – each entry: (zone_name, lat, lng, radius_deg, weight)
# weight: probability of drawing from this zone
# ─────────────────────────────────────────────────────────────────────────────
ZONES = [
    # HOT ZONES – Gandhipuram, RS Puram, Town Hall
    {"name": "Gandhipuram", "lat": 11.0168, "lng": 76.9558, "r": 0.012, "w": 3},
    {"name": "RS Puram",    "lat": 11.0031, "lng": 76.9520, "r": 0.012, "w": 3},
    {"name": "Town Hall",   "lat": 11.0120, "lng": 76.9620, "r": 0.010, "w": 2},
    # MODERATE ZONES – Singanallur, Ramanathapuram, Ukkadam
    {"name": "Singanallur", "lat": 11.0075, "lng": 77.0100, "r": 0.015, "w": 2},
    {"name": "Ramanathapuram", "lat": 10.9960, "lng": 76.9860, "r": 0.015, "w": 2},
    {"name": "Ukkadam",     "lat": 10.9920, "lng": 76.9700, "r": 0.012, "w": 2},
    # ROAD CORRIDORS – Trichy Road, Avinashi Road, Mettupalayam Road
    {"name": "Trichy Road",         "lat": 11.0050, "lng": 77.0050, "r": 0.020, "w": 2},
    {"name": "Avinashi Road",       "lat": 11.0250, "lng": 76.9850, "r": 0.020, "w": 2},
    {"name": "Mettupalayam Road",   "lat": 11.0200, "lng": 76.9450, "r": 0.018, "w": 1},
    # SAFE ZONES – Saravanampatti, Peelamedu
    {"name": "Saravanampatti", "lat": 11.0700, "lng": 77.0100, "r": 0.018, "w": 1},
    {"name": "Peelamedu",      "lat": 11.0450, "lng": 77.0020, "r": 0.015, "w": 1},
    # SCATTERED AREAS – Ganapathy, Vadavalli, Podanur
    {"name": "Ganapathy",  "lat": 11.0300, "lng": 76.9600, "r": 0.015, "w": 1},
    {"name": "Podanur",    "lat": 10.9790, "lng": 76.9530, "r": 0.015, "w": 1},
    {"name": "Vadavalli",  "lat": 11.0100, "lng": 76.9200, "r": 0.015, "w": 1},
]

# ─────────────────────────────────────────────────────────────────────────────
# Category → severity → status probabilities
# Incidents with route-relevant slugs should appear more often near road zones
# ─────────────────────────────────────────────────────────────────────────────
INCIDENT_SPECS = [
    # (slug, severity_weights, approved_pct, description_template)
    # HIGH IMPACT CATEGORIES
    ("crime", [("critical",0.15),("high",0.40),("medium",0.30),("low",0.15)], 0.75,
     "Criminal activity reported near {street}. Police assistance requested immediately."),
    ("assault_violence", [("critical",0.25),("high",0.45),("medium",0.25),("low",0.05)], 0.80,
     "Physical altercation reported at {street}. Medical assistance may be needed."),
    ("theft_robbery", [("critical",0.10),("high",0.40),("medium",0.35),("low",0.15)], 0.70,
     "Theft or robbery incident reported near {street}. Valuable items taken."),
    ("harassment", [("critical",0.10),("high",0.35),("medium",0.40),("low",0.15)], 0.65,
     "Harassment complaint filed at {street}. Victim has been assisted."),
    # ROAD CATEGORIES (route-relevant)
    ("accident", [("critical",0.20),("high",0.40),("medium",0.30),("low",0.10)], 0.80,
     "Traffic accident reported at {street}. Vehicles involved. Ambulance dispatched."),
    ("road_hazard", [("critical",0.10),("high",0.30),("medium",0.40),("low",0.20)], 0.75,
     "Road hazard identified at {street}. Risk to vehicles and pedestrians."),
    ("traffic_signal_malfunction", [("critical",0.10),("high",0.30),("medium",0.40),("low",0.20)], 0.70,
     "Traffic signal malfunction at {street}. Creating congestion and safety risk."),
    ("poor_lighting", [("critical",0.05),("high",0.25),("medium",0.45),("low",0.25)], 0.65,
     "Streetlight malfunction at {street}. Pedestrian path is dangerously dark."),
    ("traffic_violation", [("critical",0.05),("high",0.25),("medium",0.45),("low",0.25)], 0.60,
     "Dangerous traffic violation witnessed near {street}. Driver details noted."),
    ("pedestrian_safety", [("critical",0.10),("high",0.30),("medium",0.40),("low",0.20)], 0.70,
     "Pedestrian safety hazard at {street}. Crosswalk conditions are dangerous."),
    ("drainage_flooding", [("critical",0.10),("high",0.35),("medium",0.40),("low",0.15)], 0.65,
     "Drainage flooding at {street}. Vehicles unable to pass safely."),
    ("gas_leak", [("critical",0.35),("high",0.40),("medium",0.20),("low",0.05)], 0.85,
     "Gas leak odor reported near {street}. Area evacuated, fire dept called."),
    ("fallen_tree_branch", [("critical",0.05),("high",0.30),("medium",0.40),("low",0.25)], 0.75,
     "Fallen tree obstructing {street}. Traffic blocked."),
    ("construction_hazard", [("critical",0.10),("high",0.30),("medium",0.40),("low",0.20)], 0.65,
     "Construction hazard reported at {street}. Unbarricaded excavation."),
    ("suspicious_activity", [("critical",0.05),("high",0.30),("medium",0.45),("low",0.20)], 0.55,
     "Suspicious activity near {street}. Police notified."),
    # NON-ROUTE (area only)
    ("public_infrastructure", [("critical",0.05),("high",0.20),("medium",0.50),("low",0.25)], 0.70,
     "Infrastructure damage at {street}. Municipal team alerted."),
    ("water_leakage", [("critical",0.05),("high",0.20),("medium",0.45),("low",0.30)], 0.65,
     "Pipe burst and water leakage at {street}. Water board notified."),
    ("electrical_outage", [("critical",0.10),("high",0.30),("medium",0.40),("low",0.20)], 0.70,
     "Power outage reported at {street}. TNEB working on restoration."),
    ("sewage_issue", [("critical",0.05),("high",0.20),("medium",0.45),("low",0.30)], 0.60,
     "Sewage overflow near {street}. Foul odor and health concern."),
    ("illegal_dumping", [("critical",0.02),("high",0.15),("medium",0.45),("low",0.38)], 0.55,
     "Illegal waste dumped near {street}. Environmental concern."),
    ("missing_person", [("critical",0.20),("high",0.40),("medium",0.30),("low",0.10)], 0.75,
     "Missing person report filed. Last seen near {street}."),
    ("animal_bite", [("critical",0.20),("high",0.45),("medium",0.25),("low",0.10)], 0.80,
     "Stray animal bite reported near {street}. Victim seeking medical treatment."),
    ("public_health_concern", [("critical",0.10),("high",0.25),("medium",0.45),("low",0.20)], 0.65,
     "Public health concern near {street}. Sanitation team dispatched."),
    ("vandalism", [("critical",0.05),("high",0.20),("medium",0.45),("low",0.30)], 0.60,
     "Vandalism and property damage reported near {street}."),
    ("lost_and_found", [("critical",0.01),("high",0.05),("medium",0.30),("low",0.64)], 0.50,
     "Lost item reported near {street}. Contact the police station if found."),
]

STREETS = [
    "Gandhipuram Town Bus Stand", "DB Road, RS Puram", "Lakshmi Mills Junction, Avinashi Road",
    "Tidel Park Road, Peelamedu", "Ukkadam Bus Terminus", "Singanallur Junction, Trichy Road",
    "Saibaba Colony, Mettupalayam Road", "Cross Cut Road, Gandhipuram", "Ramanathapuram Junction",
    "Coimbatore Junction Railway Station", "Brookefields Mall Road, TV Samy Road",
    "Fun Republic Mall Gate, Avinashi Road", "Town Hall Main Road", "Thudiyalur Junction",
    "Saravanampatti Checkpost, IT Corridor", "Race Course Road Promenade", "Vadavalli Bus Stand",
    "Ganapathy Signal, Sathy Road", "SITRA Junction, Airport Road", "Hope College Bus Stop",
    "Ondipudur Flyover, Trichy Road", "Podanur Junction", "Perur Temple Road",
    "Kuniyamuthur Main Road", "Kovaipudur Center", "Avinashi Road near Tidel Park",
    "PSG College Road", "L&T Bypass Road", "Cowley Brown Road", "Anna Nagar Main Road",
]

CATEGORY_TITLES = {
    "crime": ["Snatch and grab near bus stop", "Pickpocket reported at busy junction",
              "Vehicle window broken in parking lot", "Attempted break-in at residential area"],
    "assault_violence": ["Physical fight at junction", "Assault reported near market",
                         "Group brawl at bus terminus", "Man attacked near ATM"],
    "theft_robbery": ["Handbag snatched from pedestrian", "Mobile phone stolen near college gate",
                      "Bike theft from parking area", "Gold chain snatched near temple"],
    "harassment": ["Group harassment near metro entrance", "Woman followed along dark footpath",
                   "Verbal abuse near college gate", "Persistent stalking at bus stand"],
    "accident": ["Two-wheeler collision at signal", "Car skidded on wet surface",
                 "Auto-rickshaw hit pedestrian near crossing", "Rear-end crash at junction"],
    "road_hazard": ["Deep pothole causing accidents", "Uncovered manhole in middle of road",
                    "Debris spilled on highway", "Fallen tree blocking traffic"],
    "traffic_signal_malfunction": ["Traffic light non-functional at junction",
                                   "Signal timer malfunction causing gridlock"],
    "poor_lighting": ["All streetlights out on main road", "Dark underpass - no lights",
                      "Street lighting failure near park", "Footpath completely unlit"],
    "traffic_violation": ["Dangerous wrong-way driving", "Reckless speeding near school",
                          "Red light jumping incidents", "Unlicensed vehicle on road"],
    "pedestrian_safety": ["No zebra crossing near school", "Pedestrians forced onto road",
                          "Footpath completely blocked", "Speed breaker missing near crossing"],
    "drainage_flooding": ["Road waterlogged after rain", "Drain overflow blocking vehicles",
                          "Storm drain blocked, flooding road"],
    "gas_leak": ["Gas pipeline odor near colony", "LPG leak reported at market area",
                 "Burning smell from pipeline junction"],
    "fallen_tree_branch": ["Large branch fallen on road", "Tree uprooted blocking lane",
                            "Fallen tree obstructing footpath"],
    "construction_hazard": ["Open pit without barricading", "Loose debris on road near site",
                            "Construction material blocking lane"],
    "suspicious_activity": ["Unattended suspicious bag found", "Unknown persons loitering near ATM",
                            "Suspicious vehicle parked for days"],
    "public_infrastructure": ["Bus shelter damaged", "Public toilet broken and unusable",
                              "Park bench vandalised", "Water main burst flooding road"],
    "water_leakage": ["Pipeline burst near junction", "Municipal water leaking on road",
                     "Large water leak from overhead tank"],
    "electrical_outage": ["Power outage in entire street", "Transformer breakdown",
                          "Exposed wire hanging from pole"],
    "sewage_issue": ["Sewage overflow near market", "Drain backing up near housing colony",
                     "Foul smell from open sewer"],
    "illegal_dumping": ["Construction waste dumped near park", "Garbage dumped on footpath",
                        "Industrial waste dumping near lake"],
    "missing_person": ["Missing elderly person near park", "Child not found after school",
                       "Missing adult last seen at bus stop"],
    "animal_bite": ["Stray dog bite near school", "Multiple dog attack near park",
                    "Animal bite - medical help needed"],
    "public_health_concern": ["Mosquito infestation near lake", "Garbage dumped causing health risk",
                               "Contaminated water supply area"],
    "vandalism": ["Public property vandalized", "Bus stop broken glass", "Garden walls defaced"],
    "lost_and_found": ["Wallet found at bus stand", "Lost keys near temple",
                       "Unclaimed bag at railway station"],
}

CATEGORIES_DATA = [
    {"name": "Crime", "slug": "crime", "icon": "🚨", "color": "#EF4444"},
    {"name": "Theft & Robbery", "slug": "theft_robbery", "icon": "👜", "color": "#DC2626"},
    {"name": "Violence & Assault", "slug": "assault_violence", "icon": "👊", "color": "#B91C1C"},
    {"name": "Harassment & Stalking", "slug": "harassment", "icon": "⚠️", "color": "#F97316"},
    {"name": "Suspicious Activity", "slug": "suspicious_activity", "icon": "👁️", "color": "#EA580C"},
    {"name": "Lost & Found", "slug": "lost_and_found", "icon": "🔍", "color": "#3B82F6"},
    {"name": "Missing Person", "slug": "missing_person", "icon": "👤", "color": "#EF4444"},
    {"name": "Missing Device / Phone", "slug": "missing_device", "icon": "📱", "color": "#6366F1"},
    {"name": "Property Damage", "slug": "property_damage", "icon": "🏚️", "color": "#D97706"},
    {"name": "Vandalism", "slug": "vandalism", "icon": "🎨", "color": "#B91C1C"},
    {"name": "Traffic Accident", "slug": "accident", "icon": "🚗", "color": "#EC4899"},
    {"name": "Illegal Parking", "slug": "illegal_parking", "icon": "🚫", "color": "#DB2777"},
    {"name": "Abandoned Vehicle", "slug": "abandoned_vehicle", "icon": "🚗", "color": "#6B7280"},
    {"name": "Road Hazard", "slug": "road_hazard", "icon": "🚧", "color": "#F59E0B"},
    {"name": "Traffic Signal Malfunction", "slug": "traffic_signal_malfunction", "icon": "🚦", "color": "#EF4444"},
    {"name": "Pedestrian Safety", "slug": "pedestrian_safety", "icon": "🚸", "color": "#10B981"},
    {"name": "Blocked Footpath", "slug": "blocked_footpath", "icon": "🚶", "color": "#F59E0B"},
    {"name": "Traffic Violation", "slug": "traffic_violation", "icon": "🚫", "color": "#DB2777"},
    {"name": "Road Signage Issue", "slug": "road_signage_issue", "icon": "🪧", "color": "#D97706"},
    {"name": "Streetlight / Lighting Malfunction", "slug": "poor_lighting", "icon": "💡", "color": "#EAB308"},
    {"name": "Drainage & Flooding", "slug": "drainage_flooding", "icon": "🌊", "color": "#0284C7"},
    {"name": "Water Leakage", "slug": "water_leakage", "icon": "💧", "color": "#06B6D4"},
    {"name": "Sewage Issue", "slug": "sewage_issue", "icon": "🚽", "color": "#059669"},
    {"name": "Gas Leak", "slug": "gas_leak", "icon": "⚠️", "color": "#EA580C"},
    {"name": "Electrical Outage", "slug": "electrical_outage", "icon": "⚡", "color": "#EAB308"},
    {"name": "Public Infrastructure", "slug": "public_infrastructure", "icon": "🏗️", "color": "#8B5CF6"},
    {"name": "Building Safety", "slug": "building_safety", "icon": "🏢", "color": "#8B5CF6"},
    {"name": "Construction Hazard", "slug": "construction_hazard", "icon": "🏗️", "color": "#F59E0B"},
    {"name": "Fallen Tree / Branch", "slug": "fallen_tree_branch", "icon": "🪵", "color": "#D97706"},
    {"name": "Public Disturbance & Noise", "slug": "public_disturbance", "icon": "🔊", "color": "#6366F1"},
    {"name": "Animal Bite", "slug": "animal_bite", "icon": "🐕", "color": "#EF4444"},
    {"name": "Animal Welfare Concern", "slug": "animal_welfare_concern", "icon": "🐾", "color": "#10B981"},
    {"name": "Stray Animals & Pest Hazard", "slug": "animal_hazard", "icon": "🐕", "color": "#10B981"},
    {"name": "Illegal Dumping", "slug": "illegal_dumping", "icon": "🗑️", "color": "#059669"},
    {"name": "Public Health Concern", "slug": "public_health_concern", "icon": "🩺", "color": "#0284C7"},
    {"name": "Water Leakage", "slug": "water_supply_issue", "icon": "🚰", "color": "#0284C7"},
    {"name": "Chemical Spill", "slug": "chemical_spill", "icon": "☣️", "color": "#DC2626"},
    {"name": "Emergency & Distress", "slug": "emergency", "icon": "🆘", "color": "#991B1B"},
    {"name": "Medical Emergency", "slug": "medical_emergency", "icon": "🚑", "color": "#0284C7"},
    {"name": "Fire & Electrical Hazard", "slug": "fire_hazard", "icon": "🔥", "color": "#D97706"},
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

SAMPLE_IMAGE_URLS = [
    "/uploads/sample_pothole.jpg", "/uploads/sample_lighting.jpg",
    "/uploads/sample_hazard.jpg", "/uploads/sample_accident.jpg",
    "/uploads/sample_infrastructure.jpg"
]


def pick_zone() -> dict:
    """Pick a zone weighted by zone weight."""
    weights = [z["w"] for z in ZONES]
    total = sum(weights)
    r = random.random() * total
    accum = 0
    for z in ZONES:
        accum += z["w"]
        if r <= accum:
            return z
    return ZONES[0]


def pick_coords_in_zone(zone: dict) -> tuple:
    """Pick a lat/lng within a zone's radius."""
    r = zone["r"]
    lat = zone["lat"] + random.uniform(-r, r)
    lng = zone["lng"] + random.uniform(-r, r)
    return round(lat, 6), round(lng, 6)


async def seed_database(db: AsyncSession):
    logger.info("Starting database seeding...")

    # 1. Categories
    category_map = {}
    existing_slugs = set()
    for cat_data in CATEGORIES_DATA:
        if cat_data["slug"] in existing_slugs:
            continue
        existing_slugs.add(cat_data["slug"])
        result = await db.execute(select(IncidentCategory).where(IncidentCategory.slug == cat_data["slug"]))
        cat = result.scalar_one_or_none()
        if not cat:
            cat = IncidentCategory(
                name=cat_data["name"], slug=cat_data["slug"],
                icon=cat_data["icon"], color=cat_data["color"],
                description=cat_data.get("description", "")
            )
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
            email=admin_email, full_name="System Administrator",
            hashed_password=get_password_hash("AdminPass123!"),
            role=UserRole.ADMIN, is_active=True, is_verified=True,
        )
        db.add(admin_user)
        await db.flush()
        db.add(UserProfile(user_id=admin_user.id, phone="+18005550199",
                           bio="SafeCity Central Administration", city="Coimbatore", country="India"))
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
                email=email, full_name=f"{fname} {lname}",
                hashed_password=get_password_hash("CitizenPass123!"),
                role=UserRole.CITIZEN, is_active=True, is_verified=True,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(30, 180))
            )
            db.add(user)
            await db.flush()
            db.add(UserProfile(
                user_id=user.id,
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={fname}{lname}",
                phone=f"+9198{random.randint(10000000, 99999999)}",
                bio=f"Active citizen contributor in Coimbatore.",
                city="Coimbatore", country="India"
            ))
            await db.flush()
        users.append(user)
    logger.info(f"Ensured {len(users)} users.")

    # 4. Clear existing incidents
    result = await db.execute(select(Incident))
    existing = result.scalars().all()
    if existing:
        logger.info(f"Clearing {len(existing)} previous incidents...")
        for inc in existing:
            await db.delete(inc)
        await db.flush()

    # 5. Generate 130 Realistic Incidents
    now = datetime.now(timezone.utc)
    severity_map = {
        "low": SeverityLevel.LOW, "medium": SeverityLevel.MEDIUM,
        "high": SeverityLevel.HIGH, "critical": SeverityLevel.CRITICAL
    }

    # Build weighted spec list: repeat each spec proportional to realistic frequency
    spec_weights = {
        "crime": 12, "accident": 12, "road_hazard": 10, "harassment": 10,
        "poor_lighting": 8, "theft_robbery": 8, "traffic_signal_malfunction": 6,
        "traffic_violation": 6, "pedestrian_safety": 6, "drainage_flooding": 6,
        "assault_violence": 5, "suspicious_activity": 5, "construction_hazard": 5,
        "public_infrastructure": 5, "fallen_tree_branch": 4, "water_leakage": 4,
        "electrical_outage": 4, "gas_leak": 3, "sewage_issue": 4,
        "animal_bite": 4, "missing_person": 3, "illegal_dumping": 3,
        "public_health_concern": 3, "vandalism": 3, "lost_and_found": 3,
    }

    spec_lookup = {s[0]: s for s in INCIDENT_SPECS}
    weighted_slugs = []
    for slug, w in spec_weights.items():
        if slug in spec_lookup and slug in category_map:
            weighted_slugs.extend([slug] * w)

    created_incidents = []
    total_to_create = 130

    for idx in range(total_to_create):
        slug = random.choice(weighted_slugs)
        spec = spec_lookup[slug]
        category = category_map[slug]

        # Pick geographic zone (road-relevant categories prefer road corridors)
        if slug in {"accident", "road_hazard", "traffic_signal_malfunction",
                    "poor_lighting", "traffic_violation", "pedestrian_safety",
                    "drainage_flooding", "fallen_tree_branch"}:
            # 70% chance to pick a road corridor zone
            road_zones = [z for z in ZONES if "Road" in z["name"] or z["name"] in
                          {"Gandhipuram", "RS Puram", "Singanallur"}]
            zone = random.choice(road_zones) if random.random() < 0.7 else pick_zone()
        elif slug in {"crime", "assault_violence", "theft_robbery", "harassment"}:
            # 70% chance of hot zone
            hot_zones = [z for z in ZONES if z["w"] >= 2 and z["name"] in
                         {"Gandhipuram", "RS Puram", "Town Hall", "Singanallur", "Ramanathapuram"}]
            zone = random.choice(hot_zones) if random.random() < 0.7 else pick_zone()
        else:
            zone = pick_zone()

        lat, lng = pick_coords_in_zone(zone)
        geom = f"SRID=4326;POINT({lng} {lat})"

        # Severity
        sev_choices = spec[1]
        r = random.random()
        cumulative = 0
        severity = SeverityLevel.MEDIUM
        for sev_str, prob in sev_choices:
            cumulative += prob
            if r <= cumulative:
                severity = severity_map[sev_str]
                break

        # Status: most are approved (verified), some unverified
        approved_pct = spec[2]
        rand_status = random.random()
        if rand_status < approved_pct:
            status = IncidentStatus.APPROVED
        elif rand_status < approved_pct + 0.10:
            status = IncidentStatus.RESOLVED
        elif rand_status < approved_pct + 0.20:
            status = IncidentStatus.PENDING
        elif rand_status < approved_pct + 0.25:
            status = IncidentStatus.UNDER_REVIEW
        else:
            status = IncidentStatus.REJECTED

        # Age distribution: 5 realistic time buckets
        # ~15% 1-3 days, ~20% 4-14 days, ~25% 15-30 days, ~20% 31-90 days, ~20% 91-365 days
        rand_age = random.random()
        if rand_age < 0.15:
            days_ago = random.randint(1, 3)
        elif rand_age < 0.35:
            days_ago = random.randint(4, 14)
        elif rand_age < 0.60:
            days_ago = random.randint(15, 30)
        elif rand_age < 0.80:
            days_ago = random.randint(31, 90)
        else:
            days_ago = random.randint(91, 365)

        created_time = now - timedelta(
            days=days_ago,
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
            seconds=random.randint(0, 59),
        )
        updated_time = created_time + timedelta(hours=random.randint(1, 12))

        # Title
        titles = CATEGORY_TITLES.get(slug, [f"{category.name} incident reported"])
        street = random.choice(STREETS)
        title = f"{random.choice(titles)} – {street.split(',')[0]}"
        description = spec[3].format(street=street)

        admin_note = None
        if status == IncidentStatus.APPROVED:
            admin_note = "Verified by community moderation team. Dispatched to local authority."
        elif status == IncidentStatus.RESOLVED:
            admin_note = "Issue resolved by municipal maintenance crew."
        elif status == IncidentStatus.REJECTED:
            admin_note = "Insufficient details or duplicate report."
        elif status == IncidentStatus.UNDER_REVIEW:
            admin_note = "Assigned to administrator for verification."

        reporter = random.choice(users[1:]) if random.random() > 0.12 else None
        is_anon = not reporter or random.random() < 0.18

        inc = Incident(
            title=title[:250],
            description=description,
            category_id=category.id,
            severity=severity,
            status=status,
            is_anonymous=is_anon,
            location_address=f"{street}, Coimbatore, Tamil Nadu",
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

        # 35% of incidents get images
        if random.random() < 0.35:
            img_url = random.choice(SAMPLE_IMAGE_URLS)
            db.add(IncidentImage(
                incident_id=inc.id,
                filename=img_url.split("/")[-1],
                url=img_url,
                created_at=created_time
            ))

    await db.flush()
    logger.info(f"Generated {len(created_incidents)} incident reports.")

    # 6. Notifications
    notif_count = 0
    for user in users:
        user_incidents = [i for i in created_incidents if i.reporter_id == user.id]
        for inc in user_incidents[:3]:
            db.add(Notification(
                user_id=user.id,
                title=f"Incident Status: {inc.status.value.replace('_', ' ').title()}",
                message=f"Your incident report '{inc.title[:60]}' status was updated to {inc.status.value}.",
                type=NotificationType.INCIDENT_UPDATE,
                is_read=random.choice([True, False]),
                incident_id=inc.id,
                created_at=inc.updated_at
            ))
            notif_count += 1

        db.add(Notification(
            user_id=user.id,
            title="Welcome to SafeCity Platform",
            message="Thank you for joining SafeCity. Report issues in your neighborhood to help build a safer community.",
            type=NotificationType.SYSTEM,
            is_read=True,
            created_at=now - timedelta(days=30)
        ))
        notif_count += 1

    await db.commit()
    logger.info(f"Seeded {notif_count} notifications.")
    logger.info("Database seeding complete!")


if __name__ == "__main__":
    async def main():
        async with AsyncSessionLocal() as session:
            await seed_database(session)
    asyncio.run(main())
