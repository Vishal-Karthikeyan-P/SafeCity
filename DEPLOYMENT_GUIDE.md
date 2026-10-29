# SafeCity — Complete Step-by-Step Production Hosting Guide

A complete, production-grade walkthrough to host the **SafeCity** platform online using the specified services and free/free-tier allowances.

---

## 1. Architecture & Platform Overview

| Component | Target Service | Tier / Allowance | Details |
| :--- | :--- | :--- | :--- |
| **Code Repository** | **GitHub** | Free | Source control, issue tracker, release downloads |
| **Database** | **Supabase** | Free Tier (500 MB) | PostgreSQL 15 + PostGIS 3.3 spatial engine |
| **Backend API** | **Render** | Free Web Service (512 MB) | FastAPI, asyncpg, JWT auth, routing endpoints |
| **OSRM Engine** | **AWS EC2** | AWS Free Tier (`t2.micro` / `t3.micro`) | Open Source Routing Machine HTTP routing daemon |
| **OSM Data** | **EC2 EBS Root Disk** | 30 GB gp3 Free Allowance | Pre-processed state road network graph (**Tamil Nadu**) |
| **Frontend Web** | **Vercel** | Free Hobby Plan | React 18 + Vite + Leaflet mapping web application |
| **Mobile Testing** | **GitHub Releases** | Free | Direct distribution of release Android APK binaries |

---

## 2. Tamil Nadu vs. India OSRM Feasibility on AWS EC2 Free Tier

| Factor | **India Entire Country** (`india-latest.osm.pbf`) | **Tamil Nadu State** (`tamil-nadu-latest.osm.pbf`) | Verdict |
| :--- | :--- | :--- | :--- |
| **Raw PBF Download** | ~1.4 GB – 1.8 GB | **~75 MB – 110 MB** | Tamil Nadu is fast & lightweight |
| **Extracted Road Graph** | ~8 GB – 12 GB | **~450 MB – 800 MB** | Fits comfortably in 25–30 GB disk |
| **RAM Required to Extract**| **16 GB – 32 GB RAM** | **1.2 GB – 1.8 GB RAM** | India **crashes** with OOM on 1 GB EC2 |
| **RAM Required to Run** | **8 GB – 14 GB RAM** | **~400 MB – 650 MB RAM** | **Tamil Nadu runs comfortably on `t2.micro`** |

> 💡 **Recommendation & Decision:**
> **Tamil Nadu** (`tamil-nadu-latest.osm.pbf`) fits the AWS Free Tier `t2.micro` / `t3.micro` (1 GB RAM + 3 GB swap) and serves all Chennai, Coimbatore, Madurai, Trichy, Salem, and state routes.
>
> *(The entire India map requires an AWS `r5.xlarge` or `c5.2xlarge` with 16 GB–32 GB RAM costing $100+/month. For countrywide coverage within free tier, pre-processing must be completed locally on a PC with 32 GB RAM and uploaded, but serving it still exceeds 1 GB RAM. Therefore, **Tamil Nadu is selected**).*

---

## 3. Step 1: Code Repository Setup (GitHub)

1. Check your local Git status in the project root:
   ```bash
   git status
   ```
2. Stage and commit all changes (including backend configurations):
   ```bash
   git add .
   git commit -m "chore: configure SafeCity for production deployment"
   ```
3. Create a repository on [GitHub](https://github.com/new) named `safecity`.
4. Link and push to GitHub:
   ```bash
   git remote add origin https://github.com/<your-username>/safecity.git
   git branch -M main
   git push -u origin main
   ```

---

## 4. Step 2: PostgreSQL + PostGIS Setup (Supabase)

SafeCity requires PostgreSQL with the PostGIS extension enabled (`ST_DWithin`, `ST_Distance`). Supabase provides this free out of the box.

### 4.1 Create Supabase Project
1. Log in to [Supabase](https://supabase.com).
2. Click **New Project**:
   - **Name**: `safecity-db`
   - **Database Name**: Default is `postgres`
   - **Database Password**: Set a strong password (e.g. `SafeCityProd_2026_Secure!#` — **record this!**)
   - **Region**: Choose closest to your users / EC2 (e.g., `AWS ap-south-1 Mumbai` or `ap-southeast-1 Singapore`).
   - **Pricing Plan**: Free Tier ($0/month)
3. Click **Create new project** and wait 1–2 minutes for provisioning.

### 4.2 Enable the PostGIS Spatial Extension
1. In the Supabase dashboard sidebar, click **SQL Editor**.
2. Click **New Query** and execute:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Click **Run**. Verify the output displays `Success. No rows returned`.
4. Run verification query:
   ```sql
   SELECT postgis_full_version();
   ```
   You will see PostGIS 3.3/3.4 details confirmed.

### 4.3 Copy Complete Connection Strings

In Supabase, go to **Project Settings** > **Database** > **Connection string**.

#### Connection Details Reference Table:
| Parameter | Value |
| :--- | :--- |
| **Host** | `db.<PROJECT-REF>.supabase.co` |
| **Database name** | `postgres` |
| **Port (Direct / Session)** | `5432` |
| **Port (Supavisor Pooler)**| `6543` |
| **User** | `postgres` |
| **Password** | `<YOUR-SUPABASE-DB-PASSWORD>` (e.g. `SafeCityProd_2026_Secure!#`) |

#### Exact Formatted URLs for SafeCity Backend:
- **Async URL (FastAPI `DATABASE_URL`):**
  ```text
  postgresql+asyncpg://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
  ```
- **Sync URL (Alembic `DATABASE_URL_SYNC`):**
  ```text
  postgresql://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
  ```

> ⚠️ **Note on Special Characters:** If your password contains special characters (`@`, `:`, `#`, `%`), URL-encode them (e.g., `#` becomes `%23`, `@` becomes `%40`), or use an alphanumeric password like `SafeCityProd2026SecurePass`.

---

### 4.4 Exactly Which Files to Change & Where to Put the Supabase URLs

SafeCity's backend architecture uses `pydantic-settings` ([apps/backend/app/core/config.py](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/core/config.py)), which automatically reads environment variables first, and falls back to a `.env` file if present.

Depending on whether you are running in **Production on Render** or **Testing Locally / Docker**, here are the exact files and locations:

#### Location A: Production Deployment (Render Web Service) — No File Edits Committed to Git
In cloud production, you **do not hardcode credentials in source code files**. Instead, you inject them via the Render Dashboard:
1. Open [Render Dashboard](https://dashboard.render.com) > **`safecity-backend`** > **Environment**.
2. Add / Edit the two variables:
   - **`DATABASE_URL`**:
     ```text
     postgresql+asyncpg://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
     ```
   - **`DATABASE_URL_SYNC`**:
     ```text
     postgresql://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
     ```
3. When Render runs `python -m app.db.init_db`, `apps/backend/migrations/env.py` and `apps/backend/app/core/database.py` will read these two variables from the environment automatically.

---

#### Location B: Local Development / Testing against Supabase — File: `apps/backend/.env`
If you want your local backend instance or local migrations to run directly against Supabase:

1. Copy or edit `apps/backend/.env` (create it from `apps/backend/.env.example` if it doesn't exist):
   ```bash
   # In apps/backend/.env
   DATABASE_URL=postgresql+asyncpg://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
   DATABASE_URL_SYNC=postgresql://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
   ```
2. Verify in `apps/backend/alembic.ini`:
   - You **do not** need to change line 5 (`sqlalchemy.url = ...`) in `alembic.ini` because `apps/backend/migrations/env.py` lines 27–30 dynamically override `sqlalchemy.url` with `settings.sync_database_url`.

---

#### Location C: Root Project Environment — File: `.env` (Project Root)
If you run scripts from the project root:
1. In the repository root `.env` file:
   ```env
   # Replace lines 7-10 with:
   DATABASE_URL=postgresql+asyncpg://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
   DATABASE_URL_SYNC=postgresql://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=SafeCityProd_2026_Secure!#
   POSTGRES_DB=postgres
   ```

---

#### Location D: Docker Compose (Optional Local Staging Container) — File: `docker-compose.yml`
If you run the backend inside Docker Compose locally but want it connected to Supabase instead of the local PostgreSQL container:
- In `docker-compose.yml` under `backend:` -> `environment:`:
  ```yaml
  environment:
    ENVIRONMENT: production
    DATABASE_URL: postgresql+asyncpg://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
    DATABASE_URL_SYNC: postgresql://postgres:SafeCityProd_2026_Secure!#@db.<PROJECT-REF>.supabase.co:5432/postgres
  ```
  *(You can also stop the local `db:` container since Supabase is hosting the database).*

---

### 4.5 Summary Checklist of Files Touched for Database Configuration
| File / Location | What to Put / Edit | Why |
| :--- | :--- | :--- |
| **Render Dashboard** (`Environment` tab) | `DATABASE_URL` & `DATABASE_URL_SYNC` | Production runtime for FastAPI & Alembic migrations |
| [`apps/backend/.env`](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/.env) | `DATABASE_URL=...` & `DATABASE_URL_SYNC=...` | Local backend execution (`uvicorn app.main:app`) pointing to Supabase |
| [`.env`](file:///d:/MCA/Mini%20Project/Safe%20City/.env) *(root)* | `DATABASE_URL=...` & `DATABASE_URL_SYNC=...` | Root helper scripts & seeders |
| [`docker-compose.yml`](file:///d:/MCA/Mini%20Project/Safe%20City/docker-compose.yml) | Update lines 43–44 with Supabase URL | Only if running Dockerized backend against Supabase |
| [`apps/backend/app/core/config.py`](file:///d:/MCA/Mini%20Project/Safe%20City/apps/backend/app/core/config.py) | *Already configured* | Automatically translates `postgresql://` to `postgresql+asyncpg://` |

---

## 5. Step 3: OSRM Routing Engine on AWS EC2 (Tamil Nadu Map)

We provide two approaches for setting up OSRM:
- **Method A: Direct on EC2 using Docker** (Standard & self-contained on the cloud instance).
- **Method B: Local Build on your Computer + Upload to EC2** (Fastest extraction if you want zero compilation on the server).

---

### 5.1 Launch EC2 Instance
1. Go to [AWS EC2 Management Console](https://console.aws.amazon.com/ec2).
2. Click **Launch Instance**:
   - **Name**: `safecity-osrm-tamilnadu`
   - **AMI**: Ubuntu Server 22.04 LTS (HVM), SSD Volume Type (64-bit x86)
   - **Instance Type**: `t2.micro` or `t3.micro` (Free Tier eligible: 750 hrs/month)
   - **Key Pair**: Select an existing key or create a new `.pem` (e.g., `safecity-key.pem`)
   - **Storage (EBS)**: Set size to **25 GiB** (gp3) *(AWS Free Tier allows up to 30 GB EBS)*
   - **Network Settings / Security Group**:
     - Allow **SSH** (port 22) from your IP
     - Allow **Custom TCP** on port `5000` from `0.0.0.0/0` (Anywhere)
3. Click **Launch Instance**.
4. In the Instances table, note your **Public IPv4 Address** (e.g. `13.233.150.80`).

---

### 5.2 Method A: Cloud Docker Build Directly on EC2

SSH into your EC2 server:
```bash
ssh -i /path/to/safecity-key.pem ubuntu@<EC2-PUBLIC-IP>
```

#### Step A1: Install Docker & Tools
```bash
sudo apt update && sudo apt install -y docker.io curl wget
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
newgrp docker
```

#### Step A2: Configure 3 GB Swap (Crucial for 1 GB RAM)
```bash
sudo fallocate -l 3G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

#### Step A3: Download Tamil Nadu OSM Map Data
```bash
mkdir -p ~/osrm-data && cd ~/osrm-data

# Download official Geofabrik Tamil Nadu PBF extract (~80 MB)
wget https://download.geofabrik.de/asia/india/tamil-nadu-latest.osm.pbf -O tamil-nadu-latest.osm.pbf
```

#### Step A4: Process Road Graph with OSRM Docker
```bash
# 1. Extract the road network using the car driving profile
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-extract -p /opt/car.lua /data/tamil-nadu-latest.osm.pbf

# 2. Partition the graph into multi-level cells (MLD algorithm)
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-partition /data/tamil-nadu-latest.osrm

# 3. Customize cell weights
docker run -t -v "${PWD}:/data" ghcr.io/project-osrm/osrm-backend \
  osrm-customize /data/tamil-nadu-latest.osrm
```

#### Step A5: Start OSRM as a Background Daemon
```bash
docker run -d \
  --name osrm-routed \
  --restart always \
  -p 5000:5000 \
  -v "${PWD}:/data" \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/tamil-nadu-latest.osrm
```

---

### 5.3 Method B: Local Machine Build + EC2 Upload

If you prefer building the graph locally on your Windows/Mac/Linux workstation with multiple CPU cores and uploading the ready-to-run `.osrm*` files:

#### Step B1: Run Extraction on Local Machine (Docker)
In your local command prompt or PowerShell:
```powershell
mkdir C:\osrm-local
cd C:\osrm-local

# Download Tamil Nadu PBF
curl -o tamil-nadu-latest.osm.pbf https://download.geofabrik.de/asia/india/tamil-nadu-latest.osm.pbf

# Extract, partition, and customize using local Docker Desktop:
docker run -t -v ${PWD}:/data ghcr.io/project-osrm/osrm-backend osrm-extract -p /opt/car.lua /data/tamil-nadu-latest.osm.pbf
docker run -t -v ${PWD}:/data ghcr.io/project-osrm/osrm-backend osrm-partition /data/tamil-nadu-latest.osrm
docker run -t -v ${PWD}:/data ghcr.io/project-osrm/osrm-backend osrm-customize /data/tamil-nadu-latest.osrm
```

#### Step B2: Upload Processed Files to EC2 via SCP
```powershell
scp -i C:\path\to\safecity-key.pem tamil-nadu-latest.osrm* ubuntu@<EC2-PUBLIC-IP>:~/osrm-data/
```

#### Step B3: Start Container on EC2
On EC2:
```bash
docker run -d \
  --name osrm-routed \
  --restart always \
  -p 5000:5000 \
  -v /home/ubuntu/osrm-data:/data \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/tamil-nadu-latest.osrm
```

---

### 5.4 Test the OSRM Service
Test from your local computer terminal using sample Chennai coordinates:
```bash
curl "http://<EC2-PUBLIC-IP>:5000/route/v1/driving/80.2707,13.0827;80.2500,13.0400?overview=false"
```
Expected response:
```json
{"code":"Ok","routes":[{"geometry":"...","weight_name":"routability","weight":...,"duration":...,"distance":...}],"waypoints":[...]}
```

> **Your Live OSRM Base URL:**
> `http://<EC2-PUBLIC-IP>:5000/route/v1/driving`

---

## 6. Step 4: Deploy FastAPI Backend on Render

### 6.1 Create Render Web Service
1. Log in to [Render](https://dashboard.render.com).
2. Click **New +** > **Web Service**.
3. Link your GitHub account and select the `safecity` repository.
4. Fill in the build & runtime settings:
   - **Name**: `safecity-backend`
   - **Region**: Choose the closest region (e.g., `Singapore` or `Frankfurt`)
   - **Branch**: `main`
   - **Root Directory**: `apps/backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt
     ```
   - **Start Command**:
     ```bash
     python -m app.db.init_db && uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: `Free`

### 6.2 Set Production Environment Variables on Render
Click on the **Environment** tab and add the following keys and values:

| Key | Value / Example | Note |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql+asyncpg://postgres:YourPass@db.<REF>.supabase.co:5432/postgres` | Asyncpg connection for FastAPI |
| `DATABASE_URL_SYNC` | `postgresql://postgres:YourPass@db.<REF>.supabase.co:5432/postgres` | Sync connection for Alembic migrations |
| `SECRET_KEY` | `9b7f8c2e1a3d4f5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9` | Generate a 64-char random hex string |
| `ALGORITHM` | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token life |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token life |
| `OSRM_BASE_URL` | `http://<EC2-PUBLIC-IP>:5000/route/v1/driving` | Your EC2 OSRM instance endpoint |
| `BACKEND_CORS_ORIGINS` | `["https://safecity-web.vercel.app","http://localhost:5173"]` | Front-end URLs |
| `UPLOAD_DIR` | `uploads` | Image upload directory |
| `SMTP_HOST` | *(Optional, e.g. `smtp.gmail.com`)* | If using OTP emails |
| `SMTP_PORT` | `587` | TLS port |
| `SMTP_USERNAME` | *(Optional sender email)* | Your email |
| `SMTP_PASSWORD` | *(Optional app password)* | Gmail App Password (16 chars) |
| `GEMINI_API_KEY` | `AIzaSy...` | Google AI Studio Gemini API Key for chatbot (Backend only!) |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Configurable Gemini model identifier |
| `GEMINI_MAX_OUTPUT_TOKENS` | `800` | Token limit per chat response |
| `GEMINI_TEMPERATURE` | `0.2` | Low temperature for grounded safety facts |
| `GEMINI_TIMEOUT_SECONDS` | `15.0` | API call timeout |
| `CHATBOT_RATE_LIMIT_PER_MINUTE` | `20` | In-memory sliding window rate limit |
| `CHATBOT_MAX_MESSAGE_LENGTH` | `600` | Max character length per user question |
| `SEVERITY_AI_ENABLED` | `true` | Enable/disable AI severity classification |
| `SEVERITY_AI_PREVIEW` | `true` | Set `false` to run AI only on submit (saves free quota) |
| `SEVERITY_AI_PROVIDER` | `openai_compat` | Provider for Severity AI |
| `SEVERITY_AI_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta/openai` | Google Gemini OpenAI compat endpoint |
| `SEVERITY_AI_MODEL` | `gemini-1.5-flash` | Gemini model for severity engine |
| `SEVERITY_AI_API_KEY` | `AIzaSy...` | Dedicated Gemini key for severity engine (optional, falls back to rules if empty) |

5. Click **Deploy Web Service**.
6. Render will download requirements, run `init_db` (which executes PostGIS verification, Alembic migrations, and seeds initial data), and start Uvicorn.
7. Copy your assigned Render URL: `https://safecity-backend.onrender.com`.

---

## 7. Step 5: Deploy Frontend on Vercel

### 7.1 Verify Vercel SPA Configuration
Make sure `apps/web/vercel.json` exists in your repository to route HTML5 history requests:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 7.2 Import Project to Vercel
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your `safecity` GitHub repository.
4. Set the build parameters:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `apps/web` (Click edit and select `apps/web`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
5. Under **Environment Variables**, add:

| Key | Value | Purpose |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | `https://safecity-backend.onrender.com` | Live Render backend URL (no trailing slash) |
| `VITE_MAP_TILE_URL` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` | OSM tile server |
| `VITE_DEFAULT_LAT` | `13.0827` | Default center latitude (Chennai) |
| `VITE_DEFAULT_LNG` | `80.2707` | Default center longitude (Chennai) |
| `VITE_DEFAULT_ZOOM` | `12` | Default map zoom level |

6. Click **Deploy**.
7. Once deployed, copy your Vercel URL (e.g., `https://safecity-web.vercel.app`).
8. Return to **Render** > `safecity-backend` > **Environment** and make sure `BACKEND_CORS_ORIGINS` contains your exact Vercel URL:
   ```json
   ["https://safecity-web.vercel.app", "http://localhost:5173"]
   ```

---

## 8. Step 6: Android APK Build (EAS & Local Gradle) & GitHub Releases

For mobile app testing without Play Store fees, generate a standalone `.apk` binary.

### 8.1 Configure Mobile API Endpoint
In `apps/mobile/.env`:
```env
EXPO_PUBLIC_API_BASE_URL=https://safecity-backend.onrender.com
EXPO_PUBLIC_DEFAULT_LAT=13.0827
EXPO_PUBLIC_DEFAULT_LNG=80.2707
```

---

### 8.2 Build Option A: Cloud Build via EAS (Recommended)
1. Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```
2. In `apps/mobile`, log in to Expo:
   ```bash
   cd apps/mobile
   eas login
   ```
3. Initialize / verify `apps/mobile/eas.json`:
   ```json
   {
     "cli": {
       "version": ">= 7.0.0"
     },
     "build": {
       "preview": {
         "distribution": "internal",
         "android": {
           "buildType": "apk"
         },
         "env": {
           "EXPO_PUBLIC_API_BASE_URL": "https://safecity-backend.onrender.com"
         }
       }
     }
   }
   ```
4. Trigger the APK build on Expo's build servers:
   ```bash
   eas build -p android --profile preview
   ```
5. When finished, a download link for `safecity-mobile.apk` will be output in the console.

---

### 8.3 Build Option B: Local Android Build (Gradle)

If you have Android Studio and Android SDK configured locally:

1. Generate the native Android project folder:
   ```bash
   cd apps/mobile
   npx expo prebuild --platform android
   ```
2. Build the release APK with Gradle:
   - On Windows:
     ```powershell
     cd android
     .\gradlew assembleRelease
     ```
   - On Linux/Mac:
     ```bash
     cd android
     ./gradlew assembleRelease
     ```
3. Your compiled `.apk` will be generated at:
   ```text
   apps/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```

---

### 8.4 Distribute via GitHub Releases
1. Go to your GitHub repository: `https://github.com/<your-username>/safecity`.
2. In the right sidebar, click **Releases** > **Draft a new release**.
3. Enter release information:
   - **Tag**: `v1.0.0`
   - **Target**: `main`
   - **Release Title**: `SafeCity v1.0.0 — Production Android APK`
   - **Description**:
     ```markdown
     ### SafeCity Mobile v1.0.0 (Release APK)
     - Production Android release build connecting to Render backend and Supabase PostGIS.
     - Download `safecity-v1.0.0.apk` below and install directly on Android.
     ```
4. Drag and drop the `app-release.apk` (renamed to `safecity-v1.0.0.apk`) into the binary upload box.
5. Click **Publish release**.
6. Anyone on your team can download and install this APK directly on Android by enabling "Install Unknown Apps".

---

## 9. Complete Verification & Testing Flow

1. **Supabase Verification:**
   - Run in Supabase SQL editor: `SELECT count(*) FROM incidents;`
   - Ensure demo incident points are present.
2. **EC2 OSRM Verification:**
   - Run: `curl "http://<EC2-PUBLIC-IP>:5000/route/v1/driving/80.2707,13.0827;80.2500,13.0400"`
   - Ensure routes and polyline are returned.
3. **Render API Verification:**
   - Open: `https://safecity-backend.onrender.com/health` (Returns `{"status": "ok"}`).
   - Open: `https://safecity-backend.onrender.com/docs` (Swagger UI).
4. **Vercel Web Verification:**
   - Open: `https://safecity-web.vercel.app`
   - Log in with default seed credentials (`admin@safecity.io` / `admin123` or create a new user).
   - Go to **Safe Route Planner**: select Start and Destination within Tamil Nadu (e.g. Chennai Central to Guindy) — verify the multi-route safety score calculation executes without errors.
5. **Mobile Verification:**
   - Download the APK from GitHub Releases onto an Android device.
   - Log in, record an incident with GPS location, and confirm that the pin shows up on the Vercel web map in real time.


---

## 10. App Icons & Branding Assets

The SafeCity shield icon (navy background, glowing blue location pin, radar rings, city skyline) has been generated and wired into both apps.

### Generated Files

| File | Location | Purpose |
|------|----------|---------|
| `icon.png` | `apps/web/public/icon.png` | Web favicon (PNG fallback) + PWA icon |
| `favicon.svg` | `apps/web/public/favicon.svg` | Vector favicon (primary � shown in browser tabs) |
| `manifest.json` | `apps/web/public/manifest.json` | PWA web manifest (Add to Home Screen) |
| `og-image.jpg` | `apps/web/public/og-image.jpg` | Open Graph / Twitter Card social preview |
| `icon.png` | `apps/mobile/assets/icon.png` | iOS & Android launcher icon (1024�1024) |
| `adaptive-icon.png` | `apps/mobile/assets/adaptive-icon.png` | Android adaptive icon foreground layer |
| `splash.png` | `apps/mobile/assets/splash.png` | App loading/splash screen |

---

### 10.1 Web � Vercel Icon Deployment

The icons are served as **static files** from the `public/` folder. Vite copies everything in `public/` to the build output automatically.

**No extra configuration is needed.** After `npm run build` (or Vercel auto-build on push), the following URLs will work:

```text
https://<your-vercel-domain>/favicon.svg       ? browser tab icon
https://<your-vercel-domain>/icon.png           ? PWA / apple-touch-icon
https://<your-vercel-domain>/manifest.json      ? PWA manifest
https://<your-vercel-domain>/og-image.jpg       ? social share preview
```

**Verify on Vercel:**

1. Push to `main` � Vercel auto-deploys.
2. Open your deployed URL in a browser ? check the tab shows the SafeCity shield icon.
3. Share the URL on WhatsApp / Telegram ? the `og-image.jpg` splash card should appear.
4. On a mobile browser ? tap the share menu ? **Add to Home Screen** ? the app icon appears on the home screen.

> [!TIP]
> To get a proper 32�32 `.ico` file for maximum browser compatibility, convert `icon.png` at [favicon.io](https://favicon.io/favicon-converter/) and drop the generated `favicon.ico` into `apps/web/public/`. Then add `<link rel="icon" href="/favicon.ico" sizes="any" />` **above** the SVG link in `index.html`.

---

### 10.2 Mobile � EAS Build / Local Build Icon Wiring

The icon paths are already set in `apps/mobile/app.json`:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      }
    }
  }
}
```

#### Option A � EAS Cloud Build (Recommended)

EAS Build reads `app.json` and automatically processes icons into all required sizes (mipmap-hdpi, mipmap-xhdpi, etc.) during the cloud build.

```bash
cd apps/mobile

# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in with your Expo account
eas login

# Option 1: Build standalone installable APK directly (uses "buildType": "apk" in eas.json)
eas build -p android --profile preview

# Option 2: Build Google Play Store release bundle (AAB)
eas build -p android --profile production
```

The resulting `.apk` / `.aab` will display the SafeCity shield logo on the launcher and in the app drawer.

#### Option B � Local Prebuild + Gradle

```bash
cd apps/mobile

# Generate native Android project (processes icons)
npx expo prebuild --platform android --clean

# Build release APK
cd android
.\gradlew assembleRelease       # Windows PowerShell
# ./gradlew assembleRelease     # Linux / Mac

# Output:
# android/app/build/outputs/apk/release/app-release.apk
```

After prebuild, you can verify the icons were generated:

```bash
# Should see icon files in all density buckets
ls android/app/src/main/res/mipmap-*
```

#### Option C � Expo Go (Development Preview)

For quick testing without a full build, icon changes are reflected instantly in **Expo Go** when you run:

```bash
cd apps/mobile
npx expo start
```

Scan the QR code in Expo Go � the splash screen will show the SafeCity branding.

---

### 10.3 Replacing Icons in the Future

To update the icon at any time:

1. Replace the image files in `apps/mobile/assets/` and `apps/web/public/`.
2. For **web**: push to GitHub ? Vercel redeploys automatically (CDN cache clears in ~1 minute).
3. For **mobile**: rebuild via EAS or Gradle � icons are baked into the APK/AAB at build time.

**Required icon dimensions:**

| Asset | Min Size | Notes |
|-------|----------|-------|
| `icon.png` | 1024�1024 px | Used for all mobile sizes + PWA. Must be square. |
| `adaptive-icon.png` | 1024�1024 px | Android 8+ foreground layer. Safe zone: center 50%. |
| `splash.png` | 1284�2778 px | Tall aspect for modern phones. Subject centered. |
| Web favicon SVG | Vector | No size limit � scales perfectly at any resolution. |
| `og-image.jpg` | 1200�630 px | Facebook/Twitter/WhatsApp link preview card. |

> [!IMPORTANT]
> For the **Android adaptive icon**, keep the shield graphic within the **center 72dp (�66%)** of the 1024px canvas. Android clips the corners into a circle/rounded-square shape depending on the device launcher.

---

### 10.4 Browser Tab & Taskbar Verification Checklist

After deploying to Vercel, confirm:

- [ ] Chrome desktop tab shows the shield icon (not a generic globe)
- [ ] Firefox address bar shows the icon
- [ ] iOS Safari "Add to Home Screen" shows the shield icon
- [ ] Android Chrome "Add to Home Screen" shows the adaptive icon
- [ ] Sharing the URL on WhatsApp/Telegram shows the `og-image.jpg` splash card
- [ ] Google Search result (after indexing) shows the favicon next to the URL
