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
| 🚨 **Community Alerts** | Real-time active safety alerts (high risk areas, emergency notices, system announcements) |
| 🆘 **SOS & Emergency** | SOS trigger with GPS coordinates, emergency contact management (up to 5 contacts) |
| 📊 **Admin Dashboard** | Full analytics (Recharts), moderation tools, user management, content management (Articles & Alerts) |
| 🔔 **Notifications** | In-app notifications for incident status updates, real-time badge counts |

---

## 🏗️ Architecture

This is a **monorepo** setup:

```
Safe City/
├── apps/
│   ├── backend/          # FastAPI + SQLAlchemy + PostGIS (Python)
│   └── web/              # React + Vite + TypeScript (Frontend)
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
```

### 4. Frontend Setup
```bash
cd apps/web
npm install
npm run dev
```

---

## 🔑 Default Credentials

| Account | Email | Password |
|---|---|---|
| **Admin** | `admin@safecity.com` | `AdminPass123!` |
| **Demo User** | `aarav.sharma1@safecity.demo` | `UserPass123!` |

---

## 📡 API Endpoints

| Tag | Endpoint | Description |
|---|---|---|
| Auth | `POST /api/v1/auth/login` | Login |
| Auth | `POST /api/v1/auth/register` | Register |
| Incidents | `GET /api/v1/incidents` | List incidents |
| Incidents | `POST /api/v1/incidents` | Create report |
| Incidents | `GET /api/v1/incidents/nearby` | Spatial query |
| Incidents | `GET /api/v1/incidents/heatmap` | Heatmap data |
| Learning | `GET /api/v1/learning/articles` | List articles |
| Learning | `GET /api/v1/learning/categories` | List categories |
| Alerts | `GET /api/v1/alerts` | Active alerts |
| Routes | `GET /api/v1/routes/plan` | Safe route |
| SOS | `POST /api/v1/sos` | Trigger SOS |
| Users | `GET /api/v1/users/me` | My profile |
| Users | `GET /api/v1/users/me/contacts` | Emergency contacts |
| Search | `GET /api/v1/search` | Global search |
| Admin | `GET /api/v1/admin/stats` | Platform stats |

Full interactive docs available at `/docs` (Swagger UI).

---

## 🗃️ Database Schema

```
users ──< user_profiles
      ──< incidents ──< incident_images
      ──< notifications
      ──< emergency_contacts
      ──< sos_requests

incident_categories ──< incidents
article_categories  ──< articles
community_alerts
```

All geographic data uses **PostGIS Geography** type (SRID 4326) for accurate spatial queries.
