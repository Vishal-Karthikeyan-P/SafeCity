"""
007 - Location-based & broadcast community alerts and user location tracking
Adds:
- users: last_location_lat, last_location_lng, last_location_geom, location_updated_at
- community_alerts: target_scope ('all_users' | 'location_based')
"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography

revision = '007_location_alerts'
down_revision = '006_contact_requests'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add user location tracking columns for location-based alert targeting
    op.add_column('users', sa.Column('last_location_lat', sa.Float, nullable=True))
    op.add_column('users', sa.Column('last_location_lng', sa.Float, nullable=True))
    op.add_column('users', sa.Column(
        'last_location_geom',
        Geography(geometry_type='POINT', srid=4326, from_text='ST_GeogFromText', name='geography'),
        nullable=True
    ))
    op.add_column('users', sa.Column('location_updated_at', sa.DateTime(timezone=True), nullable=True))
    op.create_index('ix_users_last_location_geom', 'users', ['last_location_geom'], postgresql_using='gist')

    # 2. Add target_scope to community_alerts ('all_users' vs 'location_based')
    op.add_column('community_alerts', sa.Column(
        'target_scope', sa.String(30), nullable=False, server_default='all_users'
    ))
    op.create_index('ix_community_alerts_target_scope', 'community_alerts', ['target_scope'])

    print("Migration 007: user location tracking columns and alert target_scope created.")


def downgrade():
    op.drop_index('ix_community_alerts_target_scope', 'community_alerts')
    op.drop_column('community_alerts', 'target_scope')
    op.drop_index('ix_users_last_location_geom', 'users')
    op.drop_column('users', 'location_updated_at')
    op.drop_column('users', 'last_location_geom')
    op.drop_column('users', 'last_location_lng')
    op.drop_column('users', 'last_location_lat')
