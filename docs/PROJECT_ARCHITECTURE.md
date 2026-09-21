# SafeCity — Project Architecture

## 1. Overview

SafeCity is a **smart city safety platform** that enables citizens to report incidents, view safety maps, plan safe routes, and access safety learning content, while administrators moderate and analyze city-wide safety data.

The project is a **monorepo** containing three applications and one shared package:

| Directory | Technology | Purpose |
|---|---|---|
| `apps/backend` | Python FastAPI + SQLAlchemy 2.0 + PostGIS | REST API, business logic, spatial queries |
| `apps/web` | React 18 + Vite + TypeScript | Web dashboard for citizens & admins |
| `apps/mobile` | React Native + Expo SDK 50 | Android/iOS citizen app |
| `shared` | TypeScript types & constants | Shared types between web & mobile |

## 2. Technology Stack (Verified from implementation)

### Backend (`apps/backend/requirements.txt`)
- **FastAPI 0.111.0** — async REST framework with OpenAPI docs
- **Uvicorn 0.29.0** — ASGI server
- **SQLAlchemy 2.0.30 (asyncio)** — async ORM
- **asyncpg 0.29.0** — async PostgreSQL driver
- **Alembic 1.13.1** — database migrations
- **GeoAlchemy2 0.14.7** — PostGIS integration
- **python-jose 3.3.0** — JWT access/refresh tokens
- **passlib[bcrypt] 1.7.4** — password hashing
- **pydantic 2.7.1 / pydantic-settings** — validation & config
- **httpx 0.27.0** — async HTTP client (OSRM calls)
- **polyline 2.0.2** — route geometry encoding/decoding
- **shapely 2.0.4** — geometry operations (SOS geometry)
- **aiosmtplib 3.0.1** — async SMTP for OTP emails
- **Pillow 10.3.0** — image handling
- **pytest 8.2.0** — testing

### Web Frontend (`apps/web/package.json`)
- **React 18.3.1** + **TypeScript 5.4.5**
- **Vite 5.3.1** — bundler
- **TanStack React Query 5.40** — server state
- **Zustand 4.5.2** — client state
- **React Router 6.23** — routing
- **Leaflet 1.9.4 + react-leaflet 4.2.1** — interactive maps
- **leaflet.markercluster** — marker clustering
- **Recharts 2.12.7** — admin analytics charts
- **Zod 3.23.8 + React Hook Form** — form validation
- **Radix UI** — accessible primitives
- **Tailwind CSS 3.4.4** — styling
- **@mapbox/polyline** — route polyline decoding

### Mobile (`apps/mobile/package.json`)
- **React Native 0.73.6 + Expo SDK 50**
- **React Navigation 6** — stack + bottom tabs
- **TanStack React Query 5.17**
- **Axios 1.6.5** — HTTP client with JWT interceptor
- **Zustand 4.5.0** — auth store
- **expo-location** — GPS
- **expo-secure-store** — encrypted token storage
- **@react-native-async-storage** — persistent storage

### Database (docker-compose.yml)
- **PostgreSQL 15 + PostGIS 3.3** (`postgis/postgis:15-3.3)

## 3. Backend Architecture

### Directory Structure
```
apps/backend/
├── app/
│   ├── main.py                 # FastAPI app entry point
│   ├── api/v1/                 # API routers
│   │   ├── router.py           # Master router
│   │   └── routers/            # auth, users, incidents, admin, etc.
│   ├── core/                   # config, database, deps, security
│   ├── db/                     # init_db, seed_db
│   ├── models/                 # SQLAlchemy ORM models
│   ├── repositories/           # DB access layer
│   ├── schemas/                # Pydantic schemas
│   └── services/               # Business logic
├── migrations/                # Alembic migrations
├── uploads/                    # Uploaded images
├── seed_data.py                # Seed script
├── requirements.txt
└── Dockerfile
```

### Layered Architecture
- **Routers** (`app/api/v1/routers/`) — HTTP endpoints, validation, auth dependencies
- **Services** (`app/services/`) — business logic, orchestration
- **Repositories** (`app/repositories/`) — data access, SQLAlchemy queries
- **Models** (`app/models/`) — ORM models
- **Schemas** (`app/schemas/`) — Pydantic request/response models

### Key Backend Modules
| Module | Files | Purpose |
|---|---|
| Auth | `auth.py`, `auth_service.py`, `password_reset_service.py` | JWT register/login/refresh, OTP password reset |
| Users | `users.py`, `user_repository.py` | Profile, avatar, contacts, change password |
| Incidents | `incidents.py`, `incident_service.py`, `incident_repository.py` | CRUD, nearby, heatmap, images |
| Admin | `admin.py` | Stats, incident moderation, user management, categories, alerts, articles |
| Safety | `safety.py`, `safety_score_service.py` | Area safety score, city overview |
| Routes | `routes.py`, `route_service.py` | OSRM safe route planning |
| SOS | `sos.py`, `emergency_service.py` | SOS trigger/resolve, emergency contacts |
| Alerts | `alerts.py`, `alert_service.py` | Community alerts |
| Learning | `learning.py`, `learning_service.py` | Safety articles |
| Notifications | `notifications.py`, `notification_repository.py` | In-app notifications |
| Search | `search.py` | Global search across incidents & articles |

## 4. Frontend Architecture (Web)

### Routing (App.tsx)
- **Guest routes**: `/login`, `/register`, `/forgot-password`
- **Protected routes** (AppLayout): `/dashboard`, `/map`, `/route-plan`, `/incidents`, `/incidents/new`, `/incidents/my`, `/incidents/:id`, `/profile`, `/learning`, `/alerts`, `/notifications`
- **Admin routes** (AdminLayout): `/admin`, `/admin/incidents`, `/admin/users`, `/admin/categories`, `/admin/learning`
- **404**: `*`

### State Management
- **Zustand** stores: `store/auth.ts` (auth state), `store/filters.ts` (incident filters)
- **React Query** hooks for server state: `api/*.ts`

### API Layer
- `lib/api.ts` — Axios instance with JWT interceptor & refresh logic
- `api/*.ts` — typed hooks per module

## 5. Mobile Architecture

### Navigation
- `AppNavigator.tsx` — splash + auth check
- `AuthNavigator.tsx` — login/register
- `MainTabNavigator.tsx` — Home, Map, Report, Notifications, Profile

### Screens
- Home (safety score, quick actions, alerts, nearby incidents)
- Map (nearby incidents list, city stats, filters)
- Report (create incident)
- Notifications
- Profile

### API Layer
- `api/client.ts` — Axios with JWT interceptor, refresh queue
- `api/*.ts` — typed API calls

## 6. External Services

| Service | Usage | Where |
|---|---|
| **OSRM (Open Source Routing Machine)** | Route planning via `http://router.project-osrm.org/route/v1/driving` | `route_service.py` |
| **PostGIS** | Spatial queries (ST_DWithin, Geography) | `safety_score_service.py`, `incident_repository.py` |
| **SMTP** | OTP email for password reset | `email_service.py` |
| **OpenStreetMap tiles** | Map tiles in Leaflet | Web frontend `IncidentMap.tsx` |

## 7. Security Mechanisms

- **JWT** access tokens (HS256) with `type=access` / `type=refresh` claims (`core/security.py`)
- **bcrypt** password hashing with 72-byte truncation
- **RBAC** — `get_current_user` / `get_current_admin` dependencies (`core/deps.py`)
- **OTP** — bcrypt-hashed 6-digit OTP, max 5 attempts, 60s cooldown, generic responses to prevent enumeration
- **CORS** — configurable allowed origins
- **File uploads** — extension & size validation (5MB avatar, 10MB incident images)
- **Soft delete** — incidents use `deleted_at` instead of hard delete

## 8. Configuration (Variable Names Only)

- `DATABASE_URL`, `DATABASE_URL_SYNC`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`, `BACKEND_CORS_ORIGINS`, `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `OTP_EXPIRY_MINUTES`, `DEBUG`, `APP_NAME`, `APP_VERSION`

## 9. Deployment (docker-compose.yml)

- **db**: postgis/postgis:15-3.3 on port 5433
- **backend**: FastAPI on port 8000, runs `init_db` then uvicorn
- **web**: nginx serving built frontend on port 8080
- Volumes: `postgres_data`, `uploads_data`