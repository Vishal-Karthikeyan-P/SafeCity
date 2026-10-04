"""
006 - User-to-user emergency contact requests
Adds: contact_requests table, push_token to users, notification extensions
"""
from alembic import op
import sqlalchemy as sa

revision = '006_contact_requests'
down_revision = '005_anonymous_reporter_severity'
branch_labels = None
depends_on = None


def upgrade():
    # 1. contact_requests table — user-to-user in-app emergency contact workflow
    op.create_table(
        'contact_requests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('requester_id', sa.String(36),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('contact_id', sa.String(36),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, default='pending'),
        sa.Column('message', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        # Prevent duplicate requests in the same direction
        sa.UniqueConstraint('requester_id', 'contact_id', name='uq_contact_request_pair'),
    )
    op.create_index('ix_contact_requests_requester', 'contact_requests', ['requester_id'])
    op.create_index('ix_contact_requests_contact', 'contact_requests', ['contact_id'])
    op.create_index('ix_contact_requests_status', 'contact_requests', ['status'])

    # 2. push_token column on users for Expo push notifications
    op.add_column('users', sa.Column('push_token', sa.String(512), nullable=True))

    # Convert notifications.type to VARCHAR to accept all extended notification types
    op.execute("ALTER TABLE notifications ALTER COLUMN type TYPE VARCHAR(50) USING type::VARCHAR")

    # 3. Extend notifications — add metadata_json for deep-link context and sos_id FK
    op.add_column('notifications', sa.Column(
        'metadata_json', sa.Text, nullable=True,
        comment='JSON blob with context for deep-link: sos_id, contact_request_id, etc.'
    ))
    op.add_column('notifications', sa.Column(
        'sos_id', sa.String(36),
        sa.ForeignKey('sos_requests.id', ondelete='SET NULL'),
        nullable=True
    ))
    op.add_column('notifications', sa.Column(
        'dedup_key', sa.String(255), nullable=True,
        comment='Deduplication key — prevents spamming same event to same user'
    ))
    op.create_index('ix_notifications_dedup', 'notifications', ['user_id', 'dedup_key'])

    print("Migration 006: contact_requests table + push_token + notification extensions created.")


def downgrade():
    op.drop_index('ix_notifications_dedup', 'notifications')
    op.drop_column('notifications', 'dedup_key')
    op.drop_column('notifications', 'sos_id')
    op.drop_column('notifications', 'metadata_json')
    op.drop_column('users', 'push_token')
    op.drop_index('ix_contact_requests_status', 'contact_requests')
    op.drop_index('ix_contact_requests_contact', 'contact_requests')
    op.drop_index('ix_contact_requests_requester', 'contact_requests')
    op.drop_table('contact_requests')
