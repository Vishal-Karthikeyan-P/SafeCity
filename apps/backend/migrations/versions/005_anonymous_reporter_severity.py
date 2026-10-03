"""Add anonymous_reporter_id to incidents + auto-severity fields

Revision ID: 005_anonymous_reporter_severity
Revises: 004_status_workflow
Create Date: 2026-10-03 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_anonymous_reporter_severity'
down_revision: Union[str, None] = '004_status_workflow'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Add anonymous_reporter_id column to incidents
    col_check = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='incidents' AND column_name='anonymous_reporter_id'"
    )).scalar()
    if not col_check:
        op.add_column(
            'incidents',
            sa.Column(
                'anonymous_reporter_id',
                sa.String(36),
                sa.ForeignKey('users.id', ondelete='SET NULL'),
                nullable=True,
            )
        )
        conn.execute(sa.text(
            "CREATE INDEX IF NOT EXISTS ix_incidents_anon_reporter "
            "ON incidents (anonymous_reporter_id)"
        ))
        print("Added anonymous_reporter_id column to incidents.")

    # 2. Back-fill: for any existing anonymous incidents where reporter_id
    #    is NULL, we cannot recover ownership (data pre-dates this feature).
    #    This migration only affects future records.


def downgrade() -> None:
    conn = op.get_bind()
    col_check = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.columns "
        "WHERE table_name='incidents' AND column_name='anonymous_reporter_id'"
    )).scalar()
    if col_check:
        conn.execute(sa.text(
            "DROP INDEX IF EXISTS ix_incidents_anon_reporter"
        ))
        op.drop_column('incidents', 'anonymous_reporter_id')
