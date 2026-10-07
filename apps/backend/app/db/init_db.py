"""
SafeCity Seed Script — curated, geographically accurate demo data
=================================================================
Every incident is generated AT a real Coimbatore landmark / road stretch, so the
location_address and the coordinates always agree, and titles contain no place names.
Coordinates come from OSM-derived POI listings / Wikipedia (see ANCHORS). The run is
deterministic (fixed RNG seed), so the same incidents are created every time.
"""
import asyncio
import logging
import math
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
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

# Accounts that must survive the cleanup (existing accounts, passwords untouched)
KEEP_EMAILS = {
    "admin@safecity.com",              # System Administrator
    "vishalkarthikeyanp@gmail.com",    # Vishal Karthikeyan. P
    "25mx203@psgtech.ac.in",           # Pradeep
}

# 12 demo citizens: 6 male + 6 female, Tamil names, no caste surnames.
DEMO_USERS = [
    {"name": "Senthil Nathan",  "email": "senthil@safecity.com",   "password": "Senthil@123"},
    {"name": "Yazhini Devi",    "email": "yazhini@safecity.com",   "password": "Yazhini@123"},
    {"name": "Gokul Raj",       "email": "gokul@safecity.com",     "password": "Gokul@123"},
    {"name": "Kaviya Shree",    "email": "kaviya@safecity.com",    "password": "Kaviya@123"},
    {"name": "Mugilan Selvam",  "email": "mugilan@safecity.com",   "password": "Mugilan@123"},
    {"name": "Nandhini Priya",  "email": "nandhini@safecity.com",  "password": "Nandhini@123"},
    {"name": "Bharath Kannan",  "email": "bharath@safecity.com",   "password": "Bharath@123"},
    {"name": "Abirami Selvi",   "email": "abirami@safecity.com",   "password": "Abirami@123"},
    {"name": "Ezhil Arasan",    "email": "ezhil@safecity.com",     "password": "Ezhil@123"},
    {"name": "Iniya Lakshmi",   "email": "iniya@safecity.com",     "password": "Iniya@123"},
    {"name": "Vetri Selvan",    "email": "vetri@safecity.com",     "password": "Vetri@123"},
    {"name": "Tamilarasi Meena","email": "tamilarasi@safecity.com","password": "Tamilarasi@123"},
]

SEED = 20261006

# ─────────────────────────────────────────────────────────────────────────────
# Curated geography (name, lat, lng). Incidents are placed ONLY at these anchors
# or along the road stretches between them, so address == coordinates.
# ─────────────────────────────────────────────────────────────────────────────

# name, lat, lng  (coordinates sourced from OSM-derived POI listings / Wikipedia)
ANCHORS = {
    "gp_central":     ("Gandhipuram Central Bus Stand",        11.0141, 76.9669),
    "gp_town":        ("Gandhipuram Town Bus Stand",           11.0164, 76.9692),
    "gp_crosscut":    ("Cross Cut Road, Gandhipuram",          11.0180, 76.9657),
    "gp_omni":        ("Omni Bus Stand, Gandhipuram",          11.0229, 76.9715),
    "ramanathapuram": ("Trichy Road, Ramanathapuram",          10.9961, 76.9959),
    "singanallur":    ("Singanallur Bus Stand",                11.0024, 77.0291),
    "psg":            ("PSG College of Technology, Avinashi Road", 11.0247, 77.0030),
    "peelamedu_av":   ("Avinashi Road, Peelamedu",             11.0258, 77.0212),
    "ganapathy":      ("Ganapathy",                            11.0422, 76.9816),
    "thudiyalur":     ("Thudiyalur",                           11.0801, 76.9416),
    "vadavalli":      ("Vadavalli",                            11.0247, 76.8980),
    "saravanampatti": ("Saravanampatti",                       11.0764, 77.0030),
}
STRETCHES = {
    "trichy_rd":   ("Trichy Road (Ramanathapuram – Singanallur stretch)", "ramanathapuram", "singanallur", 0.05, 0.85),
    "avinashi_rd": ("Avinashi Road (PSG Tech – Peelamedu stretch)",       "psg",            "peelamedu_av", 0.40, 0.95),
}

CRIME_MIX = {"crime":4,"theft_robbery":4,"assault_violence":3,"harassment":3,"suspicious_activity":2,"vandalism":1}
ROAD_MIX  = {"accident":5,"road_hazard":3,"traffic_violation":3,"pedestrian_safety":2,"traffic_signal_malfunction":2,"poor_lighting":2}
MIXED_MIX = {"theft_robbery":2,"accident":2,"poor_lighting":2,"road_hazard":2,"harassment":1,"public_infrastructure":2,"sewage_issue":1}
CIVIC_MIX = {"public_infrastructure":2,"water_leakage":2,"electrical_outage":2,"sewage_issue":2,"illegal_dumping":2,"drainage_flooding":1,"poor_lighting":1}
MINOR_MIX = {"lost_and_found":3,"illegal_dumping":1,"public_infrastructure":1,"poor_lighting":1}

SEV_SEVERE = {"critical":0.30,"high":0.45,"medium":0.20,"low":0.05}
SEV_HIGH   = {"critical":0.12,"high":0.38,"medium":0.38,"low":0.12}
SEV_MEDHIGH = {"critical":0.05,"high":0.25,"medium":0.45,"low":0.25}
SEV_MED    = {"critical":0.02,"high":0.13,"medium":0.50,"low":0.35}
SEV_LOW    = {"critical":0.0,"high":0.02,"medium":0.18,"low":0.80}

HOTSPOTS = [
    # EXTREME
    {"place":"gp_central",  "n":14,"radius_m":160,"mix":CRIME_MIX,"sev":SEV_SEVERE,"age":"fresh","verified":0.92},
    {"place":"gp_town",     "n":12,"radius_m":160,"mix":CRIME_MIX,"sev":SEV_SEVERE,"age":"fresh","verified":0.92},
    {"place":"gp_crosscut", "n":10,"radius_m":130,"mix":CRIME_MIX,"sev":SEV_HIGH,  "age":"fresh","verified":0.90},
    {"place":"gp_omni",     "n":8, "radius_m":160,"mix":MIXED_MIX,"sev":SEV_HIGH,  "age":"recent","verified":0.85},
    # HIGH
    {"place":"trichy_rd",   "n":30,"mix":ROAD_MIX,"sev":SEV_SEVERE,"age":"fresh","verified":0.92},
    {"place":"ramanathapuram","n":14,"radius_m":170,"mix":ROAD_MIX,"sev":SEV_SEVERE,"age":"fresh","verified":0.88},
    # MODERATE
    {"place":"singanallur", "n":22,"radius_m":190,"mix":MIXED_MIX,"sev":SEV_MEDHIGH,"age":"recent","verified":0.80},
    {"place":"avinashi_rd", "n":16,"mix":ROAD_MIX,"sev":SEV_MEDHIGH,"age":"recent","verified":0.80},
    {"place":"peelamedu_av","n":10,"radius_m":150,"mix":ROAD_MIX,"sev":SEV_MEDHIGH,"age":"recent","verified":0.75},
    {"place":"ganapathy",   "n":18,"radius_m":220,"mix":MIXED_MIX,"sev":SEV_MEDHIGH,"age":"recent","verified":0.75},
    # LOW
    {"place":"thudiyalur",  "n":8, "radius_m":260,"mix":CIVIC_MIX,"sev":SEV_MED,"age":"mixed","verified":0.70},
    # SAFE
    {"place":"psg",         "n":5, "radius_m":110,"mix":MINOR_MIX,"sev":SEV_LOW,"age":"old","verified":0.60},
    # Vadavalli / Saravanampatti: intentionally NO incidents (zero-incident examples)
]

# Approximate water bodies (centre lat, lng, radius m) used only as a seed-time safety guard
WATER_BODIES = [
    ("Singanallur Lake",    11.0035, 77.0390, 600),
    ("Ukkadam Periyakulam", 10.9790, 76.9640, 700),
    ("Valankulam Lake",     10.9915, 76.9770, 450),
    ("Krishnampathy Lake",  10.9945, 76.9555, 400),
    ("Kurichi Lake",        10.9560, 76.9660, 700),
]

AGE_PROFILES = {
    "fresh":  [(0.70,(1,14)),(0.30,(15,45))],
    "recent": [(0.40,(1,14)),(0.40,(15,45)),(0.20,(46,120))],
    "mixed":  [(0.20,(1,14)),(0.30,(15,45)),(0.30,(46,120)),(0.20,(121,365))],
    "old":    [(0.10,(46,120)),(0.90,(121,365))],
}

def _haversine_m(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    h = math.sin((p2-p1)/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(math.radians(d-b)/2)**2
    return 2*6371000*math.asin(math.sqrt(h))

def is_in_water(lat, lng):
    for name, wlat, wlng, r in WATER_BODIES:
        if _haversine_m(lat, lng, wlat, wlng) <= r:
            return name
    return None

def _weighted(rng, weights):
    items = list(weights.items()); total = sum(w for _, w in items); r = rng.random()*total; acc = 0.0
    for k, w in items:
        acc += w
        if r <= acc: return k
    return items[-1][0]

def _offset(lat, lng, east_m, north_m):
    return (lat + north_m/111320.0, lng + east_m/(111320.0*math.cos(math.radians(lat))))

def _point(rng, spot):
    key = spot["place"]
    if key in STRETCHES:
        label, a, b, t0, t1 = STRETCHES[key]
        la, lo = ANCHORS[a][1:], ANCHORS[b][1:]
        t = rng.uniform(t0, t1)
        lat, lng = la[0]+(lo[0]-la[0])*t, la[1]+(lo[1]-la[1])*t
        return _offset(lat, lng, rng.uniform(-30,30), rng.uniform(-30,30)), label
    label, lat, lng = ANCHORS[key]
    r = spot["radius_m"]*math.sqrt(rng.random()); th = rng.uniform(0, 2*math.pi)
    return _offset(lat, lng, r*math.cos(th), r*math.sin(th)), label

def _status(rng, p_ver):
    r = rng.random()
    if r < p_ver*0.88: return "approved"
    if r < p_ver: return "resolved"
    r = rng.random()
    return "pending" if r < 0.55 else "under_review" if r < 0.85 else "rejected"

def _age_days(rng, profile):
    r, acc = rng.random(), 0.0
    for p, (lo, hi) in AGE_PROFILES[profile]:
        acc += p
        if r <= acc: return rng.randint(lo, hi)
    return rng.randint(*AGE_PROFILES[profile][-1][1])

def build_plan():
    """Deterministic list of incident dicts (place, label, lat, lng, slug, severity, status, age_days)."""
    rng = random.Random(SEED); plan = []
    for spot in HOTSPOTS:
        for _ in range(spot["n"]):
            (lat, lng), label = _point(rng, spot)
            lat, lng = round(lat, 6), round(lng, 6)
            wb = is_in_water(lat, lng)
            assert wb is None, f"{spot['place']} point {lat},{lng} falls in {wb}"
            plan.append({"place":spot["place"],"label":label,"lat":lat,"lng":lng,
                         "slug":_weighted(rng, spot["mix"]),"severity":_weighted(rng, spot["sev"]),
                         "status":_status(rng, spot["verified"]),"age_days":_age_days(rng, spot["age"])})
    return plan

# ─────────────────────────────────────────────────────────────────────────────
# Category → severity → status probabilities (description templates use {street},
# which is filled with the REAL place label of the generated coordinates)
# ─────────────────────────────────────────────────────────────────────────────
INCIDENT_SPECS = [
    ("crime", "Criminal activity reported near {street}. Police assistance requested immediately."),
    ("assault_violence", "Physical altercation reported at {street}. Medical assistance may be needed."),
    ("theft_robbery", "Theft or robbery incident reported near {street}. Valuable items taken."),
    ("harassment", "Harassment complaint filed at {street}. Victim has been assisted."),
    ("accident", "Traffic accident reported at {street}. Vehicles involved. Ambulance dispatched."),
    ("road_hazard", "Road hazard identified at {street}. Risk to vehicles and pedestrians."),
    ("traffic_signal_malfunction", "Traffic signal malfunction at {street}. Creating congestion and safety risk."),
    ("poor_lighting", "Streetlight malfunction at {street}. Pedestrian path is dangerously dark."),
    ("traffic_violation", "Dangerous traffic violation witnessed near {street}. Driver details noted."),
    ("pedestrian_safety", "Pedestrian safety hazard at {street}. Crosswalk conditions are dangerous."),
    ("drainage_flooding", "Drainage flooding at {street}. Vehicles unable to pass safely."),
    ("gas_leak", "Gas leak odor reported near {street}. Area evacuated, fire dept called."),
    ("fallen_tree_branch", "Fallen tree obstructing {street}. Traffic blocked."),
    ("construction_hazard", "Construction hazard reported at {street}. Unbarricaded excavation."),
    ("suspicious_activity", "Suspicious activity near {street}. Police notified."),
    ("public_infrastructure", "Infrastructure damage at {street}. Municipal team alerted."),
    ("water_leakage", "Pipe burst and water leakage at {street}. Water board notified."),
    ("electrical_outage", "Power outage reported at {street}. TNEB working on restoration."),
    ("sewage_issue", "Sewage overflow near {street}. Foul odor and health concern."),
    ("illegal_dumping", "Illegal waste dumped near {street}. Environmental concern."),
    ("missing_person", "Missing person report filed. Last seen near {street}."),
    ("animal_bite", "Stray animal bite reported near {street}. Victim seeking medical treatment."),
    ("public_health_concern", "Public health concern near {street}. Sanitation team dispatched."),
    ("vandalism", "Vandalism and property damage reported near {street}."),
    ("lost_and_found", "Lost item reported near {street}. Contact the police station if found."),
]

# Titles are deliberately generic: no place names and no facilities (schools, temples,
# ATMs...) that might not exist at the generated coordinates.
CATEGORY_TITLES = {
    "crime": ["Snatch and grab reported", "Pickpocketing in crowded area", "Vehicle window smashed", "Attempted break-in reported"],
    "assault_violence": ["Physical fight reported", "Assault reported", "Group brawl reported", "Man attacked by unknown persons"],
    "theft_robbery": ["Handbag snatched from pedestrian", "Mobile phone stolen", "Two-wheeler theft reported", "Gold chain snatched"],
    "harassment": ["Group harassment reported", "Woman followed by unknown person", "Verbal abuse and intimidation", "Persistent stalking reported"],
    "accident": ["Two-wheeler collision", "Car skidded on wet surface", "Auto-rickshaw hit pedestrian", "Rear-end crash"],
    "road_hazard": ["Deep pothole causing accidents", "Uncovered manhole on road", "Debris spilled on road", "Loose road surface"],
    "traffic_signal_malfunction": ["Traffic light not working", "Signal timer malfunction causing gridlock"],
    "poor_lighting": ["Streetlights out on stretch", "Dark stretch with no lighting", "Street lighting failure", "Footpath completely unlit"],
    "traffic_violation": ["Dangerous wrong-way driving", "Reckless speeding", "Red light jumping", "Overloaded vehicle on road"],
    "pedestrian_safety": ["No safe crossing for pedestrians", "Pedestrians forced onto road", "Footpath completely blocked", "Speed breaker missing"],
    "drainage_flooding": ["Road waterlogged after rain", "Drain overflow blocking vehicles", "Storm drain blocked"],
    "gas_leak": ["Gas odour reported", "LPG leak reported", "Burning smell from pipeline"],
    "fallen_tree_branch": ["Large branch fallen on road", "Tree uprooted blocking lane", "Fallen tree obstructing footpath"],
    "construction_hazard": ["Open pit without barricading", "Loose debris from construction", "Construction material blocking lane"],
    "suspicious_activity": ["Unattended suspicious bag found", "Unknown persons loitering at night", "Suspicious vehicle parked for days"],
    "public_infrastructure": ["Bus shelter damaged", "Public toilet broken and unusable", "Public bench vandalised", "Damaged public utility"],
    "water_leakage": ["Pipeline burst", "Municipal water leaking on road", "Large water leak"],
    "electrical_outage": ["Power outage in street", "Transformer breakdown", "Exposed wire hanging from pole"],
    "sewage_issue": ["Sewage overflow", "Drain backing up", "Foul smell from open sewer"],
    "illegal_dumping": ["Construction waste dumped", "Garbage dumped on footpath", "Waste dumped in the open"],
    "missing_person": ["Missing elderly person", "Child reported missing", "Missing adult reported"],
    "animal_bite": ["Stray dog bite reported", "Multiple dog attack", "Animal bite - medical help needed"],
    "public_health_concern": ["Mosquito infestation reported", "Garbage causing health risk", "Contaminated water supply"],
    "vandalism": ["Public property vandalised", "Broken glass at public structure", "Walls defaced"],
    "lost_and_found": ["Wallet found", "Lost keys reported", "Unclaimed bag found"],
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
    {"name": "Water Supply Issue", "slug": "water_supply_issue", "icon": "🚰", "color": "#0284C7"},
    {"name": "Chemical Spill", "slug": "chemical_spill", "icon": "☣️", "color": "#DC2626"},
    {"name": "Emergency & Distress", "slug": "emergency", "icon": "🆘", "color": "#991B1B"},
    {"name": "Medical Emergency", "slug": "medical_emergency", "icon": "🚑", "color": "#0284C7"},
    {"name": "Fire & Electrical Hazard", "slug": "fire_hazard", "icon": "🔥", "color": "#D97706"},
]

SAMPLE_IMAGE_URLS = [
    "/uploads/sample_pothole.jpg", "/uploads/sample_lighting.jpg",
    "/uploads/sample_hazard.jpg", "/uploads/sample_accident.jpg",
    "/uploads/sample_infrastructure.jpg"
]


async def seed_database(db: AsyncSession):
    logger.info("Starting database seeding...")

    # 1. Categories
    category_map = {}
    existing_slugs = set()
    for cat_data in CATEGORIES_DATA:
        if cat_data["slug"] in existing_slugs:
            continue
        existing_slugs.add(cat_data["slug"])
        # Query by slug OR name to avoid violating uq_incident_categories_name or uq_incident_categories_slug
        result = await db.execute(
            select(IncidentCategory).where(
                (IncidentCategory.slug == cat_data["slug"]) | (IncidentCategory.name == cat_data["name"])
            )
        )
        cat = result.scalar_one_or_none()
        if not cat:
            cat = IncidentCategory(
                name=cat_data["name"], slug=cat_data["slug"],
                icon=cat_data["icon"], color=cat_data["color"],
                description=cat_data.get("description", "")
            )
            db.add(cat)
            await db.flush()
        else:
            # Sync name / slug / color if it already existed
            cat.name = cat_data["name"]
            cat.slug = cat_data["slug"]
            cat.icon = cat_data["icon"]
            cat.color = cat_data["color"]
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

    # 3. Users: keep 3 existing accounts, delete everyone else, create 12 demo users
    demo_emails = {u["email"] for u in DEMO_USERS}
    protected = KEEP_EMAILS | demo_emails

    # 3a. Find users to remove and delete the rows that reference them
    result = await db.execute(select(User.id).where(User.email.notin_(protected)))
    stale_ids = [row[0] for row in result.all()]
    if stale_ids:
        await db.execute(
            delete(Notification).where(Notification.user_id.in_(stale_ids)),
            execution_options={"synchronize_session": False},
        )

    # Clear existing incidents (they are all regenerated below, and reporters can't be
    # deleted while incidents still point at them)
    result = await db.execute(select(Incident))
    existing = result.scalars().all()
    if existing:
        logger.info(f"Clearing {len(existing)} previous incidents...")
        for inc in existing:
            await db.delete(inc)
        await db.flush()

    if stale_ids:
        await db.execute(
            delete(UserProfile).where(UserProfile.user_id.in_(stale_ids)),
            execution_options={"synchronize_session": False},
        )
        await db.execute(
            delete(User).where(User.id.in_(stale_ids)),
            execution_options={"synchronize_session": False},
        )
        await db.flush()
        logger.info(f"Deleted {len(stale_ids)} old users.")

    # 3b. Retained accounts + 12 demo users = 15 users total
    users = [admin_user]
    for email in ("vishalkarthikeyanp@gmail.com", "25mx203@psgtech.ac.in"):
        result = await db.execute(select(User).where(User.email == email))
        kept = result.scalar_one_or_none()
        if kept:
            users.append(kept)
        else:
            logger.warning(f"Expected existing account not found: {email}")

    for spec in DEMO_USERS:
        result = await db.execute(select(User).where(User.email == spec["email"]))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email=spec["email"], full_name=spec["name"],
                hashed_password=get_password_hash(spec["password"]),
                role=UserRole.CITIZEN, is_active=True, is_verified=True,
                created_at=datetime.now(timezone.utc) - timedelta(days=random.randint(30, 180))
            )
            db.add(user)
            await db.flush()
            db.add(UserProfile(
                user_id=user.id,
                avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={spec['name'].replace(' ', '')}",
                phone=f"+9198{random.randint(10000000, 99999999)}",
                bio="Active citizen contributor in Coimbatore.",
                city="Coimbatore", country="India"
            ))
            await db.flush()
        else:
            # re-runs: keep the documented demo password valid
            user.hashed_password = get_password_hash(spec["password"])
            user.is_active = True
            await db.flush()
        users.append(user)
    logger.info(f"Ensured {len(users)} users.")

    # 4. Incidents are generated from the curated, deterministic plan (see build_plan)
    now = datetime.now(timezone.utc)
    rng = random.Random(SEED + 1)               # separate stream: reporters / notes / images
    severity_map = {
        "low": SeverityLevel.LOW, "medium": SeverityLevel.MEDIUM,
        "high": SeverityLevel.HIGH, "critical": SeverityLevel.CRITICAL
    }
    status_map = {
        "approved": IncidentStatus.APPROVED, "resolved": IncidentStatus.RESOLVED,
        "pending": IncidentStatus.PENDING, "under_review": IncidentStatus.UNDER_REVIEW,
        "rejected": IncidentStatus.REJECTED,
    }
    admin_notes = {
        IncidentStatus.APPROVED: "Verified by community moderation team. Dispatched to local authority.",
        IncidentStatus.RESOLVED: "Issue resolved by municipal maintenance crew.",
        IncidentStatus.REJECTED: "Insufficient details or duplicate report.",
        IncidentStatus.UNDER_REVIEW: "Assigned to administrator for verification.",
    }
    spec_lookup = dict(INCIDENT_SPECS)

    created_incidents = []
    for item in build_plan():
        slug = item["slug"]
        category = category_map[slug]
        status = status_map[item["status"]]

        created_time = now - timedelta(
            days=item["age_days"], hours=rng.randint(0, 23),
            minutes=rng.randint(0, 59), seconds=rng.randint(0, 59),
        )
        updated_time = created_time + timedelta(hours=rng.randint(1, 12))

        reporter = rng.choice(users[1:]) if rng.random() > 0.12 else None
        is_anon = not reporter or rng.random() < 0.18

        inc = Incident(
            title=rng.choice(CATEGORY_TITLES.get(slug, [f"{category.name} incident reported"]))[:250],
            description=spec_lookup[slug].format(street=item["label"]),
            category_id=category.id,
            severity=severity_map[item["severity"]],
            status=status,
            is_anonymous=is_anon,
            location_address=f"{item['label']}, Coimbatore, Tamil Nadu",
            location_lat=item["lat"],
            location_lng=item["lng"],
            location_geom=f"SRID=4326;POINT({item['lng']} {item['lat']})",
            admin_note=admin_notes.get(status),
            reporter_id=None if is_anon else reporter.id,
            created_at=created_time,
            updated_at=updated_time,
        )
        db.add(inc)
        await db.flush()
        created_incidents.append(inc)

        # 35% of incidents get images
        if rng.random() < 0.35:
            img_url = rng.choice(SAMPLE_IMAGE_URLS)
            db.add(IncidentImage(
                incident_id=inc.id,
                filename=img_url.split("/")[-1],
                url=img_url,
                created_at=created_time
            ))

    await db.flush()
    logger.info(f"Generated {len(created_incidents)} incident reports.")

    # 5. Notifications
    notif_count = 0
    for user in users:
        user_incidents = [i for i in created_incidents if i.reporter_id == user.id]
        for inc in user_incidents[:3]:
            db.add(Notification(
                user_id=user.id,
                title=f"Incident Status: {inc.status.value.replace('_', ' ').title()}",
                message=f"Your incident report '{inc.title[:60]}' status was updated to {inc.status.value}.",
                type=NotificationType.INCIDENT_UPDATE,
                is_read=rng.choice([True, False]),
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
