"""Add status workflow, resolution requests, and incident status history

Revision ID: 004_status_workflow
Revises: 003_add_password_reset_otp
Create Date: 2026-10-02 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_status_workflow'
down_revision: Union[str, None] = '003_add_password_reset_otp'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add RESOLVED_UNVERIFIED to incidentstatus enum if not present
    enum_check = conn.execute(sa.text(
        "SELECT 1 FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
        "WHERE pg_type.typname = 'incidentstatus' AND pg_enum.enumlabel = 'RESOLVED_UNVERIFIED'"
    )).scalar()

    if not enum_check:
        conn.execute(sa.text("ALTER TYPE incidentstatus ADD VALUE IF NOT EXISTS 'RESOLVED_UNVERIFIED'"))
        print("Added RESOLVED_UNVERIFIED to incidentstatus enum.")

    # 2. Create resolution_requests table
    table_check = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'resolution_requests')"
    )).scalar()

    if not table_check:
        op.create_table(
            'resolution_requests',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('incident_id', sa.String(36), sa.ForeignKey('incidents.id', ondelete='CASCADE'), nullable=False),
            sa.Column('requester_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('status', sa.String(30), nullable=False, server_default='pending'),
            sa.Column('explanation', sa.Text(), nullable=False),
            sa.Column('evidence_url', sa.String(512), nullable=True),
            sa.Column('rejection_reason', sa.Text(), nullable=True),
            sa.Column('reviewed_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_resolution_requests_incident_id ON resolution_requests (incident_id);"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_resolution_requests_requester_id ON resolution_requests (requester_id);"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_resolution_requests_status ON resolution_requests (status);"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_resolution_requests_created_at ON resolution_requests (created_at);"))
        print("resolution_requests table created.")

    # 3. Create incident_status_history table
    history_check = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'incident_status_history')"
    )).scalar()

    if not history_check:
        op.create_table(
            'incident_status_history',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('incident_id', sa.String(36), sa.ForeignKey('incidents.id', ondelete='CASCADE'), nullable=False),
            sa.Column('from_status', sa.String(50), nullable=False),
            sa.Column('to_status', sa.String(50), nullable=False),
            sa.Column('changed_by_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.Column('reason', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_incident_status_history_incident_id ON incident_status_history (incident_id);"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_incident_status_history_changed_by_id ON incident_status_history (changed_by_id);"))
        conn.execute(sa.text("CREATE INDEX IF NOT EXISTS ix_incident_status_history_created_at ON incident_status_history (created_at);"))
        print("incident_status_history table created.")


def downgrade() -> None:
    op.drop_table('incident_status_history')
    op.drop_table('resolution_requests')
