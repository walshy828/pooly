"""Add optional AI (Claude) insight settings to pool_config

Revision ID: 006_ai_settings
Revises: 005_treatment_plans
Create Date: 2026-06-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '006_ai_settings'
down_revision: Union[str, None] = '005_treatment_plans'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE pool_config ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT FALSE"
    ))
    conn.execute(sa.text(
        "ALTER TABLE pool_config ADD COLUMN IF NOT EXISTS ai_api_key TEXT"
    ))
    conn.execute(sa.text(
        "ALTER TABLE pool_config ADD COLUMN IF NOT EXISTS ai_model VARCHAR(60) NOT NULL DEFAULT 'claude-opus-4-8'"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE pool_config DROP COLUMN IF EXISTS ai_model"))
    conn.execute(sa.text("ALTER TABLE pool_config DROP COLUMN IF EXISTS ai_api_key"))
    conn.execute(sa.text("ALTER TABLE pool_config DROP COLUMN IF EXISTS ai_enabled"))
