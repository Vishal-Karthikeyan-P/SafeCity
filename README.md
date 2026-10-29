# SafeCity 🛡️

SafeCity is a **complete, production-ready smart city safety platform** that empowers citizens to report incidents, stay informed, and stay safe — while giving administrators powerful tools to moderate and analyze city-wide safety data.

---

## ✨ Features

| Category | Feature |
|---|---|
| 🔐 **Authentication** | JWT-based login/registration, Role-Based Access Control (RBAC), password hashing (bcrypt) |
| 🗺️ **Live Safety Map** | Interactive Leaflet map with clustering, heatmap overlay, safe route planning (OSRM) |
| 📋 **Incident Reporting** | Map-based location selection, multi-image upload, severity grading, anonymous reporting |
| 🔍 **Global Search** | Cross-entity search across incidents and learning articles |
| 📚 **Learning Hub** | Categorized safety guides with Do's/Don'ts, emergency steps, helplines, legal info |
| 🤖 **AI Safety Assistant** | Gemini-powered conversational assistant integrated into Learning Hub on Web & Android with strict anti-hallucination guardrails, verified emergency helplines (112), Indian legal frameworks (POSH, POCSO, IT Act), and instant emergency action guidance |
| 🚨 **Community Alerts** | Two-mode alert system: City-wide broadcasts & PostGIS location-radius alerts with live map preview |
| 🆘 **SOS & Emergency** | User-to-user in-app emergency contact network with live GPS alerting, plus offline phonebook fallback |
| 📊 **Admin Dashboard** | Full analytics (Recharts), moderation tools, user management, content management (Articles & Alerts) |
| 📱 **Mobile App** | React Native (Expo) Android app with auth, safe route planner, safety details, live GPS guidance, route deviation alerts, incident reporting, and notifications |

---

## 🏗️ Architecture

This is a **monorepo** setup:

```
Safe City/
├── apps/
│   ├── backend/          # FastAPI + SQLAlchemy + PostGIS (Python)
│   ├── web/              # React + Vite + TypeScript (Frontend)
│   └── mobile/           # React Native + Expo (Android)
├── shared/               # Shared TypeScript types
└── docker-compose.yml
```

### Backend Stack
- **FastAPI** — async REST API with OpenAPI docs
- **SQLAlchemy 2.0** — async ORM with typed models
- **PostgreSQL + PostGIS** — spatial database for geo queries
- **Alembic** — database migrations
- **JWT** — access + refresh token auth
- **OSRM** — open-source routing for safe route planning

### Frontend Stack
- **React 18 + TypeScript** — component-based UI
- **Vite** — lightning-fast bundler
- **React Query (TanStack)** — server state management
- **Leaflet** — interactive maps with heatmaps and route polylines
- **Recharts** — analytics charts
- **Zustand** — client state management
- **Zod + React Hook Form** — form validation

### Mobile Stack
- **React Native + Expo SDK 50** — cross-platform mobile framework
- **React Navigation** — stack + bottom tab navigation
- **TanStack React Query** — server state management
- **Axios** — HTTP client with JWT interceptor
- **Zustand** — auth + global state
- **Expo Location** — GPS and geolocation
- **Expo Secure Store** — encrypted token storage

---

## 🚀 Quick Start (Docker)

The fastest way to run the entire stack is using Docker Compose.

```bash
# 1. Create environment file
cp .env.example .env

# 2. Build and start containers
docker-compose up --build -d

# 3. (Optional) Seed content data
docker exec safecity-backend python seed_data.py
```

Access the applications:
- **Frontend**: [http://localhost:8080](http://localhost:8080)
- **Backend API**: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
- **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

> The backend automatically runs migrations and seeds initial categories, 25 citizen users, 85 incidents, and notifications on startup.

---

## 💻 Local Development (Without Docker)

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+ with PostGIS extension

### 2. Database Setup
```sql
CREATE DATABASE safecitydb;
\c safecitydb
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 3. Backend Setup
```bash
cd apps/backend
cp .env.example .env
# Edit .env with your database credentials

python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
alembic upgrade head
python seed_data.py   # Seed articles, alerts
python -m app.db.init_db  # Seed users, incidents

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
### 4. Updating & Seeding Categories

To initialize or update the database with the expanded incident categories, users, sample incidents, and notifications:

```bash
cd apps/backend
python -m app.db.init_db
```

Or seed extra learning articles and community alerts:

```bash
python seed_data.py
```

### 4. Frontend Setup
```bash
cd apps/web
npm install
npm run dev
```

---

## 📱 Mobile App (React Native / Expo)

The SafeCity Android app is built with **React Native + Expo SDK 50**. It connects to the same FastAPI backend.

### Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | 18.x or 20.x (recommended) | [nodejs.org](https://nodejs.org) |
| Expo Go (physical device) | Latest | [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) |
| Android Studio (emulator) | Latest | [developer.android.com](https://developer.android.com/studio) |
| JDK | 17+ | Required by Android SDK |

> ⚠️ **Node 22+ / Node 24 Users (Windows)**: A patch is already applied to `@expo/cli` to fix a Windows path error with `node:sea` module. If you reinstall node_modules, re-apply the fix described in the Troubleshooting section below.

---

### Step 1 — Start the Backend

The mobile app requires the FastAPI backend to be running and accessible on your network.

```bash
# From project root
cd apps/backend

# Activate virtual environment
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/Mac

# Start the backend (bind to all interfaces so mobile can reach it)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Verify it works:
```
http://localhost:8000/docs        ✅ Swagger UI
http://localhost:8000/api/v1/incidents  ✅ Incident list
```

---

### Step 2 — Configure API URL

Edit `apps/mobile/src/config/env.ts` and set the correct `API_BASE_URL`:

| Scenario | URL to use |
|---|---|
| Android Emulator (AVD) | `http://10.0.2.2:8000/api/v1` ← default |
| Physical Android via USB/LAN | `http://<YOUR_PC_LAN_IP>:8000/api/v1` |
| Docker deployment | `http://<docker-host-ip>:8000/api/v1` |

**How to find your LAN IP (Windows):**
```cmd
ipconfig
# Look for "IPv4 Address" under your active adapter, e.g. 192.168.1.105
```

Then update `env.ts`:
```typescript
export const API_BASE_URL = 'http://192.168.1.105:8000/api/v1';  // physical device
// export const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';    // emulator
```

---

### Step 3 — Install Mobile Dependencies

```bash
cd apps/mobile
npm install
```

---

### Step 4 — Run the Mobile App

#### Option A — Android Emulator (Android Studio AVD)

1. Open **Android Studio** → **Virtual Device Manager** → Start an AVD (API 33+ recommended)
2. In a new terminal:
   ```bash
   cd apps/mobile
   npx expo start
   ```
3. When the Metro bundler opens, press **`a`** to open on the Android emulator.

#### Option B — Physical Android Device (Expo Go)

1. Install **Expo Go** from the [Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent) on your Android phone.
2. Make sure your phone and PC are on the **same Wi-Fi network**.
3. Update `API_BASE_URL` in `env.ts` to your PC's LAN IP (see Step 2).
4. Run:
   ```bash
   cd apps/mobile
   npx expo start
   ```
5. Open the **Expo Go** app on your phone → **Scan QR code** shown in the terminal.

#### Option C — From the Project Root

```bash
# From Safe City/ root
npm run dev:mobile
```

---

### Step 5 — Log In

Use the seeded demo credentials:

| Role | Email | Password |
|---|---|---|
| **Admin** | `admin@safecity.com` | `AdminPass123!` |
| **Demo Citizen** | `aarav.sharma1@safecity.demo` | `CitizenPass123!` |

---

### Step 6 — Building & Installing Android Test APK

#### Option A — Local Debug APK Build (No Cloud Account Required)

If you have JDK 17 and Android SDK installed locally:

```bash
cd apps/mobile

# 1. Generate the native Android project (if not already generated)
npx expo prebuild --platform android

# 2. Build the Debug APK using Gradle Wrapper
cd android
./gradlew.bat assembleDebug       # Windows
# ./gradlew assembleDebug         # macOS/Linux
```

The resulting test APK is located at:
```text
apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

**To install on a connected Android phone or emulator via ADB:**
```bash
adb install apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

#### Option B — EAS Cloud Preview APK Build

An `eas.json` profile is configured for generating installable APKs directly in Expo's cloud builder:

```bash
cd apps/mobile
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

---

### Mobile App Screens & Core Features

| Screen / Feature | Capabilities & Implementation |
|---|---|
| **Safety Map** | • Interactive Leaflet + OpenStreetMap engine via WebView (zero external API keys needed)<br>• GPS-based user location tracking with pulsing beacon & "Center on Me" action<br>• Real-time approved incidents from FastAPI/PostGIS<br>• Severity-colored teardrop pins with category icons (Critical, High, Medium, Low)<br>• Tap pin or card to open **Incident Detail Modal** with address, coordinates, and distance from user<br>• Category & severity filter chips + Map/List view toggle |
| **Incident Reporting** | • Select category from 90+ real database categories<br>• 4-tier severity selector (Low, Medium, High, Critical)<br>• Title & multiline description validation<br>• Photo capture via camera or gallery picker (`expo-image-picker`) with preview & remove<br>• Automatic GPS coordinate acquisition with reverse-geocoded address (`expo-location`)<br>• **Review Modal** to confirm all details and photo before sending<br>• Two-stage submission (incident creation + evidence photo upload) with auto-reset |
| **Permissions** | • Minimum permissions required: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`<br>• Graceful permission handling with granted, denied, and fallback states |
| **Authentication** | • JWT authentication with persistent secure token storage<br>• Auto token refresh on 401 Unauthorized |
| **Home & Overview** | • Live city safety score, nearby incident count, quick actions |
| **Notifications** | • In-app safety alerts with unread badge count |
| **Profile** | • View profile, account details, and logout |

---

### Troubleshooting (Mobile)

#### ❌ `ENOENT ... node:sea` on Windows with Node 22+/24
This is a known Expo SDK 50 bug on Windows. The fix is already applied in `node_modules/@expo/cli/build/src/start/server/metro/externals.js`.

If you delete `node_modules` and reinstall, re-apply the fix manually:

Find this block in `externals.js` (~line 19):
```javascript
.filter((x) => !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && ![
```

Change it to:
```javascript
.filter((x) => !/^_|^(internal|v8|node-inspect)\/|\//.test(x) && !x.includes(':') && ![
```

#### ❌ `Network request failed` / Cannot connect to backend
- Make sure the backend is running on port 8000.
- For physical devices: use your LAN IP, not `localhost`.
- For emulators: use `10.0.2.2` (Android loopback to host machine).
- Check Windows Firewall allows inbound traffic on port 8000.

#### ❌ Metro bundler port conflict
```bash
npx expo start --port 8082
```

#### ❌ `@types/react` version warning
```bash
cd apps/mobile
npm install @types/react@~18.2.45 --save-dev
```

---

## 🔑 Default Credentials

| Account | Email | Password |
|---|---|---|
| **Admin** | `admin@safecity.com` | `AdminPass123!` |
| **Demo Citizen** | `aarav.sharma1@safecity.demo` | `CitizenPass123!` |

---

## 📡 API Endpoints

| Tag | Endpoint | Description |
|---|---|---|
| Auth | `POST /api/v1/auth/login` | Login |
| Auth | `POST /api/v1/auth/register` | Register |
| Auth | `POST /api/v1/auth/forgot-password` | Request password reset OTP (Step 1) |
| Auth | `POST /api/v1/auth/verify-reset-otp` | Verify 6-digit OTP (Step 2) |
| Auth | `POST /api/v1/auth/reset-password` | Reset password using token (Step 3) |
| Users | `GET /api/v1/users/me` | My profile |
| Users | `PUT /api/v1/users/me` | Update profile |
| Users | `GET /api/v1/users/me/contacts` | Emergency contacts |
| Incidents | `GET /api/v1/incidents` | List incidents |
| Incidents | `POST /api/v1/incidents` | Create report |
| Incidents | `GET /api/v1/incidents/nearby` | Spatial query |
| Incidents | `GET /api/v1/incidents/heatmap` | Heatmap data |
| Safety | `GET /api/v1/safety/area` | Area safety score |
| Learning | `GET /api/v1/learning/articles` | List articles |
| Learning | `GET /api/v1/learning/categories` | List categories |
| Chatbot | `POST /api/v1/chat/message` | Send query to Gemini safety chatbot |
| Chatbot | `GET /api/v1/chat/suggestions` | Get starter prompts for UI chips |
| Chatbot | `GET /api/v1/chat/status` | Chatbot health & active configuration |
| Alerts | `GET /api/v1/alerts` | Active alerts |
| Notifications | `GET /api/v1/notifications` | User notifications |
| Routes | `GET /api/v1/routes/plan` | Safe route |
| SOS | `POST /api/v1/sos` | Trigger SOS |
| Search | `GET /api/v1/search` | Global search |
| Admin | `GET /api/v1/admin/stats` | Platform stats |
| Admin | `GET /api/v1/admin/incidents` | List & filter all incidents |
| Admin | `PATCH /api/v1/admin/incidents/{id}/status` | Approve / Reject incident |
| Admin | `DELETE /api/v1/admin/incidents/{id}` | Delete incident |
| Admin | `GET /api/v1/admin/users` | List & filter users |
| Admin | `PATCH /api/v1/admin/users/{id}/activate` | Activate user |
| Admin | `PATCH /api/v1/admin/users/{id}/deactivate` | Deactivate user |
| Admin | `PATCH /api/v1/admin/users/{id}/role` | Promote/demote user |

Full interactive docs available at `/docs` (Swagger UI).

---

## 📧 Email & SMTP Setup (Forgot Password OTP)

SafeCity includes a secure email-based One-Time Password (OTP) flow for password recovery. To send actual email OTPs, configure your SMTP server credentials in `apps/backend/.env`.

### Environment Variables

Add the following configuration to `apps/backend/.env`:

```env
# SMTP Server Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587

# SMTP Credentials
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password-here

# Sender Details
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=SafeCity

# OTP Expiry
OTP_EXPIRY_MINUTES=10
```

### Parameter Explanations

| Variable | Description |
|---|---|
| `SMTP_HOST` | Hostname of your SMTP provider (e.g. `smtp.gmail.com`, `smtp.mailgun.org`, `smtp.sendgrid.net`) |
| `SMTP_PORT` | SMTP port number (typically `587` for STARTTLS or `465` for SSL) |
| `SMTP_USERNAME` | Sender email address / login username for the SMTP account from which the OTP email is sent |
| `SMTP_PASSWORD` | SMTP password or provider-specific app password |
| `SMTP_FROM_EMAIL` | Email address displayed in the "From" header to recipients |
| `SMTP_FROM_NAME` | Display name shown as the sender (e.g. `SafeCity`) |
| `OTP_EXPIRY_MINUTES` | Number of minutes before a generated OTP code expires (default: `10`) |

> ⚠️ **Gmail Users Note**: If using Gmail (`smtp.gmail.com`), you **must** generate an **App Password** instead of using your normal account password:
> 1. Go to your Google Account Settings → **Security**
> 2. Enable **2-Step Verification**
> 3. Search for **App Passwords**
> 4. Create a new App Password for "Mail" and use that 16-character code as `SMTP_PASSWORD`.

### Security Practices
- 🔒 **No Hardcoded Credentials**: Credentials are read strictly from environment variables.
- 🔒 **No Plaintext OTP Storage**: OTPs are hashed using `bcrypt` before database storage.
- 🔒 **No Secret Leakage**: Credentials and raw OTP values are never printed in logs or returned in API responses.
- 🔒 **Generic Responses**: `POST /auth/forgot-password` returns a generic response regardless of whether the email is registered to prevent email enumeration.

---

## 🔑 Forgot Password OTP Flow

```
[ User selects "Forgot Password?" ]
               │
               ▼
[ STEP 1: Enter Email ] ──► POST /api/v1/auth/forgot-password
               │            - Generates 6-digit numeric OTP
               │            - Hashes OTP with bcrypt & saves to DB
               │            - Sends email via configured SMTP
               │            - Returns generic "OTP sent if email registered"
               ▼
[ STEP 2: Enter 6-Digit OTP ] ──► POST /api/v1/auth/verify-reset-otp
               │                  - Validates 6-digit code & expiry (5-10 min)
               │                  - Enforces max 5 verification attempts
               │                  - Marks OTP as consumed (one-time use)
               │                  - Returns short-lived signed JWT reset token
               ▼
[ STEP 3: Enter New Password ] ──► POST /api/v1/auth/reset-password
               │                   - Validates new password & confirmation
               │                   - Hashes password using bcrypt
               │                   - Updates user password
               │                   - Invalidates OTP & reset session
               ▼
[ STEP 4: Password Reset Complete ➔ Return to Login ]
```

---

## 🗃️ Database Schema

```
users ──< user_profiles
      ──< incidents ──< incident_images
      ──< notifications
      ──< emergency_contacts
      ──< sos_requests
      ──< password_reset_otps

incident_categories ──< incidents
article_categories  ──< articles
community_alerts
```

All geographic data uses **PostGIS Geography** type (SRID 4326) for accurate spatial queries.

---

## 🔢 Safety Scoring Methodology

SafeCity uses a **deterministic, explainable scoring algorithm** for both Area Safety Scores and Route Safety Scores. All weights are centrally configured in `apps/backend/app/services/safety_score_service.py`.

### Area Safety Score (`GET /api/v1/safety/area`)

Produces a score from **0 (most dangerous) to 100 (safest)** for a circular geographic area.

**Inputs:**
- All non-rejected incidents within the selected radius (PostGIS `ST_DWithin`)

**Per-incident penalty:**
```
penalty = CategorySeverityWeight × ProximityFactor × RecencyFactor × VerificationFactor
```

| Factor | Description |
|---|---|
| **CategorySeverityWeight** | Category-specific base weight per severity (e.g., Critical Crime = 28.0, Critical Illegal Parking = 10.0) |
| **ProximityFactor** | Linear decay from 1.0 (at center) → 0.1 (at radius edge) using PostGIS `ST_Distance` |
| **RecencyFactor** | 0–7 days = 1.5×, 8–30 days = 1.2×, 31–90 days = 0.8×, 90+ days = 0.4× |
| **VerificationFactor** | `APPROVED`/`RESOLVED` = 1.0 (full weight) · `PENDING`/`UNDER_REVIEW` = 0.2 (20% weight) |

**Density adjustment:**
- > 10 incidents/km² → additional -15 points
- > 5 incidents/km² → additional -10 points
- > 2 incidents/km² → additional -5 points

**Final:** `score = max(0, min(100, 100 − Σpenalties − density_penalty))`

Each response includes an `explanation` field summarising the score in plain English.

---

### Route Safety Score (`GET /api/v1/routes/plan`)

Produces a score from **0 to 100** for a specific navigation route.

**Key difference from Area Score:** Only **route-relevant categories** affect the route penalty. Non-route-relevant incidents (e.g., Lost & Found, Water Quality, Missing Device) have their `relevance_mult` set to `0.0` and contribute nothing.

**Route-relevant categories include:**
- Traffic Accidents, Road Hazards, Traffic Violations, Traffic Signal Malfunctions
- Pedestrian Safety, Blocked Footpaths
- Poor Lighting (Streetlight Malfunctions)
- Crime, Theft & Robbery, Assault & Violence, Harassment, Suspicious Activity
- Drainage & Flooding, Gas Leaks, Chemical Spills
- Animal Hazards, Animal Bites, Fallen Trees / Vegetation Hazards
- Construction Hazards, Unsafe Construction Sites, Public Disturbance

**Per-incident penalty:**
```
penalty = CategorySeverityWeight × DistanceFactor × RecencyFactor × VerificationFactor × RelevanceFactor
```

| Factor | Description |
|---|---|
| **DistanceFactor** | Linear decay from 1.0 (on route) → 0.1 (at buffer edge) using PostGIS `ST_Distance` to LineString |
| **RelevanceFactor** | Route-relevant = 1.0 · Non-route-relevant = 0.0 |

Each incident in the route response includes `is_route_relevant`, `is_verified`, `distance_meters`, and `penalty_impact` fields for full transparency.

---

### Avoidance-Buffer Route Filtering

Before the candidate pool is deduplicated and scored, SafeCity applies an **avoidance filter** to eliminate routes that pass through danger areas:

**Qualifying incidents (avoidance triggers)**
- Severity: **HIGH** or **CRITICAL**
- Category: any **route-relevant** category (see list above)
- Verification: **APPROVED** or **RESOLVED** status only

**Avoidance zone:** a **500 m radius** circle around each qualifying incident's GPS coordinates.

**Filter rule:** any candidate route whose OSRM polyline contains a waypoint within 500 m of an avoidance incident is **rejected from the pool**.  If a viable alternative without those zones exists, it will be preferred.

**Fallback behaviour:** if every candidate is filtered out (all routes unavoidably pass through danger zones), the API falls back to the best OSRM-direct route and sets `avoidance_warning: true` in the response so the frontend can display a clear advisory.

**Additional response fields** (top-level, alongside `routes[]`):

| Field | Type | Description |
|---|---|---|
| `avoidance_zone_count` | `int` | Number of HIGH/CRITICAL incidents that created avoidance zones |
| `avoidance_filtered_count` | `int` | Number of candidate routes rejected by the avoidance filter |
| `avoidance_warning` | `bool` | `true` when all candidates were filtered and the fallback was used |

---

## 🩺 Production Health & Availability (Render Keep-Alive)

- **Production Health Endpoint**: `GET /health` (e.g., `https://safecity-backend.onrender.com/health`)
  - Returns HTTP 200 `{"status": "ok"}`.
  - Lightweight and fast: executes without touching the database, calling OSRM, or requiring authentication.
- **External Uptime / Cron Service Configuration**:
  - Render free-tier instances sleep after 15 minutes of inactivity.
  - To prevent sleep mode and cold-start delays during development and live demonstrations, configure an external uptime or cron service (e.g., [UptimeRobot](https://uptimerobot.com), [cron-job.org](https://cron-job.org)) to ping the `/health` endpoint approximately every **10 minutes**.
- Availability Disclaimer:
  - This keep-alive strategy is strictly for development and demo availability and does not guarantee production-grade uptime or SLA.

---

## 🤖 Gemini AI Safety Assistant Setup & Maintenance

SafeCity features a conversational AI assistant integrated directly into the **Learning Hub** on both the **Web Frontend** and **Android Mobile App**, powered by Google's Gemini API (`google-genai` SDK with async REST fallback).

### Key Safety Principles & Anti-Hallucination Guardrails
The chatbot is strictly bounded to personal/community safety, emergency procedures, verified legal frameworks, and SafeCity platform features:
1. **Permitted Scope**:
   - SafeCity platform usage (Emergency SOS, Live Map, Safe Route Planner, Incident Reporting, Safety Scores).
   - Emergency procedures & practical first-aid (CPR, bleeding, choking, fire evacuation, natural disasters).
   - Practical Do's and Don'ts for transit, night travel, rideshare, and home security.
   - Verified legal protections in the **Republic of India** (POSH Act 2013, POCSO Act 2012, IT Act 2000, Good Samaritan Law, IPC/BNS).
   - Safety learning content maintained in the Learning Hub database.
2. **Zero-Cost Pre-Flight Guardrails**:
   - **Prompt Injection & Jailbreak Defense**: Detects and rejects injection attempts ("ignore previous instructions", "DAN", prompt disclosure) immediately with zero Gemini API calls.
   - **Immediate Danger Detection**: When an active emergency is detected ("someone is following me right now", "intruder", "being attacked"), the assistant immediately returns high-priority life-saving guidance to dial **112** and press SafeCity SOS without conversational delay.
   - **Off-Topic Relevance Filtering**: Unrelated queries (coding, trivia, cooking, sports) are rejected with a helpful canned response with zero Gemini API calls.
3. **Prevention of Hallucinations**:
   - Never invents statutes, legal sections, or non-existent penalties.
   - Never invents phone numbers — strictly cites official numbers (112, 100, 101, 108, 1091, 1098, 14567, 1930).
   - Never claims to dispatch police or emergency units.
   - Always clearly identifies the jurisdiction: **Republic of India**.
   - Mandatory disclaimer: *"SafeCity AI is an informational tool and does not replace emergency authorities (112) or legal counsel."*

### Environment Variables
Configure in `apps/backend/.env`:
```env
# Google AI Studio API Key (Backend only - NEVER expose in web/mobile code)
GEMINI_API_KEY=your_gemini_api_key_here

# Configurable Gemini Model (e.g. gemini-1.5-flash, gemini-1.5-pro)
GEMINI_MODEL=gemini-1.5-flash

# Generation Controls
GEMINI_MAX_OUTPUT_TOKENS=800
GEMINI_TEMPERATURE=0.2
GEMINI_TIMEOUT_SECONDS=15.0

# Rate Limiting & Message Protection
CHATBOT_RATE_LIMIT_PER_MINUTE=20
CHATBOT_MAX_MESSAGE_LENGTH=600
```

### Web Chat Widget Features
- **Floating Icon**: Fixed at the bottom-right corner with status badge and pulse glow.
- **Messenger Interface**: Facebook Messenger-style modal with minimize/maximize controls.
- **Interactive Suggestions**: Quick question chips from the Learning Hub.
- **Direct Emergency Shortcut**: Direct 1-tap `tel:112` dialing in the header.
- **Learning Hub Integration**: Direct "Ask SafeCity AI" banner on `/learning` with pre-filled question pills.

### Android Chat Screen Features
- **Dashboard Icon**: Header icon with AI indicator beside the notification bell on Home.
- **Dedicated Full-Screen View**: Uses `SafeScreen` with keyboard-aware scrolling.
- **Theme Support**: Seamlessly matches dark and light mode.
- **Emergency Action**: Quick 1-tap call to 112 directly from top bar.

### Knowledge-Source Maintenance
To update or expand verified safety topics:
1. Update database learning articles using `apps/backend/seed_data.py` or the Admin Learning Hub (`/admin/learning`). The chatbot dynamically searches database articles and incorporates them into prompt context.
2. Static emergency procedures and legal acts are maintained in `apps/backend/app/services/chatbot_knowledge.py`.


