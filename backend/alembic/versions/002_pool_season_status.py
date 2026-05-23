"""Add pool season status fields (open/closed, dates).

Revision ID: 002_pool_season_status
Revises: 001_initial
Create Date: 2026-05-11
"""

from alembic import op
import sqlalchemy as sa

revision = '002_pool_season_status'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add pool season status columns to pool_config table
    with op.batch_alter_table('pool_config') as batch_op:
        batch_op.add_column(sa.Column('pool_status', sa.String(20), nullable=False, server_default='open'))
        batch_op.add_column(sa.Column('pool_opened_at', sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(sa.Column('pool_closed_at', sa.DateTime(timezone=True), nullable=True))

    # Expand journal entry_type to allow 'pool_event' entries
    # (no schema change needed — entry_type is a varchar, just new values used)


def downgrade() -> None:
    with op.batch_alter_table('pool_config') as batch_op:
        batch_op.drop_column('pool_status')
        batch_op.drop_column('pool_opened_at')
        batch_op.drop_column('pool_closed_at')
