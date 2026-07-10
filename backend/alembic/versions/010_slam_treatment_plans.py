"""Add SLAM method support to treatment plans

Revision ID: 010_slam_treatment
Revises: 009_pool_location
Create Date: 2026-07-10
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '010_slam_treatment'
down_revision: Union[str, None] = '009_pool_location'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text(
        "ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS method VARCHAR(20) NOT NULL DEFAULT 'fixed'"
    ))
    conn.execute(sa.text(
        "ALTER TABLE treatment_plans ADD COLUMN IF NOT EXISTS slam_state JSONB"
    ))
    conn.execute(sa.text(
        "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS treatment_plan_id INTEGER "
        "REFERENCES treatment_plans(id) ON DELETE SET NULL"
    ))
    conn.execute(sa.text(
        "CREATE INDEX IF NOT EXISTS ix_measurements_treatment_plan_id ON measurements (treatment_plan_id)"
    ))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS ix_measurements_treatment_plan_id"))
    conn.execute(sa.text("ALTER TABLE measurements DROP COLUMN IF EXISTS treatment_plan_id"))
    conn.execute(sa.text("ALTER TABLE treatment_plans DROP COLUMN IF EXISTS slam_state"))
    conn.execute(sa.text("ALTER TABLE treatment_plans DROP COLUMN IF EXISTS method"))
