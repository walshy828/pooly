"""Add treatment plans, treatment steps, chemical inventory, and algae_level to measurements

Revision ID: 005_treatment_plans
Revises: 004_quick_status_fullness
Create Date: 2026-06-22
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '005_treatment_plans'
down_revision: Union[str, None] = '004_quick_status_fullness'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    conn.execute(sa.text(
        "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS algae_level VARCHAR(20)"
    ))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS chemical_inventory (
            id SERIAL PRIMARY KEY,
            pool_config_id INTEGER NOT NULL REFERENCES pool_config(id) ON DELETE CASCADE,
            product_id VARCHAR(100) NOT NULL,
            quantity FLOAT NOT NULL DEFAULT 0,
            unit VARCHAR(30) NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS treatment_plans (
            id SERIAL PRIMARY KEY,
            pool_config_id INTEGER NOT NULL REFERENCES pool_config(id) ON DELETE CASCADE,
            plan_type VARCHAR(50) NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'active',
            condition_label VARCHAR(100) NOT NULL,
            estimated_days INTEGER,
            measurement_snapshot JSONB,
            pool_gallons INTEGER,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            completed_at TIMESTAMPTZ
        )
    """))

    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS treatment_steps (
            id SERIAL PRIMARY KEY,
            plan_id INTEGER NOT NULL REFERENCES treatment_plans(id) ON DELETE CASCADE,
            step_order INTEGER NOT NULL,
            title VARCHAR(200) NOT NULL,
            description TEXT,
            action_type VARCHAR(30) NOT NULL,
            product_id VARCHAR(100),
            product_name VARCHAR(200),
            amount FLOAT,
            unit VARCHAR(30),
            bags_needed INTEGER,
            wait_hours_after FLOAT,
            why TEXT,
            safety_notes TEXT,
            alternative_products JSONB,
            is_completed BOOLEAN NOT NULL DEFAULT FALSE,
            completed_at TIMESTAMPTZ,
            user_notes TEXT
        )
    """))


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("DROP TABLE IF EXISTS treatment_steps"))
    conn.execute(sa.text("DROP TABLE IF EXISTS treatment_plans"))
    conn.execute(sa.text("DROP TABLE IF EXISTS chemical_inventory"))
    conn.execute(sa.text("ALTER TABLE measurements DROP COLUMN IF EXISTS algae_level"))
