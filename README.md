# SafeCity

SafeCity is a complete, production-ready smart city safety platform designed to help citizens report and track incidents, and for city administrators to manage them effectively.

## Features

- **Authentication**: JWT-based login and registration with Role-Based Access Control (RBAC).
- **Interactive Map**: View all approved incidents in your area, utilizing clustering and Geo-filtering.
- **Incident Reporting**: Form with Map-based location selection, multi-image upload, severity grading, and anonymous reporting option.
- **Admin Dashboard**: Comprehensive moderation tools, incident status management, charts (Recharts), and user administration.
- **Responsive Web UI**: Built with React, TailwindCSS, and shadcn/ui inspired components for a modern, premium look.
- **Robust Backend**: FastAPI backend using SQLAlchemy, PostgreSQL + PostGIS, and Alembic migrations.
- **Dockerized**: Easy setup using Docker Compose to spin up the database, backend, and a production-grade Nginx frontend.

## Architecture

This is a monorepo setup containing:
- `apps/backend/`: FastAPI application, Postgres database connection, migrations.
- `apps/web/`: React + Vite single-page application.
- `apps/mobile/`: Placeholder Expo React Native app.
- `shared/`: TypeScript interfaces/types shared across the monorepo.

## Quick Start (Docker)

The fastest way to run the entire stack is using Docker Compose.

1. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
2. Build and start the containers:
   ```bash
   docker-compose up --build -d
   ```
3. Access the applications:
   - **Frontend (Web)**: [http://localhost:8080](http://localhost:8080)
   - **Backend API**: [http://localhost:8000/api/v1](http://localhost:8000/api/v1)
   - **API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)

*Note: The backend container automatically runs database migrations (`alembic upgrade head`) and seeds the database with initial categories, 25 citizen users, 85 realistic incident reports across categories and statuses, notifications, and an admin user (`admin@safecity.com` / `AdminPass123!`).*

## Database Initialization & Demo Seeding

SafeCity comes with a fully automated, production-ready PostgreSQL + PostGIS database initialization system.

### Option 1: Automated Initialization via Docker (Recommended)
Simply start the stack with Docker Compose:
```bash
docker-compose up --build
```
On container startup, `python -m app.db.init_db` automatically:
1. Enables PostGIS extension (`postgis`).
2. Applies all Alembic schema migrations (`001_initial_schema`).
3. Seeds default incident categories (8).
4. Creates the Administrator account (`admin@safecity.com` / `AdminPass123!`).
5. Populates 25 demo Citizen accounts with user profiles.
6. Inserts 85 realistic incident reports with PostGIS geography coordinates, severities, statuses, timestamps, and evidence images.
7. Generates 45+ user and system notifications.

### Option 2: Manual Local Setup (Without Docker)

#### 1. Start PostgreSQL with PostGIS
Ensure PostgreSQL with PostGIS extension is installed and running on port `5432`:
```sql
CREATE DATABASE safecitydb;
\c safecitydb
CREATE EXTENSION IF NOT EXISTS postgis;
```

#### 2. Configure Environment Variables
Copy `.env.example` to `.env` inside `apps/backend/`:
```bash
cd apps/backend
cp .env.example .env
```
Ensure connection parameters match your PostgreSQL setup:
```ini
DATABASE_URL=postgresql+asyncpg://safecity:safecity_pass@localhost:5432/safecitydb
DATABASE_URL_SYNC=postgresql://safecity:safecity_pass@localhost:5432/safecitydb
```

#### 3. Run Database Initialization & Seeding Script
Execute the single initialization command:
```bash
python -m app.db.init_db
```

Or run steps individually:
- **Run Alembic Migrations**:
  ```bash
  alembic upgrade head
  ```
- **Seed Demo Data**:
  ```bash
  python -m app.db.seed_db
  ```

#### 4. Run Backend & Frontend
- **Backend**:
  ```bash
  uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
  ```
- **Frontend**:
  ```bash
  # From workspace root
  npm run dev:web
  ```

### Default Credentials
- **Admin Account**: `admin@safecity.com` / `AdminPass123!`
- **Demo Citizen User**: `aarav.sharma1@safecity.demo` / `UserPass123!`

