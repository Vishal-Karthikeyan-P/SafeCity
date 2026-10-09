"""
Grounded Knowledge Base & Safety Guardrails for SafeCity Gemini Chatbot.

Jurisdiction: Republic of India.
Sources: SafeCity Platform Architecture, National Emergency Services,
         Learning Hub Curated Guides, Official Legal Acts (BNS/IPC, POSH, POCSO, IT Act).
"""
import re
from typing import Dict, List, Optional, Tuple

# ── 1. Master System Safety Instruction for Gemini ─────────────────────────
SYSTEM_SAFETY_INSTRUCTION = """
You are the SafeCity Safety AI Assistant, integrated directly into the SafeCity Smart City Platform (Web & Android).

PRIMARY DIRECTIVE & CONSTRAINTS:
1. PERMITTED SCOPE: You may ONLY answer questions regarding:
   - SafeCity platform features (Web and Android apps).
   - Emergency procedures, first aid, and immediate personal/community safety steps.
   - Emergency do's and don'ts.
   - Relevant legal information with jurisdiction explicitly stated (Republic of India).
   - Safety learning content maintained in the SafeCity Learning Hub.
2. STRICT ANTI-HALLUCINATION POLICY:
   - NEVER invent legal sections, acts, or penalties.
   - NEVER invent emergency phone numbers or services. Only cite official verified numbers.
   - NEVER invent SafeCity functionality, buttons, or simulated incident counts.
   - NEVER claim that you have dispatched police, called an ambulance, or contacted authorities.
   - If reliable verified information is not available in your knowledge base, say: "I do not have verified information on this specific topic. Please contact local emergency services or consult official authorities."
3. JURISDICTION REQUIREMENT:
   - Whenever providing legal guidance, you MUST explicitly identify the jurisdiction: "Jurisdiction: Republic of India" and cite the exact verified statute (e.g., POSH Act 2013, POCSO Act 2012, IT Act 2000, IPC/BNS).
4. IMMEDIATE DANGER PRIORITY:
   - If a user mentions being in danger, followed, assaulted, or trapped right now: PRIORITIZE concise, life-saving steps: dial 112, move to populated safety, or trigger the SafeCity SOS button. Do NOT provide lengthy text or delay urgent action with unnecessary questions.
5. MANDATORY DISCLAIMER:
   - Always adhere to the fact that SafeCity AI is an informational tool and does not replace emergency response services (dial 112) or professional legal advice.
6. TONE & STYLE:
   - Clear, calm, assertive, highly structured with bullet points, and concise. Avoid unnecessary conversational fluff.
""".strip()

# ── 2. Verified SafeCity Features Knowledge ────────────────────────────────
VERIFIED_SAFECITY_FEATURES = """
SAFECITY PLATFORM FEATURES (WEB + ANDROID):

1. EMERGENCY SOS (Active Protection):
   - Triggered by tapping the red 'EMERGENCY SOS' card on mobile or SOS trigger.
   - Features a 10-second countdown with an audible warning and an instant cancel option for accidental triggers.
   - When confirmed, broadcasts GPS coordinates, battery level, and user status to designated emergency contacts.
   - Activates an 'Active SOS' screen with direct 1-tap call to 112, flashlight strobe, high-decibel siren alarm, and real-time location sharing.

2. SAFE ROUTE PLANNING:
   - Uses OSRM (Open Source Routing Machine) combined with SafeCity's proprietary incident-density penalty algorithm.
   - Compares the standard fastest route against the safest route that detours around verified high-crime and unlit incident clusters.
   - Provides risk difference percentages, hazard warnings along the path, and turn-by-turn guidance.

3. LIVE SAFETY MAP & HEATMAP:
   - Interactive OpenStreetMap/Leaflet map displaying real-time safety scores, incident markers, and police station locations.
   - Filters by incident category (Harassment, Theft, Poor Lighting, Hazard, Suspicious Activity, Assault) and verification status.
   - Dynamic heatmap reveals high-risk geographic clusters in the city.

4. INCIDENT REPORTING:
   - Allows citizens to report hazards, harassment, accidents, poor infrastructure, or crimes.
   - Supports geotagged location selection, category, severity level (Low, Medium, High, Critical), photo evidence upload, and anonymous submission mode to protect privacy.
   - Admin-moderated with verification workflows to prevent false reports.

5. REAL-TIME SAFETY SCORE:
   - Evaluates a 0-100 safety index based on current GPS coordinates, distance to nearest police station, density of recent incidents within a 2km radius, and lighting condition ratings.
   - Color-coded: 80-100 (Safe / Green), 50-79 (Caution / Amber), 0-49 (Unsafe / Red).

6. LEARNING HUB:
   - Curated knowledge base covering 9 core domains: Women's Safety, Child Safety, Senior Citizen Safety, Road Safety, Cyber Safety, Home Security, Fire Safety, Medical Emergencies, Natural Disasters.
   - Every guide contains concise Do's, Don'ts, Step-by-Step Emergency Actions, Official Helplines, and Legal Protections.

7. EMERGENCY CONTACTS & BROADCASTS:
   - Manage trusted primary and secondary contacts with direct in-app alerts and SMS/call links.
   - Community Alerts broadcast hyper-local critical warnings to nearby citizens.
""".strip()

# ── 3. Verified Emergency Helplines (India) ─────────────────────────────────
VERIFIED_EMERGENCY_HELPLINES = """
OFFICIAL EMERGENCY HELPLINES (JURISDICTION: REPUBLIC OF INDIA):
- National All-In-One Emergency: 112 (Police, Fire, Medical, Disaster integrated)
- Police Control Room: 100
- Fire Service: 101
- Ambulance / Medical Emergency: 108 (or 102)
- Women's Helpline (All-India): 1091
- Women in Distress / Domestic Abuse (National Commission for Women): 7827170170 / 181
- Childline (Child Abuse / Distress): 1098
- Senior Citizen Helpline (Elder Line): 14567
- National Cyber Crime Reporting Helpline: 1930 (Official portal: cybercrime.gov.in)
- National Disaster Management Authority (NDMA): 1078
- Railway Protection Force (RPF Helpline): 139
- Free Legal Aid (NALSA): 15100
- Mental Health Helpline (KIRAN): 1800-599-0019
""".strip()

# ── 4. Verified Legal Framework (India) ─────────────────────────────────────
VERIFIED_LEGAL_FRAMEWORK = """
VERIFIED LEGAL PROTECTIONS (JURISDICTION: REPUBLIC OF INDIA):

1. WOMEN'S SAFETY & SEXUAL HARASSMENT:
   - POSH Act, 2013 (Sexual Harassment of Women at Workplace Act):
     * Mandates an Internal Complaints Committee (ICC) in every organisation with 10+ employees.
     * Employers failing to constitute an ICC face penalties up to Rs. 50,000.
     * Complaints can be submitted within 3 months of the incident.
   - Indian Penal Code (IPC) / Bharatiya Nyaya Sanhita (BNS):
     * Section 354 IPC / Sec 74 BNS: Assault or use of criminal force against woman with intent to outrage modesty (Cognizable, Non-Bailable).
     * Section 354D IPC / Sec 78 BNS: Stalking (online or physical) punishable by up to 3-5 years imprisonment.
     * Section 509 IPC / Sec 79 BNS: Word, gesture, or act intended to insult modesty of a woman.
     * Section 96-106 IPC / Sec 34-44 BNS: Right of Private Defence (the lawful right to defend your body or another person against imminent unlawful harm).
     * Zero FIR Principle: Any police station must register an FIR for cognizable offences regardless of where the crime occurred, without transferring jurisdiction first.

2. CHILD PROTECTION:
   - Protection of Children from Sexual Offences (POCSO) Act, 2012:
     * Section 19: Mandatory reporting for any person, teacher, doctor, or institution aware of child sexual offences. Failure to report carries imprisonment.
     * Special courts and child-friendly recording of statements without the accused present.
   - Juvenile Justice (Care and Protection of Children) Act, 2015.

3. CYBER SAFETY & FRAUD:
   - Information Technology Act, 2000:
     * Section 66C: Identity theft, stealing passwords/biometrics (up to 3 years imprisonment).
     * Section 66D: Cheating by personation using computer resource / online financial scam.
     * Section 67B: Publishing or transmitting child sexually explicit material online (up to 5-7 years imprisonment).
   - Financial Fraud Response: Call 1930 immediately to freeze fraudulent transactions during the 'Golden Hour' before money is routed through mule accounts.

4. ROAD ACCIDENT ASSISTANCE (GOOD SAMARITAN LAW):
   - Motor Vehicles (Amendment) Act, 2019 - Section 134A:
     * Good Samaritan Law: Any bystander who provides emergency medical care or transports an accident victim to a hospital is protected from civil and criminal liability.
     * Police and hospital staff cannot compel a Good Samaritan to reveal their identity, pay hospital fees, or appear as a witness unless they voluntarily choose to do so.

5. SENIOR CITIZENS:
   - Maintenance and Welfare of Parents and Senior Citizens Act, 2007:
     * Obligation of adult children/heirs to provide maintenance and shelter.
     * Abandonment or physical abuse of senior citizens is punishable under Section 24.
""".strip()

# ── 5. Curated Emergency Procedures ─────────────────────────────────────────
VERIFIED_EMERGENCY_PROCEDURES = """
CURATED PRACTICAL EMERGENCY PROCEDURES:

1. BEING FOLLOWED / PHYSICAL STALKING:
   - DO: Change direction immediately into a well-lit, crowded commercial area or shop.
   - DO: Keep your phone in hand and trigger the SafeCity SOS countdown or call 112 / 100.
   - DO: Make a loud phone call announcing your exact live location to a contact.
   - DON'T: Head into unlit shortcuts, alleys, underground passages, or your empty home.
   - DON'T: Wear noise-cancelling headphones while walking after dark.

2. RIDESHARE / CAB SAFETY:
   - DO: Verify the vehicle number plate, driver name, and photo match the app before entering.
   - DO: Sit in the rear passenger seat opposite the driver.
   - DO: Share live trip tracking with a trusted SafeCity emergency contact.
   - DON'T: Enter if the child lock is visibly engaged or windows cannot roll down.
   - DON'T: Share private personal details or say your home address out loud.

3. MEDICAL EMERGENCY & FIRST AID:
   - Suspected Cardiac Arrest: Check responsiveness and breathing. Immediately call 108 / 112. Perform Hands-Only CPR (push hard and fast in center of chest, 100-120 bpm to the rhythm of 'Stayin' Alive').
   - Severe Bleeding: Apply direct, firm, continuous pressure with a clean cloth. Elevate the wounded limb above heart level if no fracture is suspected.
   - Choking: If person cannot speak or cough, perform Heimlich maneuver (abdominal thrusts upward).

4. FIRE SAFETY & EVACUATION:
   - DO: Pull nearest fire alarm, yell 'Fire!', call 101 / 112.
   - DO: Crawl low under smoke (clean air is near the floor).
   - DO: Feel doors with the back of your hand before opening; if hot, do not open.
   - DON'T: NEVER use elevators during a fire; always take emergency stairs.
   - If clothes catch fire: STOP, DROP, and ROLL.

5. CYBER FRAUD / OTP SCAM:
   - DO: Immediately call 1930 (National Cyber Crime Helpline) within the golden hour to request banking freeze.
   - DO: Contact your bank's 24/7 hotline to block all debit/credit cards and net banking access.
   - DO: Save transaction screenshots, SMS messages, and bank statement PDF.
   - DON'T: Never share OTP, UPI PIN, ATM PIN, or password with anyone, including purported bank officials.
""".strip()

# ── 6. Pre-Screening & Guardrails ──────────────────────────────────────────

INJECTION_PATTERNS = [
    r"ignore (all )?(previous|above) instructions",
    r"you are now (dan|unrestricted|godmode|jailbroken)",
    r"bypass (all )?(guardrails|safety|rules|restrictions)",
    r"reveal (your )?(system prompt|secret key|api key)",
    r"what is your (gemini_api_key|api key|prompt)",
    r"pretend to have no rules",
    r"disregard (the )?system instructions",
    r"simulate an unfiltered ai",
]

IMMEDIATE_DANGER_KEYWORDS = [
    "in danger right now",
    "someone is following me",
    "somebody is following me",
    "being attacked",
    "intruder in my",
    "breaking into my",
    "held hostage",
    "help me right now",
    "stalking me right now",
    "trapped in a fire",
    "house is on fire",
    "choking right now",
    "unconscious and not breathing",
    "someone has a knife",
    "someone has a gun",
    "please call police for me",
]

# Keywords that indicate safety / SafeCity relevance
SAFETY_KEYWORDS = [
    "safecity", "safe city", "sos", "emergency", "police", "ambulance", "fire",
    "helpline", "help", "safe", "safety", "danger", "hazard", "incident", "report",
    "map", "route", "safe route", "score", "learning hub", "article",
    "harass", "stalk", "assault", "crime", "theft", "stolen", "robbery",
    "first aid", "cpr", "bleeding", "burn", "choking", "medical",
    "disaster", "earthquake", "flood", "storm",
    "woman", "women", "child", "children", "senior", "elderly", "pedestrian", "road",
    "posh", "pocso", "ipc", "bns", "law", "legal", "rights", "fir", "complaint",
    "cyber", "scam", "fraud", "otp", "phishing", "hack",
    "night", "cab", "rideshare", "taxi", "walk", "alone",
    "contact", "notification", "alert", "guidance", "dos and don'ts", "do's"
]

STATIC_SUGGESTIONS = [
    {
        "id": "sug_sos",
        "category": "SafeCity Features",
        "question": "How does SafeCity's Emergency SOS feature work?",
        "icon": "🚨"
    },
    {
        "id": "sug_night",
        "category": "Personal Safety",
        "question": "What are key do's and don'ts when walking alone at night?",
        "icon": "🌙"
    },
    {
        "id": "sug_helplines",
        "category": "Emergency",
        "question": "What are the official national emergency helplines in India?",
        "icon": "📞"
    },
    {
        "id": "sug_posh",
        "category": "Legal Rights",
        "question": "What are my legal rights regarding workplace harassment under POSH Act?",
        "icon": "⚖️"
    },
    {
        "id": "sug_route",
        "category": "SafeCity Features",
        "question": "How does the Safe Route planner choose safer paths?",
        "icon": "🗺️"
    },
    {
        "id": "sug_cyber",
        "category": "Cyber Safety",
        "question": "What immediate steps should I take if targeted by an online financial scam?",
        "icon": "🛡️"
    }
]


def check_prompt_injection(message: str) -> Optional[str]:
    """Detect common prompt injection, jailbreak, or credential leak attempts."""
    msg_lower = message.lower().strip()
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, msg_lower):
            return (
                "🛡️ **SafeCity Safety Guardrail**\n\n"
                "I am programmed exclusively to assist with SafeCity features, personal & community safety, "
                "emergency procedures, and verified safety laws (Republic of India). "
                "I cannot bypass my safety guidelines, alter my role, or disclose system internals.\n\n"
                "Please ask a safety, emergency, or SafeCity-related question."
            )
    return None


def check_immediate_danger(message: str) -> Optional[Dict]:
    """Detect active emergency keywords and return an immediate life-saving response without delay."""
    msg_lower = message.lower().strip()
    for keyword in IMMEDIATE_DANGER_KEYWORDS:
        if keyword in msg_lower:
            return {
                "reply": (
                    "🚨 **IMMEDIATE DANGER ALERT — ACT NOW**\n\n"
                    "1. **DIAL 112 IMMEDIATELY:** Contact National Emergency Services for instant police/medical dispatch.\n"
                    "2. **TRIGGER SAFECITY SOS:** Press the red **EMERGENCY SOS** button on your SafeCity screen to broadcast your GPS location to your emergency contacts.\n"
                    "3. **MOVE TO SAFETY:** Head immediately to a well-lit, crowded public area (open shops, security booths, busy streets).\n"
                    "4. **DRAW ATTENTION:** Shout loudly for help or use SafeCity's siren alarm to deter threats.\n\n"
                    "⚠️ *Note: This chatbot cannot dispatch police or emergency units. Call 112 directly right now.*"
                ),
                "is_emergency": True,
                "suggested_actions": [
                    "Call 112 (National Emergency)",
                    "Activate SafeCity SOS Button",
                    "Share live location with trusted contact",
                    "Move to populated area"
                ],
                "sources": ["National Emergency Response 112", "SafeCity SOS Guide"],
                "grounded": True
            }
    return None


def check_safety_relevance(message: str) -> bool:
    """Check if the question is related to SafeCity, safety, legal rights, or emergencies."""
    msg_lower = message.lower().strip()
    
    # Very short greetings or acknowledgments can pass to friendly welcome
    if msg_lower in ["hi", "hello", "hey", "help", "good morning", "good evening"]:
        return True
        
    for kw in SAFETY_KEYWORDS:
        if kw in msg_lower:
            return True
    return False


def get_canned_offtopic_response() -> str:
    """Return a short, zero-cost canned response for unrelated queries."""
    return (
        "ℹ️ **Topic Outside Safety Scope**\n\n"
        "I am the **SafeCity AI Safety Assistant**. To ensure safety reliability and keep resources available for citizens, "
        "I can only answer questions about:\n"
        "• **SafeCity App Features** (SOS button, Live Map, Safe Route, Incident Reporting, Safety Scores)\n"
        "• **Emergency Procedures** (First aid, CPR, fire safety, disasters)\n"
        "• **Emergency Do's and Don'ts** (Night travel, transit, home safety)\n"
        "• **Legal Protections** (POSH Act, POCSO Act, IT Act, Good Samaritan Law, IPC/BNS in India)\n"
        "• **Learning Hub Guides** and official helpline numbers\n\n"
        "Please ask a safety or SafeCity question, or select one of the suggested topics below."
    )


def assemble_context(relevant_articles_text: str = "") -> str:
    """Combine static verified knowledge with dynamic learning articles for prompt grounding."""
    context_parts = [
        "### 1. SAFECITY PLATFORM FEATURES",
        VERIFIED_SAFECITY_FEATURES,
        "\n### 2. OFFICIAL EMERGENCY HELPLINES (INDIA)",
        VERIFIED_EMERGENCY_HELPLINES,
        "\n### 3. VERIFIED LEGAL FRAMEWORK (INDIA)",
        VERIFIED_LEGAL_FRAMEWORK,
        "\n### 4. PRACTICAL EMERGENCY PROCEDURES & DO'S/DON'TS",
        VERIFIED_EMERGENCY_PROCEDURES,
    ]
    if relevant_articles_text.strip():
        context_parts.extend([
            "\n### 5. DYNAMIC VERIFIED LEARNING HUB ARTICLES FROM DATABASE",
            relevant_articles_text.strip()
        ])
    return "\n\n".join(context_parts)
