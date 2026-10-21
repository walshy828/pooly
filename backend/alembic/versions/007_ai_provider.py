"""Add ai_provider to pool_config

Revision ID: 007_ai_provider
Revises: 006_ai_settings
Create Date: 2026-06-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '007_ai_provider'
down_revision: Union[str, None] = '006_ai_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE pool_config ADD COLUMN IF NOT EXISTS ai_provider VARCHAR(20) NOT NULL DEFAULT 'claude'"
    ))
    conn.execute(sa.text(
        "ALTER TABLE pool_config ALTER COLUMN ai_model TYPE VARCHAR(80)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE pool_config DROP COLUMN IF EXISTS ai_provider"))
    conn.execute(sa.text(
        "ALTER TABLE pool_config ALTER COLUMN ai_model TYPE VARCHAR(60)"
    ))
