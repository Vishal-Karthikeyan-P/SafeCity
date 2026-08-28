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

# Base location for sample city grid (Coimbatore, Tamil Nadu)
CITY_BASE_LAT = 11.0168
CITY_BASE_LNG = 76.9558

CATEGORIES_DATA = [
    {"name": "Crime", "slug": "crime", "icon": "🚨", "color": "#EF4444", "description": "General crime, property damage, or vandalism."},
    {"name": "Theft & Robbery", "slug": "theft_robbery", "icon": "👜", "color": "#DC2626", "description": "Theft, pickpocketing, snatching, or robbery."},
    {"name": "Violence & Assault", "slug": "assault_violence", "icon": "👊", "color": "#B91C1C", "description": "Physical assault, fights, or violent threats."},
    {"name": "Harassment & Stalking", "slug": "harassment", "icon": "⚠️", "color": "#F97316", "description": "Verbal or physical harassment, stalking, catcalling."},
    {"name": "Suspicious Activity", "slug": "suspicious_activity", "icon": "👁️", "color": "#EA580C", "description": "Suspicious behavior, unauthorized loitering, or prowling."},
    {"name": "Lost & Found", "slug": "lost_and_found", "icon": "🔍", "color": "#3B82F6", "description": "Lost property, found items, mislaid belongings."},
    {"name": "Missing Person", "slug": "missing_person", "icon": "👤", "color": "#EF4444", "description": "Missing individuals, runaway reports, urgent search."},
    {"name": "Missing Device / Phone", "slug": "missing_device", "icon": "📱", "color": "#6366F1", "description": "Lost or stolen smartphones, laptops, electronics."},
    {"name": "Property Damage", "slug": "property_damage", "icon": "🏚️", "color": "#D97706", "description": "Damaged private or public property, structural harm."},
    {"name": "Vandalism", "slug": "vandalism", "icon": "🎨", "color": "#B91C1C", "description": "Graffiti, deliberate property defacement, breakage."},
    {"name": "Traffic Accident", "slug": "accident", "icon": "🚗", "color": "#EC4899", "description": "Vehicle collisions, crashes, or hit-and-run."},
    {"name": "Illegal Parking", "slug": "illegal_parking", "icon": "🚫", "color": "#DB2777", "description": "Unauthorized parking, double parking, blocked driveways."},
    {"name": "Abandoned Vehicle", "slug": "abandoned_vehicle", "icon": "🚗", "color": "#6B7280", "description": "Derelict or abandoned vehicles left in public space."},
    {"name": "Vehicle Breakdown", "slug": "vehicle_breakdown", "icon": "🛠️", "color": "#F59E0B", "description": "Stalled vehicles, mechanical breakdown obstructing lane."},
    {"name": "Public Transport Issue", "slug": "public_transport_issue", "icon": "🚌", "color": "#8B5CF6", "description": "Bus, metro, or transit delays, safety issues."},
    {"name": "Road Signage Issue", "slug": "road_signage_issue", "icon": "🪧", "color": "#D97706", "description": "Damaged, missing, or obscured traffic road signs."},
    {"name": "Traffic Signal Malfunction", "slug": "traffic_signal_malfunction", "icon": "🚦", "color": "#EF4444", "description": "Broken, non-functional, or unaligned traffic lights."},
    {"name": "Pedestrian Safety", "slug": "pedestrian_safety", "icon": "🚸", "color": "#10B981", "description": "Unsafe crosswalks, speeding near pedestrian zones."},
    {"name": "Blocked Footpath / Sidewalk", "slug": "blocked_footpath", "icon": "🚶", "color": "#F59E0B", "description": "Obstructed walkways, sidewalk encroachments."},
    {"name": "Traffic Violation", "slug": "traffic_violation", "icon": "🚫", "color": "#DB2777", "description": "Reckless driving, red light jumping, dangerous maneuvers."},
    {"name": "Parking Obstruction", "slug": "parking_obstruction", "icon": "🚗", "color": "#DB2777", "description": "Vehicles blocking gates, hydrants, or emergency exits."},
    {"name": "Road Hazard", "slug": "road_hazard", "icon": "🚧", "color": "#F59E0B", "description": "Potholes, open manholes, or obstructed roads."},
    {"name": "Streetlight / Lighting Malfunction", "slug": "poor_lighting", "icon": "💡", "color": "#EAB308", "description": "Broken streetlights, unlit walkways, dark alleys."},
    {"name": "Drainage & Flooding", "slug": "drainage_flooding", "icon": "🌊", "color": "#0284C7", "description": "Clogged drains, standing water, monsoon flooding."},
    {"name": "Water Leakage", "slug": "water_leakage", "icon": "💧", "color": "#06B6D4", "description": "Pipe bursts, municipal water leaks on streets."},
    {"name": "Water Supply Issue", "slug": "water_supply_issue", "icon": "🚰", "color": "#0284C7", "description": "Disrupted municipal water supply or low pressure."},
    {"name": "Sewage Issue", "slug": "sewage_issue", "icon": "🚽", "color": "#059669", "description": "Overflowing sewer lines, foul drainage leakage."},
    {"name": "Gas Leak", "slug": "gas_leak", "icon": "⚠️", "color": "#EA580C", "description": "Gas odor, pipeline leaks, hazardous gas alerts."},
    {"name": "Electrical Outage", "slug": "electrical_outage", "icon": "⚡", "color": "#EAB308", "description": "Power outages, transformer failures, blackouts."},
    {"name": "Utility Service Issue", "slug": "utility_service_issue", "icon": "🔧", "color": "#64748B", "description": "General utility service interruptions or defects."},
    {"name": "Missing or Damaged Public Sign", "slug": "missing_damaged_public_sign", "icon": "🪧", "color": "#D97706", "description": "Broken direction boards, missing safety signs."},
    {"name": "Public Infrastructure", "slug": "public_infrastructure", "icon": "🏗️", "color": "#8B5CF6", "description": "Damaged bus stops, broken railings, public assets."},
    {"name": "Building Safety", "slug": "building_safety", "icon": "🏢", "color": "#8B5CF6", "description": "Unsafe structures, code violations, hazardous facades."},
    {"name": "Structural Damage", "slug": "structural_damage", "icon": "🏚️", "color": "#D97706", "description": "Cracked walls, collapsing roofs, foundation damage."},
    {"name": "Construction Hazard", "slug": "construction_hazard", "icon": "🏗️", "color": "#F59E0B", "description": "Uncovered debris, falling hazards near sites."},
    {"name": "Unsafe Construction Site", "slug": "unsafe_construction_site", "icon": "⚠️", "color": "#EF4444", "description": "Unbarricaded deep pits, missing safety nets."},
    {"name": "Elevator / Escalator Failure", "slug": "elevator_failure", "icon": "🛗", "color": "#64748B", "description": "Stuck elevators, broken escalators in public spaces."},
    {"name": "Broken Street Furniture", "slug": "broken_street_furniture", "icon": "🪑", "color": "#64748B", "description": "Damaged public benches, bollards, dustbins."},
    {"name": "Damaged Public Property", "slug": "damaged_public_property", "icon": "🏛️", "color": "#8B5CF6", "description": "Vandalized government buildings, public monuments."},
    {"name": "Park & Recreation Issue", "slug": "park_recreation_issue", "icon": "🏞️", "color": "#10B981", "description": "Unmaintained public parks, overgrown grass, litter."},
    {"name": "Playground Safety", "slug": "playground_safety", "icon": "🛝", "color": "#10B981", "description": "Broken slides, hazardous playground equipment."},
    {"name": "Public Toilet Issue", "slug": "public_toilet_issue", "icon": "🚻", "color": "#059669", "description": "Dirty, broken, or locked public restrooms."},
    {"name": "Government Facility Issue", "slug": "government_facility_issue", "icon": "🏛️", "color": "#8B5CF6", "description": "Issues at municipal offices, civic centers."},
    {"name": "Food Safety Concern", "slug": "food_safety_concern", "icon": "🍲", "color": "#F97316", "description": "Unsanitary food vendors, adulteration, food poisoning."},
    {"name": "Water Quality Concern", "slug": "water_quality_concern", "icon": "🧪", "color": "#06B6D4", "description": "Contaminated drinking water, unusual color/taste."},
    {"name": "Public Health Concern", "slug": "public_health_concern", "icon": "🩺", "color": "#0284C7", "description": "Disease outbreaks, sanitary health hazards."},
    {"name": "Mental Health / Welfare Concern", "slug": "mental_health_welfare_concern", "icon": "🧠", "color": "#8B5CF6", "description": "Individuals requiring welfare assistance or support."},
    {"name": "Environmental Pollution", "slug": "environmental_pollution", "icon": "🏭", "color": "#059669", "description": "Industrial smoke, toxic effluent, environmental harm."},
    {"name": "Air Pollution", "slug": "air_pollution", "icon": "🌫️", "color": "#64748B", "description": "Heavy smog, dust from construction, poor air quality."},
    {"name": "Water Pollution", "slug": "water_pollution", "icon": "🧪", "color": "#0284C7", "description": "Polluted lakes, river dumping, chemical contamination."},
    {"name": "Chemical Spill", "slug": "chemical_spill", "icon": "☣️", "color": "#DC2626", "description": "Hazardous chemical leakage, industrial spills."},
    {"name": "Hazardous Material", "slug": "hazardous_material", "icon": "⚠️", "color": "#EA580C", "description": "Unattended toxic containers, radioactive/bio hazards."},
    {"name": "Illegal Dumping", "slug": "illegal_dumping", "icon": "🗑️", "color": "#059669", "description": "Debris and garbage dumped illegally in open lots."},
    {"name": "Odor / Foul Smell", "slug": "odor_foul_smell", "icon": "🦨", "color": "#059669", "description": "Pungent chemical or sewage odor in neighborhood."},
    {"name": "Smoke / Air Quality", "slug": "smoke_air_quality", "icon": "💨", "color": "#64748B", "description": "Open garbage burning, thick smoke plumes."},
    {"name": "Public Cleanliness Issue", "slug": "public_cleanliness_issue", "icon": "🧹", "color": "#059669", "description": "Uncleaned streets, overflowing public trash bins."},
    {"name": "Animal Bite", "slug": "animal_bite", "icon": "🐕", "color": "#EF4444", "description": "Stray dog/animal bites reported in area."},
    {"name": "Animal Welfare Concern", "slug": "animal_welfare_concern", "icon": "🐾", "color": "#10B981", "description": "Injured strays, animal cruelty, rescue assistance."},
    {"name": "Animal Noise", "slug": "animal_noise", "icon": "🐕", "color": "#6366F1", "description": "Excessive barking or animal disturbance at night."},
    {"name": "Insect / Mosquito Infestation", "slug": "insect_infestation", "icon": "🦟", "color": "#84CC16", "description": "Severe mosquito breeding, pest infestation in area."},
    {"name": "Stray Animals & Pest Hazard", "slug": "animal_hazard", "icon": "🐕", "color": "#10B981", "description": "Aggressive stray cattle, packs of dogs."},
    {"name": "Tree / Vegetation Hazard", "slug": "tree_vegetation_hazard", "icon": "🌳", "color": "#10B981", "description": "Overgrown trees obstructing power lines or sight."},
    {"name": "Fallen Tree / Branch", "slug": "fallen_tree_branch", "icon": "🪵", "color": "#D97706", "description": "Uprooted trees or heavy fallen branches on road."},
    {"name": "Wildlife Incident", "slug": "wildlife_incident", "icon": "🐍", "color": "#10B981", "description": "Snakes, wild monkeys, or wild animal sightings."},
    {"name": "Public Disturbance & Noise", "slug": "public_disturbance", "icon": "🔊", "color": "#6366F1", "description": "Loud unauthorized noise, brawls, public disorder."},
    {"name": "Noise Equipment / Public Address Issue", "slug": "noise_equipment_issue", "icon": "📢", "color": "#6366F1", "description": "Loudspeakers operating past permissible hours."},
    {"name": "Public Event Issue", "slug": "public_event_issue", "icon": "🎪", "color": "#8B5CF6", "description": "Unpermitted rallies, festival crowd overflow."},
    {"name": "Crowd Management", "slug": "crowd_management", "icon": "👥", "color": "#EF4444", "description": "Dangerous overcrowding, stampede risks."},
    {"name": "Neighborhood Dispute", "slug": "neighborhood_dispute", "icon": "🏡", "color": "#F59E0B", "description": "Property boundary disputes, aggressive arguments."},
    {"name": "Community Safety Concern", "slug": "community_safety_concern", "icon": "🛡️", "color": "#10B981", "description": "General local safety advisory or neighborhood concern."},
    {"name": "Accessibility Issue", "slug": "accessibility_issue", "icon": "♿", "color": "#3B82F6", "description": "Lack of ramps, broken wheelchair access points."},
    {"name": "Disability Access Obstruction", "slug": "disability_access_obstruction", "icon": "♿", "color": "#F97316", "description": "Ramps blocked by vehicles, obstructed tactile paths."},
    {"name": "Accessibility / Mobility Issue", "slug": "accessibility_mobility_issue", "icon": "🦯", "color": "#3B82F6", "description": "Impaired mobility barriers in public infrastructure."},
    {"name": "Child Safety Concern", "slug": "child_safety_concern", "icon": "👶", "color": "#EF4444", "description": "Unaccompanied minors, unsafe play areas."},
    {"name": "Elderly Safety Concern", "slug": "elderly_safety_concern", "icon": "👵", "color": "#F59E0B", "description": "Seniors requiring emergency aid or assistance."},
    {"name": "Cybersecurity Incident", "slug": "cybersecurity_incident", "icon": "💻", "color": "#6366F1", "description": "Hacking alerts, public terminal malware."},
    {"name": "Online Fraud / Scam", "slug": "online_fraud_scam", "icon": "💳", "color": "#DC2626", "description": "Phishing, financial scams, fraudulent links."},
    {"name": "Identity Theft", "slug": "identity_theft", "icon": "🪪", "color": "#B91C1C", "description": "Impersonation, stolen identity credentials."},
    {"name": "Account / Digital Service Abuse", "slug": "account_digital_abuse", "icon": "🔒", "color": "#EF4444", "description": "Compromised accounts, digital harassment."},
    {"name": "Privacy Concern", "slug": "privacy_concern", "icon": "👁️", "color": "#8B5CF6", "description": "Unauthorized surveillance, camera misuse."},
    {"name": "Data Security Incident", "slug": "data_security_incident", "icon": "🛡️", "color": "#3B82F6", "description": "Data breaches, exposed sensitive records."},
    {"name": "Emergency & Distress", "slug": "emergency", "icon": "🆘", "color": "#991B1B", "description": "Severe distress, urgent safety hazards, fires."},
    {"name": "Medical Emergency", "slug": "medical_emergency", "icon": "🚑", "color": "#0284C7", "description": "Medical distress, collapse, urgent health aid needed."},
    {"name": "Fire & Electrical Hazard", "slug": "fire_hazard", "icon": "🔥", "color": "#D97706", "description": "Exposed wiring, transformer sparking, fire hazards."},
    {"name": "Beach / Coastal Hazard", "slug": "beach_coastal_hazard", "icon": "🏖️", "color": "#0284C7", "description": "Strong currents, unmonitored dangerous shores."},
    {"name": "Flooding / Waterlogging", "slug": "flooding_waterlogging", "icon": "🌊", "color": "#0284C7", "description": "Severe road waterlogging, stranded vehicles."},
    {"name": "Extreme Weather Incident", "slug": "extreme_weather_incident", "icon": "🌩️", "color": "#DC2626", "description": "Cyclones, heavy squalls, extreme heatwaves."},
    {"name": "Disaster / Natural Hazard", "slug": "disaster_natural_hazard", "icon": "🌋", "color": "#B91C1C", "description": "Earthquakes, landslides, natural disasters."},
    {"name": "Evacuation Assistance", "slug": "evacuation_assistance", "icon": "🏃", "color": "#EF4444", "description": "Emergency evacuation guidance and help."},
    {"name": "Service Disruption", "slug": "service_disruption", "icon": "⚠️", "color": "#EA580C", "description": "Interrupted civic services or municipal delays."},
    {"name": "Public Service Complaint", "slug": "public_service_complaint", "icon": "📝", "color": "#6B7280", "description": "Civic service grievances or non-performance."},
    {"name": "Unauthorized Construction", "slug": "unauthorized_construction", "icon": "🏗️", "color": "#D97706", "description": "Illegal building work without civic permits."},
    {"name": "Illegal Advertising / Posters", "slug": "illegal_advertising_posters", "icon": "📜", "color": "#6B7280", "description": "Unpermitted banners, defacing public walls."},
    {"name": "Encroachment / Public Space Obstruction", "slug": "encroachment_obstruction", "icon": "🚧", "color": "#F97316", "description": "Illegal stalls, permanent structure encroachments."},
    {"name": "Market / Vendor Regulation Issue", "slug": "market_vendor_issue", "icon": "🏪", "color": "#8B5CF6", "description": "Unregulated markets, obstruction by vendors."},
    {"name": "Other Service-Related Issue", "slug": "other_service_related_issue", "icon": "📋", "color": "#6B7280", "description": "General service complaints not categorized above."},
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
    "Gandhipuram Town Bus Stand, Gandhipuram", "DB Road, RS Puram", "Lakshmi Mills Junction, Avinashi Road",
    "Tidel Park, Peelamedu", "Ukkadam Bus Terminus, Ukkadam", "Singanallur Junction, Trichy Road",
    "Saibaba Colony Bus Stop, Mettupalayam Road", "Cross Cut Road, Gandhipuram", "Ramanathapuram Junction, Trichy Road",
    "Coimbatore Junction Railway Station", "Brookefields Mall, TV Samy Road", "Fun Republic Mall, Avinashi Road",
    "Town Hall Main Road, Town Hall", "Thudiyalur Junction, Mettupalayam Road", "Saravanampatti Checkpost, IT Corridor",
    "Race Course Road Promenade, Race Course", "Vadavalli Bus Stand, Marudhamalai Road", "Kovaipudur Center, Kovaipudur",
    "Ganapathy Signal, Sathy Road", "Sitra Junction, Airport Road", "Hope College Bus Stop, Avinashi Road",
    "Ondipudur Flyover, Trichy Road", "Podanur Junction, Podanur", "Perur Temple Road, Perur", "Kuniyamuthur Main Road, Palakkad Road"
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
                city="Coimbatore",
                country="India"
            )
            db.add(profile)
            await db.flush()
        users.append(user)

    logger.info(f"Ensured {len(users)} users (1 Admin + 25 Citizens).")

    # Clear existing incidents to ensure fresh Coimbatore dataset
    result = await db.execute(select(Incident))
    existing_incidents = result.scalars().all()
    if existing_incidents:
        logger.info(f"Clearing {len(existing_incidents)} previous incidents for Coimbatore dataset update...")
        for old_inc in existing_incidents:
            await db.delete(old_inc)
        await db.flush()

    # 4. Generate 55 Realistic Incidents covering max unique categories
    severities = [SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH, SeverityLevel.CRITICAL]
    statuses = [IncidentStatus.PENDING, IncidentStatus.UNDER_REVIEW, IncidentStatus.APPROVED, IncidentStatus.REJECTED, IncidentStatus.RESOLVED]
    status_weights = [0.15, 0.20, 0.40, 0.10, 0.15]  # Most are approved/review

    created_incidents = []
    now = datetime.now(timezone.utc)

    # Shuffle categories to maximize unique category coverage across the 55 incidents
    available_cat_slugs = list(category_map.keys())
    random.shuffle(available_cat_slugs)
    num_incidents = 55
    selected_slugs = [available_cat_slugs[i % len(available_cat_slugs)] for i in range(num_incidents)]

    def get_category_severity(slug: str) -> SeverityLevel:
        s = slug.lower()
        if any(k in s for k in ["emergency", "accident", "crime", "fire", "assault", "chemical", "disaster", "evacuation", "gas_leak", "crowd"]):
            return random.choices([SeverityLevel.HIGH, SeverityLevel.CRITICAL], weights=[0.6, 0.4])[0]
        elif any(k in s for k in ["harassment", "hazard", "robbery", "theft", "suspicious", "pollution", "structural", "missing"]):
            return random.choices([SeverityLevel.MEDIUM, SeverityLevel.HIGH], weights=[0.5, 0.5])[0]
        elif any(k in s for k in ["lighting", "parking", "cleanliness", "noise", "furniture", "toilet", "lost"]):
            return random.choices([SeverityLevel.LOW, SeverityLevel.MEDIUM], weights=[0.7, 0.3])[0]
        return random.choices([SeverityLevel.LOW, SeverityLevel.MEDIUM, SeverityLevel.HIGH], weights=[0.35, 0.45, 0.20])[0]

    logger.info(f"Clearing previous incidents for Coimbatore dataset update...")
    result = await db.execute(select(Incident))
    existing_incidents = result.scalars().all()
    for old_inc in existing_incidents:
        await db.delete(old_inc)
    await db.flush()

    for idx in range(num_incidents):
        cat_slug = selected_slugs[idx]
        category = category_map[cat_slug]
        default_titles = [f"{category.name} reported", f"Safety alert for {category.name}", f"Issue regarding {category.name}"]
        title_template = random.choice(INCIDENT_TITLES.get(cat_slug, default_titles))
        street = STREETS[idx % len(STREETS)]
        title = f"{title_template} - {street.split(',')[0]}"

        # Location around city base with jitter
        lat = round(CITY_BASE_LAT + random.uniform(-0.06, 0.06), 6)
        lng = round(CITY_BASE_LNG + random.uniform(-0.06, 0.06), 6)
        geom = f"SRID=4326;POINT({lng} {lat})"

        reporter = random.choice(users[1:]) if random.random() > 0.15 else None
        is_anon = True if reporter is None or random.random() < 0.2 else False

        severity = get_category_severity(cat_slug)
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
