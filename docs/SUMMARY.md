# SafeCity — Documentation Summary

## 1. Technologies Actually Detected

| Layer | Technology | Verified From |
|---|---|---|
| Backend | FastAPI 0.111.0, Uvicorn, SQLAlchemy 2.0 (async), asyncpg, Alembic, GeoAlchemy2 | `apps/backend/requirements.txt` |
| Auth | python-jose (JWT HS256), passlib/bcrypt | `app/core/security.py` |
| Database | PostgreSQL 15 + PostGIS 3.3 | `docker-compose.yml` |
| Web | React 18, Vite, TypeScript, TanStack Query, Zustand, Leaflet, Recharts, Tailwind | `apps/web/package.json` |
| Mobile | React Native 0.73, Expo SDK 50, React Navigation, Axios, Zustand, expo-secure-store | `apps/mobile/package.json` |
| External | OSRM public API, SMTP (aiosmtplib), OpenStreetMap tiles | `route_service.py`, `email_service.py` |
| Deployment | Docker Compose (db, backend, web/nginx) | `docker-compose.yml` |

## 2. Major Modules

- **Authentication** — register, login, refresh, OTP password reset
- **Users** — profile, avatar, change password, emergency contacts
- **Incidents** — CRUD, nearby (PostGIS), heatmap, images, my incidents
- **Safety** — area score, city overview
- **Routes** — OSRM safe route planning
- **SOS** — trigger/resolve
- **Alerts** — community alerts
- **Learning** — articles & categories
- **Notifications** — in-app notifications
- **Search** — global search
- **Admin** — stats, moderation, user/category/alert/article management

## 3. Major Workflows

- **Citizen**: Register/Login → Dashboard → Map → Report → Route Plan → SOS → Learning → Alerts → Notifications → Profile
- **Admin**: Login → Dashboard → Incident moderation → User management → Category/Alert/Article management
- **System**: Frontend → API → Services → Repositories → PostGIS / OSRM / SMTP → Response → Visualization

## 4. Database Tables (12)

1. `users`
2. `user_profiles`
3. `incident_categories`
4. `incidents` (with PostGIS geography point)
5. `incident_images`
6. `notifications`
7. `article_categories`
8. `articles`
9. `community_alerts` (with PostGIS geography point)
10. `emergency_contacts`
11. `sos_requests` (with PostGIS geography point)
12. `password_reset_otps`

## 5. Safe Routing Algorithm

- **Engine**: OSRM public API (`router.project-osrm.org`)
- **Candidates**: direct routes (with alternatives) + alternative via perpendicular offset midpoint
- **Distance**: Haversine sum over decoded polyline
- **Safety**: PostGIS ST_DWithin (200m buffer) → severity-weighted penalty (15/10/5/2)
- **Selection**: shortest = min distance; safest = max score (tie-break: shorter)
- **Fallback**: hardcoded polylines if OSRM fails

## 6. Area Safety Algorithm

- **Query**: PostGIS ST_DWithin on approved incidents within radius
- **Score**: 100 − Σ(severity_weight × recency_multiplier) − density_penalty
- **Weights**: LOW=2, MEDIUM=5, HIGH=10, CRITICAL=15
- **Recency**: 7d=1.5x, 30d=1.2x, older=1x
- **Density**: >5/km² = −10, >2/km² = −5
- **Risk**: ≥75 safe, 40–74 moderate, <40 unsafe

## 7. ML Components

**None implemented.** No ML libraries in requirements.txt, no model files, no training code. Safety scoring is purely rule-based.

## 8. External Services

- **OSRM** — route planning (public instance)
- **SMTP** — OTP emails for password reset
- **OpenStreetMap tiles** — map rendering in Leaflet

## 9. Important Diagrams Created

All in `docs/DIAGRAMS.md`:
1. Complete Application Flow
2. Simplified Presentation Flow
3. System Architecture
4. Citizen/User Workflow
5. Administrator Workflow
6. Safe Routing Algorithm Flow
7. Area Safety Index Flow
8. Database ER Diagram
9. Data Flow Diagram
10. Authentication Flow (sequence)
11. Incident Reporting (sequence)
12. Safe Routing (sequence)
13. SOS (sequence)
14. Component Diagram
15. Deployment Architecture

## 10. Important Discrepancies Found

| Claim | Reality |
|---|---|
| README implies ML/AI features | **No ML code exists** — rule-based scoring only |
| "Real-time" alerts | No WebSocket/SSE — REST polling via React Query |
| Safe route "avoids risk zones" | Alternative is a simple midpoint offset, not risk-aware routing |
| Admin stats `new_users_this_month` | Hardcoded to 0 in `admin.py` |
| Mobile "Map" screen | Shows a **list** of nearby incidents, not an actual map |
| Mobile incident location | Uses hardcoded default coordinates, not live GPS |
| pytest in requirements | No test files found in repository |
| SOS audio/video recording URLs | Columns exist in schema but no upload endpoint implemented |

## 11. Missing / Uncertain Information

- **No audit log table** — admin actions are not systematically logged
- **No background job queue** — no Celery/Redis
- **No geocoding service** — addresses are free-text, not geocoded
- **No tests** — pytest is a dependency but no test files exist
- **No CI/CD configuration** found
- **Mobile live GPS** — `expo-location` is a dependency but reporting uses static coordinates
- **Evidence recording** — schema columns exist (`audio_recording_url`, `video_recording_url`) but no upload functionality

## 12. Documentation Files Created

```
docs/
├── PROJECT_ARCHITECTURE.md   — Tech stack, backend/frontend/mobile architecture
├── DATABASE_SCHEMA.md        — 12 tables, columns, indexes, ER diagram
├── ALGORITHMS.md             — Safe routing + area safety algorithms, reality check
├── WORKFLOWS.md              — Citizen/admin/system flows, sequence diagrams
├── API_REFERENCE.md          — All endpoints grouped by module
├── DIAGRAMS.md               — 15 Mermaid diagrams
├── PRESENTATION_NOTES.md     — Viva Q&A, limitations, enhancements
└── SUMMARY.md                — This file
```

## 13. Source Files Inspected

**Backend (30+ files)**:
- `app/main.py`, `app/core/{config,database,deps,security}.py`
- `app/models/{user,incident,alert,emergency,learning,notification,password_reset}.py`
- `app/services/{auth,incident,route,safety_score,emergency,alert,learning,email,password_reset}_service.py`
- `app/repositories/{user,incident,emergency,alert,learning}.py`
- `app/schemas/{auth,user,incident,alert,emergency}.py`
- `app/api/v1/routers/{auth,users,incidents,admin,safety,routes,sos,alerts,learning,notifications,search}.py`
- `migrations/versions/{001_initial_schema,cd468bd26fdd,003_add_password_reset_otp}.py`
- `app/db/seed_db.py`, `requirements.txt`, `docker-compose.yml`

**Web (20+ files)**:
- `src/App.tsx`, `src/lib/api.ts`, `src/types/index.ts`
- `src/api/{auth,incidents,routes,safety}.ts`
- `src/pages/{Dashboard,Map,RoutePlan}Page.tsx`

**Mobile (10+ files)**:
- `src/config/env.ts`, `src/api/{client,auth,incidents,safety}.ts`
- `src/navigation/{AppNavigator,MainTabNavigator}.tsx`
- `src/screens/{home/Home,map/Map,report/Report}Screen.tsx`

**Shared**:
- `shared/src/types/index.ts`

**Config**:
- `package.json`, `docker-compose.yml`, `README.md`