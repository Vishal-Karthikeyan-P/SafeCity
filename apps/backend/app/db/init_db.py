"""
Database Initialization Script for SafeCity
Runs migrations and populates initial/demo data.
"""
import asyncio
import logging
import os
import subprocess
import sys
from sqlalchemy import text

from app.core.database import engine, AsyncSessionLocal
from app.db.seed_db import seed_database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def init_postgis_extension():
    """Ensure PostGIS spatial extensions are enabled."""
    logger.info("Verifying PostGIS extensions...")
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis;"))
    logger.info("PostGIS extensions verified.")


def run_alembic_migrations():
    """Execute Alembic migrations to upgrade database to head revision."""
    logger.info("Running Alembic database migrations...")
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    try:
        res = subprocess.run(
            [sys.executable, "-m", "alembic", "upgrade", "head"],
            cwd=backend_dir,
            check=True,
            capture_output=True,
            text=True
        )
        logger.info(f"Alembic Output:\n{res.stdout}")
    except subprocess.CalledProcessError as err:
        logger.error(f"Alembic migration failed:\n{err.stderr}")
        raise err


async def main():
    logger.info("=== Starting SafeCity Database Initialization ===")
    
    # 1. Enable PostGIS
    try:
        await init_postgis_extension()
    except Exception as e:
        logger.warning(f"Could not initialize PostGIS extension directly (will be handled during migration): {e}")

    # 2. Run Migrations
    run_alembic_migrations()

    # 3. Seed Database
    async with AsyncSessionLocal() as session:
        await seed_database(session)

    logger.info("=== SafeCity Database Initialization Complete ===")


if __name__ == "__main__":
    asyncio.run(main())
