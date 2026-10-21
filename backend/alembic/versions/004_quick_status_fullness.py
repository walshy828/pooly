"""Add fullness column to quick_statuses for basket fill tracking

Revision ID: 004_quick_status_fullness
Revises: 003_sensor_readings_index
Create Date: 2026-06-08
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '004_quick_status_fullness'
down_revision: Union[str, None] = '003_sensor_readings_index'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text(
        "ALTER TABLE quick_statuses ADD COLUMN IF NOT EXISTS fullness INTEGER"
    ))


def downgrade() -> None:
    op.drop_column('quick_statuses', 'fullness')
