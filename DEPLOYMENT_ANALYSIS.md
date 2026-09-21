# SafeCity — Hosting/Deployment Analysis

Evidence-based analysis of how to host this project online. Written from inspection of the
repository (config files, Dockerfiles, Docker Compose, source, docs) — nothing was modified,
installed, or deployed.

---

## 1. Project summary — what it is and how it runs

**What it is:** A full-stack "smart city safety platform" monorepo with three apps plus shared
code:

| Component | Tech (verified) | Evidence |
|---|---|---|
| Backend API | FastAPI 0.111, Uvicorn 0.29, SQLAlchemy 2 async, Alembic, JWT | `apps/backend/requirements.txt`, `app/main.py` |
| Database | PostgreSQL 15 + PostGIS 3.3 | `docker-compose.yml` (`postgis/postgis:15-3.3`) |
| Web frontend | React 18 + Vite 5 + TypeScript 5, served by Nginx | `docker/web/Dockerfile`, `apps/web/package.json` |
| Mobile app | React Native 0.73.6 + Expo SDK 50 (Android) | `apps/mobile/package.json` |
| Shared types | TypeScript workspace | root `package.json` workspaces |

**How it runs today (Docker Compose, one host):**
- `docker-compose.yml` defines 3 services: `db`, `backend`, `web`, plus named volumes
  `postgres_data` and `uploads_data`.
- **Backend** runs `command: sh -c "python -m app.db.init_db && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"`.
  `init_db` enables PostGIS, runs Alembic migrations (`upgrade head`), and seeds demo data
  (`app/db/init_db.py`).
- **Web** builds the React app statically and serves it via Nginx (`FROM nginx:alpine`).
- Ports: `db` 5433 (host)/5432 (container), `backend` 8000, `web` 80 (host 8080).
- Non-Docker path (local dev, per README): `uvicorn app.main:app`, `alembic upgrade head`,
  `python seed_data.py`.

**Key characteristics that dictate hosting:**
- **Requires PostgreSQL with the PostGIS extension** (geo types, `ST_DWithin`/`ST_Distance`
  queries, `CREATE EXTENSION postgis`). This filters out most free/managed DB tiers.
- **Uploads and avatars are written to the local filesystem** (`UPLOAD_DIR=uploads`) and served
  as static files by FastAPI (mount `/uploads`). Incident images `/uploads/...` are referenced
  by relative path, so they must live on the same persistent disk as the backend.
- **No background workers, no task queue, no cron jobs** (no Celery/Redis found; docs confirm).
- **External, non-secret services:** OSRM public routing API (`http://router.project-osrm.org`,
  fixed URL in `route_service.py`, no key) and OpenStreetMap tile servers (browser-side).
- **Email (SMTP) is optional:** `email_service.py` only sends if `SMTP_HOST` + user are set;
  otherwise it logs a warning. Used by the Forgot-Password OTP flow.

**Run/build commands (from config):**
- Build: `docker compose up --build -d` (or `npm run build:web` for frontend only).
- Backend start: `uvicorn app.main:app --host 0.0.0.0 --port 8000` (preceded by init_db).
- DB init/migrate/seed: `python -m app.db.init_db`.
- Migration URL override: `migrations/env.py` reads `settings.sync_database_url`
  (from `DATABASE_URL_SYNC` or `DATABASE_URL`) — the hardcoded URL in `alembic.ini` is ignored.
---

## 2. Hosting recommendation — simplest practical option

**Recommendation: One small Linux VPS running Docker Compose (unchanged cluster).**

Why this is the simplest, most faithful option:
- The repo already ships a production-shaped `docker-compose.yml` (`restart: always`,
  healthchecks, named, persistent volumes) — deploying it on a single host is the least work
  and lowest risk.
- Uploads-on-disk + PostGIS both "just work" on a single dockerized host with the existing
  named volumes. Managed/vanilla PaaS backends either lack PostGIS or require re-architecting
  file storage to S3/object storage, which this code does not do.
- The whole stack (DB + API + frontend behind Nginx) lives on one machine, matching the
  project's own documented deployment architecture (`docs/DIAGRAMS.md` §15).

Concrete provider suggestions (~same class, pick one):
- **Hetzner Cloud** (CPX21, 2 vCPU / 4 GB) — best $/perf, ~€4.85/mo.
- **DigitalOcean** droplet (2 GB) — ~$12/mo, easiest UI.
- **Linode / Vultr** — equivalent small VPS.

> The existing `docker-compose.yml` is close to deployment-ready; see §6 and §7 for the
> specific changes required (CORS origin + build-time API URL). Do **not** deploy the Docker
> backend image standalone without adding a `python -m app.db.init_db` first-run step, because
> the image `CMD` is only `uvicorn` (init/migrate/seed is currently injected by Compose's
> `command:`).

---

## 3. Deployment steps (exact, in order)

### A. One-time project config changes (see §6 for edits)
1. Update CORS origin in `docker-compose.yml` backend `ALLOWED_ORIGINS` to your public domain.
2. Update `VITE_API_BASE_URL` in `docker/web/Dockerfile` (currently hardcoded to
   `http://localhost:8000`) to your public API origin.
3. Set real secrets in your server's `.env` (`SECRET_KEY`, `POSTGRES_PASSWORD`).

### B. Server provisioning + deploy (VPS, target: Ubuntu 22.04/24.04 LTS)
```bash
# 1. Provision VPS (Hetzner/DigitalOcean/Linode), SSH in as root/your-user.

# 2. Install Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo systemctl enable --now docker

# 3. (Optional but recommended) TLS / reverse proxy
#    Use Caddy or Nginx on the host, OR Traefik as a 4th Compose service, for automatic
#    Let's Encrypt TLS. (No TLS config exists in the repo.)

# 4. Get the code onto the server
git clone https://github.com/Vishal-Karthikeyan-P/SafeCity.git /opt/safecity
cd /opt/safecity

# 5. Create production .env (see §5 for variables)
nano .env

# 6. Build and start the whole stack
sudo docker compose up -d --build

# 7. Verify
curl http://localhost:8000/health                       # backend
curl -I http://localhost:8080/                           # web
sudo docker compose logs -f backend                      # watch init_db + uvicorn
```

### C. Optional data reseed after iteration
```bash
sudo docker compose exec backend python seed_data.py
```

> Note: the mobile app is an Android/Expo application — it is **not** "hosted". It is built to
> an Android executable or distributed via Expo/EAS/Android store; it is unrelated to web
> hosting and requires no server work beyond the shared API.
---

## 4. Environment variables / secrets

Sources: `.env.example` (root), `apps/backend/.env.example`, `app/core/config.py`,
`docker-compose.yml`. Env files are read by `pydantic-settings` (`Config.env_file = ".env"`)
and by Compose substitutions.

| Variable | Required in prod | Notes / where it comes from |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Yes | DB credentials; referenced by Compose and build the API URLs. Change password from defaults. |
| `DATABASE_URL` | Yes (via Compose build) | `postgresql+asyncpg://user:pass@db:5432/db` (async, app). |
| `DATABASE_URL_SYNC` | For CLI/Alembic | `postgresql://...` (sync). If unset, derived from `DATABASE_URL`. |
| `SECRET_KEY` | Yes | JWT signing secret. **Must change** from the committed dev default. Generate: `python -c "import secrets; print(secrets.token_urlsafe(64))"`. |
| `BACKEND_CORS_ORIGINS` | Yes | JSON array or comma list; must include your public web origin. |
| `ALLOWED_ORIGINS` (Compose backend env) | Yes | CORS origin used by the Compose service (currently hardcoded localhost — change it). |
| `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS` | Tune | `HS256`, 30–60 min, 7 days. |
| `UPLOAD_DIR`, `MAX_UPLOAD_SIZE_MB` | Defaults OK | `uploads`, `10`. |
| `VITE_API_BASE_URL` (build-time) | Yes | Public backend base URL baked into the web build (`import.meta.env`). **Currently `http://localhost:8000` — must change.** |
| `VITE_MAP_TILE_URL`, `VITE_DEFAULT_*` | Defaults OK | OSM tile URL, default map center. |
| `EXPO_PUBLIC_API_BASE_URL` (+ map defaults) | Mobile only | For the mobile app build; not used by web hosting. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`, `OTP_EXPIRY_MINUTES` | Optional | Needed for working Forgot-Password OTP emails. Without them, the flow degrades gracefully (logs a warning, email not sent). Gmail app password example in `.env.example`. |
| `APP_NAME`, `APP_VERSION`, `DEBUG` | Defaults OK | App metadata; keep `DEBUG=False`. |

**Where secrets live:** in a server-side `.env` (never commit). Do not push the existing
`.env`/`apps/backend/.env` (they currently contain the default dev secret/password).

---

## 5. External services

| Service | Role | Managed/hosted? | Secrets/keys |
|---|---|---|---|
| PostgreSQL + PostGIS | Primary DB | Self-hosted in Compose (`db` service) | DB credentials |
| OSRM public routing API | Route planning (`route_service.py`, fixed URL, alternatives API) | External SaaS, no account/API key | — (rate-limit risk) |
| OpenStreetMap tile servers | Map tiles in Leaflet (browser-side) | External, public | — |
| SMTP server (Gmail, etc.) | Forgot-password OTP emails | External | `SMTP_USERNAME`/`SMTP_PASSWORD` |

No Redis, queue, object storage, or third-party secrets currently required.
---

## 6. Files to change (exact, before/for deployment)

**Verified — already configured correctly (no change needed):**
- `apps/backend/Dockerfile` — multi-stage build, correct deps (`libpq-dev`), `EXPOSE 8000`.
- `docker/web/Dockerfile` — builds React (with `npm ci` using workspace lockfile) → Nginx.
- `docker/nginx/nginx.conf` — serves React SPA with SPA fallback (`try_files` → `index.html`).
- `apps/backend/migrations/env.py` — reads DB URL from env (`settings.sync_database_url`), so
  the hardcoded `alembic.ini` URL is overridden at runtime; PostGIS tables ignored correctly.
- `docker-compose.yml` — service topology, healthchecks, persistent volumes, restart policy.
- `app/core/config.py` — env-driven settings with sane defaults + legacy aliases.

**Verified — must change for production:**

| File | Change | Why |
|---|---|---|
| `docker/web/Dockerfile` (line 24) | Change `ENV VITE_API_BASE_URL=http://localhost:8000` to your **public** API base URL (e.g. `https://api.yourdomain.com`). | Without this the built frontend calls `localhost:8000` in users' browsers → broken. (This is the single biggest deployment blocker.) |
| `docker-compose.yml` (backend `ALLOWED_ORIGINS`, line 46) | Replace hardcoded localhost origins with your production web origin (`https://yourdomain.com`). | Backend would otherwise reject CORS from your deployed frontend. |
| `docker-compose.yml` (backend `ENVIRONMENT`) | Set `ENVIRONMENT: production` (currently `development`) and drop `--reload` from the start command for thoroughness. | Not strictly a blocker, but avoid dev reloading in prod. |
| Root `.env` (+ your `SECRET_KEY`/`POSTGRES_PASSWORD`) | Replace the committed default `SECRET_KEY` and DB password with generated secrets. | Committed secrets are a security risk; JWT + DB login. |

**Deployment gap to note (add, if deploying backend standalone instead of via Compose):**
- The backend Dockerfile `CMD` is only `uvicorn`; migration+seed only run because Compose's
  `command:` prepends `python -m app.db.init_db`. On a PaaS, add a first-run
  `python -m app.db.init_db` step or a release-phase command.

---

## 7. Estimated cost (VPS path, reasonable)

| Item | ~Monthly | Notes |
|---|---|---|
| VPS (Hetzner CPX21 / DO 2 GB) | $5–12 | 2–4 GB RAM comfortably runs PostGIS + FastAPI + Nginx |
| Domain | ~$1/mo (≈$12–15/yr) | e.g. `.com` via Namecheap/Cloudflare |
| TLS (Let's Encrypt or Caddy auto) | $0 | Built-in |
| **Total** | **~$6–13/mo (+ one-time domain)** | |

Compare: Railway (~$5–15/mo) or AWS RDS with PostGIS (~$15–30/mo) are pricier and/or need
file-storage rework. The VPS path is cheapest and requires the least change.
---

## 8. Blockers / risks (anything that prevents deployment)

1. **PostGIS requirement** — the DB host must support the PostGIS extension. This rules out
   several free/managed Postgres tiers (some Neon/AWS/Render plans need the extension enabled
   or allowed; vanilla SQLite/local dev DBs won't work). Keep the Compose `postgis` image or
   use a PostGIS-supporting provider.
2. **Local-filesystem uploads** — `UPLOAD_DIR` is a plain directory on the backend host served
   by FastAPI. Only works on a single persistent instance/volume. Serverless or multi-replica
   backends would lose uploaded incident images/avatars unless object storage is introduced
   (not present in code).
3. **Hardcoded frontend API URL** — `docker/web/Dockerfile` bakes `VITE_API_BASE_URL` at build
   time. If not set to the public origin, the deployed UI cannot reach the API.
4. **Hardcoded CORS origin** — backend `ALLOWED_ORIGINS` in Compose still lists localhost only;
   browsers will block API calls from any other origin.
5. **Committed default secret** — `SECRET_KEY` and DB password defaults are committed; must be
   rotated before any public deployment.
6. **The `.gitignore` is minimal** (`node_modules`) — `apps/backend/.env` and root `.env` are
   committed and contain the default dev secret. Ensure production secrets are injected via
   environment/secret-management and never committed.
7. **Docker port mapping** — `db` maps to host `5433` and services run on `8000`/`8080`; a
   cloud firewall must be configured so only `80`/`443` (and SSH) are public. Do not expose
   `5433` or `8000` to the internet.
8. **Two-step startup ordering** — backend depends on DB health, which Compose handles, but if
   you split services across a PaaS you must sequence DB-ready → migrate → seed → serve.
9. **OSRM public API reliability** — routing depends on a free, unauthenticated public API
   (rate-limited / can be down). Acceptable for a demo; a self-hosted OSRM instance or a keyed
   routing provider is a robustness upgrade, not a blocker.

---

## 9. Alternative hosting options (only if materially useful)

- **Railway** — supports Docker/importer and has PostGIS-capable options; convenient CI from
  GitHub, but the uploads-on-disk model needs a persistent volume and you must re-add the
  `init_db` first-run step. Viable if you prefer a PaaS over a raw VPS; slightly pricier.
- **Render** — great free-tier-friendly PaaS, but its managed Postgres lacks first-class
  PostGIS by default and it does not run a full `docker-compose` stack. You would split into
  three web services + a PostGIS-supporting DB provider (e.g., Aiven, Supabase) and handle
  file storage — more work than the VPS path.
- **AWS (ECS/EC2 or DigitalOcean App Platform)** — workable but over-provisioned here; hybrid
  CloudFormation is more moving parts for no benefit at this scale.
- **API / Mobile-only** — if only the API + DB are needed (mobile app talks to the API),
  you could drop the Nginx `web` service entirely and expose only `:8000`. Not recommended for
  a public web UI.

---

*Prepared from repository inspection — no files in the project were modified, packages
installed, migrations run, or anything deployed (this analysis document is the sole new file).*
