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

*Note: The backend container automatically runs database migrations and seeds the database with initial categories and an admin user (`admin@safecity.com` / `admin123`).*

## Local Development (Without Docker)

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL + PostGIS extension

### 1. Database Setup
Ensure PostgreSQL is running and create the database with PostGIS:
```sql
CREATE DATABASE safecitydb;
\c safecitydb
CREATE EXTENSION postgis;
```

### 2. Backend Setup
```bash
cd apps/backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --reload
```

### 3. Frontend Setup
From the monorepo root:
```bash
npm install
npm run dev:web
```
Access the frontend at `http://localhost:5173`.
