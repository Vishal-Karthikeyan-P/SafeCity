from logging.config import fileConfig
import os
import sys

import sqlalchemy as sa
from sqlalchemy import pool, engine_from_config

from alembic import context

# Add app to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
from app.core.database import Base

# Import models so Alembic sees them
from app.models.user import User
from app.models.incident import IncidentCategory, Incident, IncidentImage
from app.models.notification import Notification


# Alembic Config object
config = context.config


# Use synchronous database URL for Alembic
config.set_main_option(
    "sqlalchemy.url",
    settings.sync_database_url
)


# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


# Metadata for autogenerate
target_metadata = Base.metadata


def include_object(object, name, type_, reflected, compare_to):
    """
    Ignore PostGIS internal tables.
    """
    if type_ == "table" and name in [
        "spatial_ref_sys",
        "geography_columns",
        "geometry_columns",
        "layer",
        "topology",
    ]:
        return False

    return True


def run_migrations_offline() -> None:
    """
    Run migrations without DB connection.
    """

    url = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={
            "paramstyle": "named"
        },
        include_object=include_object,
        version_table="alembic_version",
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    """
    Execute migrations with explicit search_path set on the connection.
    Uses execution_options to ensure the SET search_path persists through
    Alembic's internal transaction management.
    """
    # Set search_path via execution_options so it persists in all sub-queries
    # including Alembic's own alembic_version table lookup.
    connection = connection.execution_options(
        schema_translate_map=None,
    )
    connection.execute(sa.text("SET search_path TO public"))

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        include_object=include_object,
        version_table="alembic_version",
        # Do NOT specify version_table_schema — let it use the current search_path
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """
    Run migrations with sync engine.
    """

    configuration = config.get_section(
        config.config_ini_section
    )

    configuration["sqlalchemy.url"] = settings.sync_database_url

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)
        # SQLAlchemy 2.x uses autobegin — the SET search_path call opens an implicit
        # transaction that wraps the whole migration. We must commit it explicitly,
        # otherwise the connection close rolls it all back.
        connection.commit()

    connectable.dispose()



if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()