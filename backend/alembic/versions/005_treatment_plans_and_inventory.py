"""Add treatment plans, treatment steps, chemical inventory, and algae_level to measurements

Revision ID: 005_treatment_plans_and_inventory
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

    # Add algae_level to measurements
    conn.execute(sa.text(
        "ALTER TABLE measurements ADD COLUMN IF NOT EXISTS algae_level VARCHAR(20)"
    ))

    # Create chemical_inventory table
    op.create_table(
        'chemical_inventory',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('pool_config_id', sa.Integer(), sa.ForeignKey('pool_config.id', ondelete='CASCADE'), nullable=False),
        sa.Column('product_id', sa.String(100), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unit', sa.String(30), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        if_not_exists=True,
    )

    # Create treatment_plans table
    op.create_table(
        'treatment_plans',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('pool_config_id', sa.Integer(), sa.ForeignKey('pool_config.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_type', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('condition_label', sa.String(100), nullable=False),
        sa.Column('estimated_days', sa.Integer(), nullable=True),
        sa.Column('measurement_snapshot', sa.JSON(), nullable=True),
        sa.Column('pool_gallons', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        if_not_exists=True,
    )

    # Create treatment_steps table
    op.create_table(
        'treatment_steps',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('plan_id', sa.Integer(), sa.ForeignKey('treatment_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_order', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('action_type', sa.String(30), nullable=False),
        sa.Column('product_id', sa.String(100), nullable=True),
        sa.Column('product_name', sa.String(200), nullable=True),
        sa.Column('amount', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(30), nullable=True),
        sa.Column('bags_needed', sa.Integer(), nullable=True),
        sa.Column('wait_hours_after', sa.Float(), nullable=True),
        sa.Column('why', sa.Text(), nullable=True),
        sa.Column('safety_notes', sa.Text(), nullable=True),
        sa.Column('alternative_products', sa.JSON(), nullable=True),
        sa.Column('is_completed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('user_notes', sa.Text(), nullable=True),
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_table('treatment_steps')
    op.drop_table('treatment_plans')
    op.drop_table('chemical_inventory')
    op.drop_column('measurements', 'algae_level')
