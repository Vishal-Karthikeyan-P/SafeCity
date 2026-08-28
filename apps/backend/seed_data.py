"""
SafeCity Seed Script
Populates the database with sample data for:
- Learning Article Categories & Articles (8 categories, 2-3 articles each)
- Community Alerts

Usage: venv\Scripts\python seed_data.py
"""
import sys
import os
backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(backend_dir, "venv", "Lib", "site-packages"))
sys.path.insert(0, backend_dir)

import asyncio
import uuid
import re
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

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
    {"name": "Women's Safety",       "icon": "👩",  "description": "Dedicated safety guidelines, resources, and legal rights for women."},
    {"name": "Child Safety",          "icon": "🧒",  "description": "Keeping children safe online, at school, and in public spaces."},
    {"name": "Senior Citizen Safety", "icon": "👴",  "description": "Safety tips, fall prevention, and fraud awareness for elderly citizens."},
    {"name": "Road Safety",           "icon": "🚗",  "description": "Safe driving, pedestrian rules, and accident prevention guidelines."},
    {"name": "Cyber Safety",          "icon": "💻",  "description": "Protecting yourself online from scams, phishing, and digital fraud."},
    {"name": "Fire Safety",           "icon": "🔥",  "description": "Fire prevention, evacuation procedures, and firefighting basics."},
    {"name": "Medical Emergencies",   "icon": "🏥",  "description": "First aid, CPR, and response guides for common medical emergencies."},
    {"name": "Natural Disasters",     "icon": "🌪️", "description": "Preparedness and response guides for earthquakes, floods, and storms."},
]

ARTICLES = [

    # ── Women's Safety ────────────────────────────────────────────
    {
        "category": "Women's Safety",
        "title": "Staying Safe While Using Ride-Sharing Apps",
        "overview": "Ride-sharing apps are convenient but require precautions. Verifying your driver, sharing trip details, and knowing emergency contacts can make every ride safer.",
        "content_dos": "Always verify the driver name, photo, and car plate number before entering. Share your live trip status with a trusted contact. Sit in the back seat. Keep your phone charged.",
        "content_donts": "Do not accept rides from unlicensed drivers. Do not share your exact destination aloud when strangers are nearby. Do not fall asleep during the ride.",
        "emergency_steps": "1. Trust your instincts - if uncomfortable, ask to stop at a public, well-lit place.\n2. Call 100 (Police) or 1091 (Women's Helpline) immediately.\n3. Use the SOS feature in SafeCity app.\n4. Screenshot trip details before exiting.",
        "helpline_numbers": "Women's Helpline: 1091 | Emergency: 112 | Mahila Suraksha: 181 | Police: 100",
        "legal_info": "Drivers must be registered with a valid permit. Under IPC Section 354, any molestation is a cognizable offence punishable with imprisonment.",
    },
    {
        "category": "Women's Safety",
        "title": "Personal Safety While Walking Alone at Night",
        "overview": "Walking alone after dark is a situation many women face. Practical habits, awareness, and technology can significantly reduce risk and boost confidence.",
        "content_dos": "Stay in well-lit, busy streets. Share your live location with a trusted contact. Carry a fully charged phone. Walk confidently and stay alert.",
        "content_donts": "Avoid wearing headphones at high volume. Do not look at your phone constantly while walking. Avoid unlit shortcuts through alleys or parks.",
        "emergency_steps": "1. Call 112 or 100 immediately.\n2. Scream loudly to attract attention.\n3. Run to the nearest public space.\n4. Activate the SafeCity SOS feature.",
        "helpline_numbers": "Emergency: 112 | Police: 100 | Women's Helpline: 1091 | Nirbhaya: 181",
        "legal_info": "IPC Section 354 criminalises assault against a woman. Section 509 covers verbal harassment. You have the right to defend yourself under Section 96 of IPC.",
    },
    {
        "category": "Women's Safety",
        "title": "Workplace Harassment: Know Your Rights",
        "overview": "Workplace sexual harassment is a serious issue. The POSH Act 2013 gives every woman the right to a safe working environment. Understanding your rights and the complaint process is empowering.",
        "content_dos": "Document all incidents with dates, times, and witnesses. Report to the Internal Complaints Committee (ICC). Preserve evidence such as messages or emails.",
        "content_donts": "Do not ignore harassment assuming it will stop. Do not retaliate in a way that could harm your case. Do not share evidence publicly before filing.",
        "emergency_steps": "1. Report immediately to your workplace ICC.\n2. If no ICC exists, file with the Local Complaints Committee (LCC).\n3. For immediate danger, call 100 or 1091.\n4. Consult NALSA for free legal help.",
        "helpline_numbers": "Women's Helpline: 1091 | NCW Helpline: 7827170170 | NALSA: 15100 | Emergency: 112",
        "legal_info": "The POSH Act 2013 mandates every organisation with 10+ employees to have an ICC. Non-compliance attracts fines up to Rs.50,000.",
    },

    # ── Child Safety ──────────────────────────────────────────────
    {
        "category": "Child Safety",
        "title": "Teaching Children About Stranger Danger",
        "overview": "Children need clear, age-appropriate education on identifying unsafe situations. Empowerment - not fear - is the most effective approach.",
        "content_dos": "Teach the No, Go, Yell, Tell rule. Help children identify at least 3 trusted adults. Teach children their full name, parent phone number, and home address.",
        "content_donts": "Do not use extreme fear-based approaches. Do not teach children to be rude to adults - teach assertive, confident refusal.",
        "emergency_steps": "1. Teach children to find a uniformed person or a family with children.\n2. Children should run to a crowded public space immediately.\n3. Call a parent or 112 at the first opportunity.\n4. Scream 'This is not my parent' if being forcibly taken.",
        "helpline_numbers": "Childline: 1098 | Emergency: 112 | Police: 100",
        "legal_info": "The POCSO Act 2012 provides strict punishment for any sexual offence against minors. Reporting is mandatory for teachers, doctors, and officials under Section 19.",
    },
    {
        "category": "Child Safety",
        "title": "Online Safety for Children and Teenagers",
        "overview": "Children face growing online risks including cyberbullying, grooming, and inappropriate content. Parents and children together can build digital safety habits.",
        "content_dos": "Set up parental controls on all devices. Keep computers in common areas of the home. Teach children to never share personal information with strangers online.",
        "content_donts": "Do not allow children to have secret social media accounts. Do not ignore signs of cyberbullying. Do not shame a child who has been targeted online.",
        "emergency_steps": "1. Take screenshots of threatening or inappropriate messages immediately.\n2. Block the account and report it on the platform.\n3. Report online exploitation to cybercrime.gov.in or call 1930.\n4. Seek support from a school counsellor if needed.",
        "helpline_numbers": "Childline: 1098 | Cyber Crime: 1930 | Emergency: 112",
        "legal_info": "IT Act 2000 Section 67B criminalises child pornography and online grooming with up to 7 years imprisonment.",
    },

    # ── Senior Citizen Safety ──────────────────────────────────────
    {
        "category": "Senior Citizen Safety",
        "title": "Preventing Falls at Home for Elderly Citizens",
        "overview": "Falls are the leading cause of injury for senior citizens. Most falls happen at home and are preventable with simple modifications and awareness.",
        "content_dos": "Install grab bars in bathrooms and near stairs. Use non-slip mats in the bathroom and kitchen. Keep pathways clear of clutter. Ensure adequate lighting in all rooms.",
        "content_donts": "Do not use chairs or tables as step stools. Do not rush to answer the phone or door. Do not walk on wet floors without non-slip footwear.",
        "emergency_steps": "1. If you fall and cannot get up, stay calm.\n2. Slide to a wall or couch and use it for support to rise slowly.\n3. If you cannot rise, shout for help or use your mobile.\n4. Call 112 if injured.",
        "helpline_numbers": "Emergency: 112 | Ambulance: 108 | Senior Citizen Helpline: 14567 | Elder Line: 1090",
        "legal_info": "The Maintenance and Welfare of Parents and Senior Citizens Act 2007 requires children to provide maintenance. Abuse of elderly persons is punishable under IPC.",
    },
    {
        "category": "Senior Citizen Safety",
        "title": "Protecting Senior Citizens from Financial Fraud",
        "overview": "Elderly citizens are disproportionately targeted by financial scams including fake pension calls, lottery fraud, and impersonation. Awareness is the strongest defence.",
        "content_dos": "Verify all calls claiming to be from government or banks by calling official numbers. Consult a trusted family member before large financial decisions. Keep Aadhaar, PAN, and bank details private.",
        "content_donts": "Never share OTPs, passwords, or PINs with anyone over the phone. Do not click links in unsolicited SMS messages. Do not be pressured into instant decisions.",
        "emergency_steps": "1. If you suspect fraud, call your bank helpline immediately to block the account.\n2. Report to Cyber Crime Helpline: 1930 or cybercrime.gov.in.\n3. File a complaint at your nearest police station.\n4. Inform a trusted family member immediately.",
        "helpline_numbers": "Senior Citizen Helpline: 14567 | Cyber Crime: 1930 | RBI Helpline: 14448 | Emergency: 112",
        "legal_info": "Financial fraud targeting senior citizens falls under IPC Sections 406 and 420, and the IT Act 2000. Victims can also seek civil recovery through courts.",
    },

    # ── Road Safety ───────────────────────────────────────────────
    {
        "category": "Road Safety",
        "title": "Pedestrian Safety: Rules and Best Practices",
        "overview": "Pedestrians account for nearly 15% of road accident fatalities in India. Simple, consistent habits can dramatically reduce the risk of injury.",
        "content_dos": "Use designated pedestrian crossings. Make eye contact with drivers before crossing. Walk on the pavement facing oncoming traffic. Look both ways before crossing.",
        "content_donts": "Do not use your phone while crossing. Do not wear dark clothing at night without reflective accessories. Do not jaywalk. Do not assume vehicles will always stop.",
        "emergency_steps": "1. If you witness an accident, call 108 (Ambulance) and 100 (Police) immediately.\n2. Do not move an injured person unless they are in immediate danger.\n3. Keep the injured person calm until emergency services arrive.",
        "helpline_numbers": "Ambulance: 108 | Police: 100 | Traffic Control: 103 | Emergency: 112",
        "legal_info": "Jaywalking is a punishable offence under the Motor Vehicles Act. Pedestrians have legal right-of-way at designated crossings.",
    },
    {
        "category": "Road Safety",
        "title": "Safe Driving Practices and Accident Prevention",
        "overview": "Driver behaviour is the leading cause of road accidents. Adhering to traffic rules and avoiding distractions can prevent most collisions.",
        "content_dos": "Always wear a seat belt. Follow speed limits. Maintain a safe following distance. Use turn signals before turning. Rest every 2 hours on long drives.",
        "content_donts": "Never use a mobile phone while driving. Do not drink and drive. Do not drive when fatigued. Do not skip traffic signals.",
        "emergency_steps": "1. In case of a collision, stop immediately and check for injuries.\n2. Call 108 (Ambulance) and 100 (Police).\n3. Do not move critically injured persons unless absolutely necessary.\n4. Switch on hazard lights and warn oncoming traffic.",
        "helpline_numbers": "Ambulance: 108 | Police: 100 | Traffic Helpline: 103 | Emergency: 112",
        "legal_info": "Drunk driving (BAC > 0.03%) is punishable under MV Act Section 185 with up to 6 months imprisonment and Rs.10,000 fine.",
    },

    # ── Cyber Safety ──────────────────────────────────────────────
    {
        "category": "Cyber Safety",
        "title": "Protecting Yourself from Online Scams and Phishing",
        "overview": "Online scams including phishing emails, fake job offers, UPI fraud, and romance scams are increasingly sophisticated. Learn to identify and avoid them.",
        "content_dos": "Verify the sender email address carefully. Enable two-factor authentication on all important accounts. Check URLs before clicking. Report suspicious messages.",
        "content_donts": "Never share OTPs, passwords, or CVV numbers with anyone. Do not click links in unsolicited SMS or emails. Do not install apps from unofficial sources.",
        "emergency_steps": "1. Immediately stop all communication with the suspected scammer.\n2. Call your bank helpline to freeze compromised accounts.\n3. Report to Cyber Crime Helpline: 1930 or cybercrime.gov.in.\n4. File a complaint at the nearest police station with all evidence.",
        "helpline_numbers": "Cyber Crime Helpline: 1930 | cybercrime.gov.in | Emergency: 112 | RBI: 14448",
        "legal_info": "Online fraud is punishable under IT Act 2000 Sections 66C and 66D with up to 3 years imprisonment. UPI fraud is also covered under IPC Section 420.",
    },
    {
        "category": "Cyber Safety",
        "title": "Protecting Your Social Media Privacy",
        "overview": "Oversharing on social media can expose you to stalking, theft, and identity fraud. Learn how to lock down your profiles and share responsibly.",
        "content_dos": "Set your profiles to Friends Only or Private. Regularly review connected apps. Use strong unique passwords for each platform. Enable login alerts.",
        "content_donts": "Do not post real-time location updates while away from home. Do not share photos revealing your home address or car plate. Do not accept requests from strangers.",
        "emergency_steps": "1. If your account is hacked, change your password and enable 2FA immediately.\n2. Report the hack to the platform help centre.\n3. Inform your contacts so they are not deceived.\n4. Report identity theft to cybercrime.gov.in or call 1930.",
        "helpline_numbers": "Cyber Crime: 1930 | cybercrime.gov.in | Emergency: 112",
        "legal_info": "Unauthorised access to accounts is punishable under IT Act Section 66. Identity theft under Section 66C carries up to 3 years imprisonment and Rs.1 lakh fine.",
    },

    # ── Fire Safety ───────────────────────────────────────────────
    {
        "category": "Fire Safety",
        "title": "Fire Prevention and Home Safety",
        "overview": "Most home fires are preventable. Understanding common causes and maintaining basic fire safety equipment can protect your family and property.",
        "content_dos": "Install smoke detectors on every floor and test them monthly. Keep a fire extinguisher in the kitchen. Never leave cooking unattended. Create and practise a home fire escape plan.",
        "content_donts": "Do not overload electrical sockets or use damaged wiring. Do not leave candles or cigarettes unattended. Do not block exits with furniture. Do not go back inside a burning building.",
        "emergency_steps": "1. Alert everyone by shouting FIRE immediately.\n2. Call 101 (Fire Brigade) and 112 without delay.\n3. Use a fire extinguisher only on small, contained fires (PASS: Pull, Aim, Squeeze, Sweep).\n4. Evacuate using stairs - never use the lift.\n5. Close doors behind you to slow fire and smoke spread.",
        "helpline_numbers": "Fire Brigade: 101 | Emergency: 112 | Ambulance: 108",
        "legal_info": "Building owners are legally required to maintain fire safety equipment under the National Building Code and local fire safety regulations.",
    },
    {
        "category": "Fire Safety",
        "title": "What to Do If You Are Trapped in a Fire",
        "overview": "When escape routes are blocked, knowing exactly what to do can mean the difference between survival and tragedy. Stay calm, act fast, and signal for help.",
        "content_dos": "Stay low to the ground where air is cleaner. Seal gaps under doors with clothing or towels to keep smoke out. Signal from a window using a light-coloured cloth.",
        "content_donts": "Do not open a hot door - fire is on the other side. Do not jump from heights above the 2nd floor unless fire is immediate. Do not waste time gathering belongings.",
        "emergency_steps": "1. Call 101 (Fire) and 112 immediately with your exact location and floor number.\n2. Seal all gaps under the door with available cloth.\n3. Signal your presence from the window by waving a cloth.\n4. If smoke enters, shelter in a bathroom and turn on the shower.",
        "helpline_numbers": "Fire Brigade: 101 | Emergency: 112 | Ambulance: 108",
        "legal_info": "Fire department personnel have authority to direct evacuation procedures. Obstructing their work is a punishable offence under the Fire Services Act.",
    },

    # ── Medical Emergencies ───────────────────────────────────────
    {
        "category": "Medical Emergencies",
        "title": "Basic First Aid: What to Do in a Medical Emergency",
        "overview": "Knowing basic first aid can mean the difference between life and death in the minutes before professional medical help arrives.",
        "content_dos": "Stay calm and assess the situation for safety before approaching. Call 108 (Ambulance) immediately. Keep the person still and comfortable. Monitor breathing and pulse until help arrives.",
        "content_donts": "Do not move someone with a suspected spinal injury unless there is an immediate life-threatening hazard. Do not give food or water to an unconscious person. Do not remove an embedded object from a wound.",
        "emergency_steps": "1. CHECK: Is the scene safe? Check for hazards before approaching.\n2. CALL: Dial 108 (Ambulance) or 112 and describe the situation.\n3. CARE: Apply first aid (CPR, bleeding control, recovery position).\n4. Stay on the line with emergency services and follow their instructions.",
        "helpline_numbers": "Ambulance: 108 | Emergency: 112 | Poison Control: 1800-11-6117",
        "legal_info": "India's Good Samaritan law (2016) protects bystanders who provide emergency assistance in good faith from civil and criminal liability.",
    },
    {
        "category": "Medical Emergencies",
        "title": "Recognising and Responding to a Heart Attack or Stroke",
        "overview": "Heart attacks and strokes are time-critical emergencies. The faster you act, the better the outcome. Learn to recognise the warning signs and respond effectively.",
        "content_dos": "For heart attack: call 108 immediately, have the person sit or lie comfortably, loosen tight clothing. For stroke: use FAST - Face drooping, Arm weakness, Speech difficulty, Time to call 108.",
        "content_donts": "Do not wait to see if symptoms improve - every minute counts. Do not give anything to eat or drink. Do not let the person drive themselves. Do not leave them alone.",
        "emergency_steps": "1. Call 108 immediately and clearly state possible heart attack or stroke.\n2. Keep the person calm and still. Loosen tight clothing.\n3. If the person becomes unconscious and stops breathing, begin CPR if trained.\n4. Record the time symptoms started - this helps doctors choose treatment.",
        "helpline_numbers": "Ambulance: 108 | Emergency: 112 | Coimbatore Govt Hospital: 0422-2300670",
        "legal_info": "India's Good Samaritan law protects bystanders who provide emergency care in good faith. Hospitals are legally obligated to provide emergency treatment before demanding payment.",
    },

    # ── Natural Disasters ─────────────────────────────────────────
    {
        "category": "Natural Disasters",
        "title": "Earthquake Preparedness and Response",
        "overview": "Earthquakes strike without warning. Knowing the right actions before, during, and after an earthquake can save lives. Drop, Cover, and Hold On is the globally proven response.",
        "content_dos": "Before: Secure heavy furniture to walls. Identify safe spots in each room. Keep an emergency kit ready. During: DROP to hands and knees, take COVER under sturdy furniture, HOLD ON until shaking stops.",
        "content_donts": "Do not run outside during shaking - most injuries occur near exits from falling debris. Do not use elevators after a quake. Do not light matches immediately after - gas leaks are common.",
        "emergency_steps": "1. DROP, COVER, HOLD ON immediately when shaking begins.\n2. Remain indoors until shaking stops, then evacuate calmly via stairs.\n3. Call 112 for emergency services.\n4. Move away from damaged buildings; watch for aftershocks.",
        "helpline_numbers": "NDRF: 011-24363260 | NDMA: 1078 | Emergency: 112 | Ambulance: 108",
        "legal_info": "After a major disaster, authorities may issue mandatory evacuation orders under the Disaster Management Act 2005. Compliance is legally required in designated disaster zones.",
    },
    {
        "category": "Natural Disasters",
        "title": "Flood Safety: Before, During, and After",
        "overview": "Floods are the most common natural disaster in India. Advance preparation, knowing evacuation routes, and staying informed are your best defences.",
        "content_dos": "Monitor weather alerts from IMD (imd.gov.in). Know your local evacuation routes and shelter locations. Keep an emergency kit with food, water, and important documents in a waterproof bag.",
        "content_donts": "Never cross a flooded road or bridge. Do not drive into floodwater. Do not touch electrical equipment in a flooded area. Do not return home until authorities declare it safe.",
        "emergency_steps": "1. When a flood warning is issued, switch off electricity at the mains and move valuables to higher floors.\n2. Evacuate immediately to designated relief centres if instructed.\n3. Call 112 if you are trapped. Use a torch to signal rescuers at night.\n4. After flooding recedes, boil all drinking water.",
        "helpline_numbers": "NDMA: 1078 | NDRF: 011-24363260 | Emergency: 112 | IMD: imd.gov.in",
        "legal_info": "The Disaster Management Act 2005 authorises state governments to enforce evacuations during disasters. Hoarding essential goods during a disaster is a criminal offence.",
    },
]

COMMUNITY_ALERTS = [
    {
        "title": "High Incident Zone Advisory - RS Puram, Coimbatore",
        "message": "SafeCity data shows an elevated number of theft and chain-snatching incidents in the RS Puram area over the past 7 days. Exercise extra caution, avoid displaying jewellery, and travel in groups after dark.",
        "alert_type": AlertType.HIGH_RISK_AREA,
        "expires_in_hours": 168,
    },
    {
        "title": "System Announcement: SafeCity Platform Now Live",
        "message": "Welcome to SafeCity! Our community safety platform is now live in Coimbatore. Report incidents, view the live safety map, plan safe routes, and access emergency contacts all in one place.",
        "alert_type": AlertType.SYSTEM_ANNOUNCEMENT,
        "expires_in_hours": None,
    },
    {
        "title": "Heavy Rain Warning - Low-Lying Areas of Coimbatore",
        "message": "The IMD has forecast heavy rainfall over the next 48 hours. Residents in low-lying and flood-prone areas of Coimbatore are advised to move valuables to higher floors and avoid crossing flooded roads.",
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
