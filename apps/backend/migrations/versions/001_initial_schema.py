"""Initial schema with users, categories, incidents, images, notifications

Revision ID: 001_initial_schema
Revises: 
Create Date: 2026-07-27 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    print(">>> RUNNING INITIAL SCHEMA MIGRATION <<<")

    conn = op.get_bind()

    result = conn.execute(sa.text("SELECT current_database(), current_user, current_schema()"))
    print(result.fetchone())

    # Use raw SQL for the entire schema creation.
    # This is more reliable than op.create_table() with complex types (Geography, Enums)
    # because it avoids SQLAlchemy/geoalchemy2 DDL event listener conflicts with
    # Alembic's transactional DDL wrapper on PostgreSQL.

    conn.execute(sa.text("""
        CREATE TYPE userrole AS ENUM ('CITIZEN', 'ADMIN')
    """))

    conn.execute(sa.text("""
        CREATE TYPE severitylevel AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    """))

    conn.execute(sa.text("""
        CREATE TYPE incidentstatus AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RESOLVED')
    """))

    conn.execute(sa.text("""
        CREATE TYPE notificationtype AS ENUM ('INCIDENT_UPDATE', 'SYSTEM', 'ALERT', 'ADMIN_MESSAGE')
    """))

    # 1. users
    conn.execute(sa.text("""
        CREATE TABLE users (
            id          VARCHAR(36)  NOT NULL,
            email       VARCHAR(255) NOT NULL,
            full_name   VARCHAR(255) NOT NULL,
            hashed_password VARCHAR(255) NOT NULL,
            role        userrole     NOT NULL,
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            is_verified BOOLEAN      NOT NULL DEFAULT false,
            created_at  TIMESTAMPTZ  NOT NULL,
            updated_at  TIMESTAMPTZ  NOT NULL,
            CONSTRAINT pk_users PRIMARY KEY (id),
            CONSTRAINT uq_users_email UNIQUE (email)
        )
    """))
    conn.execute(sa.text("CREATE UNIQUE INDEX ix_users_email ON users (email)"))
    conn.execute(sa.text("CREATE INDEX ix_users_role ON users (role)"))
    conn.execute(sa.text("CREATE INDEX ix_users_created_at ON users (created_at)"))
    print("  [OK] users")

    # 2. user_profiles
    conn.execute(sa.text("""
        CREATE TABLE user_profiles (
            id                      VARCHAR(36)  NOT NULL,
            user_id                 VARCHAR(36)  NOT NULL,
            avatar_url              VARCHAR(512),
            phone                   VARCHAR(50),
            bio                     TEXT,
            emergency_contact_name  VARCHAR(255),
            emergency_contact_phone VARCHAR(50),
            city                    VARCHAR(100),
            country                 VARCHAR(100),
            created_at              TIMESTAMPTZ  NOT NULL,
            updated_at              TIMESTAMPTZ  NOT NULL,
            CONSTRAINT pk_user_profiles PRIMARY KEY (id),
            CONSTRAINT uq_user_profiles_user_id UNIQUE (user_id),
            CONSTRAINT fk_user_profiles_user_id_users
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """))
    print("  [OK] user_profiles")

    # 3. incident_categories
    conn.execute(sa.text("""
        CREATE TABLE incident_categories (
            id          VARCHAR(36)  NOT NULL,
            name        VARCHAR(100) NOT NULL,
            slug        VARCHAR(100) NOT NULL,
            description TEXT,
            icon        VARCHAR(10)  NOT NULL DEFAULT '📋',
            color       VARCHAR(20)  NOT NULL DEFAULT '#6B7280',
            is_active   BOOLEAN      NOT NULL DEFAULT true,
            created_at  TIMESTAMPTZ  NOT NULL,
            CONSTRAINT pk_incident_categories PRIMARY KEY (id),
            CONSTRAINT uq_incident_categories_name UNIQUE (name),
            CONSTRAINT uq_incident_categories_slug UNIQUE (slug)
        )
    """))
    conn.execute(sa.text("CREATE UNIQUE INDEX ix_incident_categories_slug ON incident_categories (slug)"))
    print("  [OK] incident_categories")

    # 4. incidents (with PostGIS geography column)
    conn.execute(sa.text("""
        CREATE TABLE incidents (
            id               VARCHAR(36)  NOT NULL,
            title            VARCHAR(255) NOT NULL,
            description      TEXT         NOT NULL,
            category_id      VARCHAR(36)  NOT NULL,
            severity         severitylevel NOT NULL,
            status           incidentstatus NOT NULL,
            is_anonymous     BOOLEAN      NOT NULL DEFAULT false,
            location_address VARCHAR(512),
            location_lat     DOUBLE PRECISION NOT NULL,
            location_lng     DOUBLE PRECISION NOT NULL,
            location_geom    geography(POINT, 4326),
            admin_note       TEXT,
            reporter_id      VARCHAR(36),
            deleted_at       TIMESTAMPTZ,
            created_at       TIMESTAMPTZ  NOT NULL,
            updated_at       TIMESTAMPTZ  NOT NULL,
            CONSTRAINT pk_incidents PRIMARY KEY (id),
            CONSTRAINT fk_incidents_category_id_incident_categories
                FOREIGN KEY (category_id) REFERENCES incident_categories(id) ON DELETE RESTRICT,
            CONSTRAINT fk_incidents_reporter_id_users
                FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_incidents_category_id ON incidents (category_id)"))
    conn.execute(sa.text("CREATE INDEX ix_incidents_reporter_id ON incidents (reporter_id)"))
    conn.execute(sa.text("CREATE INDEX ix_incidents_severity ON incidents (severity)"))
    conn.execute(sa.text("CREATE INDEX ix_incidents_status ON incidents (status)"))
    conn.execute(sa.text("CREATE INDEX ix_incidents_created_at ON incidents (created_at)"))
    conn.execute(sa.text("CREATE INDEX ix_incidents_status_created ON incidents (status, created_at)"))
    conn.execute(sa.text("CREATE INDEX ix_incidents_cat_status ON incidents (category_id, status)"))
    print("  [OK] incidents")

    # 5. incident_images
    conn.execute(sa.text("""
        CREATE TABLE incident_images (
            id          VARCHAR(36)  NOT NULL,
            incident_id VARCHAR(36)  NOT NULL,
            filename    VARCHAR(255) NOT NULL,
            url         VARCHAR(512) NOT NULL,
            created_at  TIMESTAMPTZ  NOT NULL,
            CONSTRAINT pk_incident_images PRIMARY KEY (id),
            CONSTRAINT fk_incident_images_incident_id_incidents
                FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_incident_images_incident_id ON incident_images (incident_id)"))
    print("  [OK] incident_images")

    # 6. notifications
    conn.execute(sa.text("""
        CREATE TABLE notifications (
            id          VARCHAR(36)    NOT NULL,
            user_id     VARCHAR(36)    NOT NULL,
            type        notificationtype NOT NULL,
            title       VARCHAR(255)   NOT NULL,
            message     TEXT           NOT NULL,
            is_read     BOOLEAN        NOT NULL DEFAULT false,
            incident_id VARCHAR(36),
            created_at  TIMESTAMPTZ    NOT NULL,
            CONSTRAINT pk_notifications PRIMARY KEY (id),
            CONSTRAINT fk_notifications_user_id_users
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_notifications_incident_id_incidents
                FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE SET NULL
        )
    """))
    conn.execute(sa.text("CREATE INDEX ix_notifications_user_id ON notifications (user_id)"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_incident_id ON notifications (incident_id)"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_is_read ON notifications (is_read)"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_created_at ON notifications (created_at)"))
    conn.execute(sa.text("CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at)"))
    print("  [OK] notifications")

    print(">>> INITIAL SCHEMA MIGRATION COMPLETE <<<")


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS notifications CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS incident_images CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS incidents CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS incident_categories CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS user_profiles CASCADE"))
    conn.execute(sa.text("DROP TABLE IF EXISTS users CASCADE"))
    conn.execute(sa.text("DROP TYPE IF EXISTS notificationtype"))
    conn.execute(sa.text("DROP TYPE IF EXISTS incidentstatus"))
    conn.execute(sa.text("DROP TYPE IF EXISTS severitylevel"))
    conn.execute(sa.text("DROP TYPE IF EXISTS userrole"))
