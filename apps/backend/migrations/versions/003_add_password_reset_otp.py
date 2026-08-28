"""Add password_reset_otps table for forgot-password OTP flow

Revision ID: 003_add_password_reset_otp
Revises: cd468bd26fdd
Create Date: 2026-08-28 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '003_add_password_reset_otp'
down_revision = 'cd468bd26fdd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    # Check if table already exists (idempotent)
    result = conn.execute(sa.text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'password_reset_otps')"
    ))
    if result.scalar():
        print("password_reset_otps table already exists, skipping.")
        return

    op.create_table(
        'password_reset_otps',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('otp_hash', sa.String(255), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('attempt_count', sa.Integer, nullable=False, default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_password_reset_otps_user_id', 'password_reset_otps', ['user_id'])
    op.create_index('ix_password_reset_otps_created_at', 'password_reset_otps', ['created_at'])
    print("password_reset_otps table created.")


def downgrade() -> None:
    op.drop_index('ix_password_reset_otps_created_at', table_name='password_reset_otps')
    op.drop_index('ix_password_reset_otps_user_id', table_name='password_reset_otps')
    op.drop_table('password_reset_otps')
