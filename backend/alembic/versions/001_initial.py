"""initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-05-11

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('journal_entries',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('entry_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('entry_type', sa.String(length=50), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('measurements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), nullable=False),
        sa.Column('measured_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('ph', sa.Float(), nullable=True),
        sa.Column('free_chlorine', sa.Float(), nullable=True),
        sa.Column('total_chlorine', sa.Float(), nullable=True),
        sa.Column('alkalinity', sa.Float(), nullable=True),
        sa.Column('cyanuric_acid', sa.Float(), nullable=True),
        sa.Column('calcium_hardness', sa.Float(), nullable=True),
        sa.Column('bromine', sa.Float(), nullable=True),
        sa.Column('water_clarity', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('chemical_additions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('chemical_type', sa.String(length=50), nullable=False),
        sa.Column('form', sa.String(length=50), nullable=True),
        sa.Column('amount', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(length=30), nullable=True),
        sa.Column('cost', sa.Float(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('maintenance_actions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), nullable=False),
        sa.Column('performed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('action_type', sa.String(length=50), nullable=False),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('pool_observations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), nullable=False),
        sa.Column('observed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('health_score', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('quick_statuses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('journal_entry_id', sa.Integer(), nullable=False),
        sa.Column('logged_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('status_type', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['journal_entry_id'], ['journal_entries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('sensor_readings',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('sensor_type', sa.String(length=50), nullable=False),
        sa.Column('value', sa.Float(), nullable=False),
        sa.Column('unit', sa.String(length=20), nullable=True),
        sa.Column('source', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('weather_snapshots',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('fetched_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('air_temp_f', sa.Float(), nullable=True),
        sa.Column('humidity', sa.Float(), nullable=True),
        sa.Column('uv_index', sa.Float(), nullable=True),
        sa.Column('condition', sa.String(length=100), nullable=True),
        sa.Column('icon', sa.String(length=10), nullable=True),
        sa.Column('wind_speed', sa.Float(), nullable=True),
        sa.Column('forecast_data', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('pool_config',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('shape', sa.String(length=50), nullable=True),
        sa.Column('length_ft', sa.Float(), nullable=True),
        sa.Column('width_ft', sa.Float(), nullable=True),
        sa.Column('depth_ft', sa.Float(), nullable=True),
        sa.Column('volume_gallons', sa.Integer(), nullable=True),
        sa.Column('pool_type', sa.String(length=50), nullable=True),
        sa.Column('surface_type', sa.String(length=50), nullable=True),
        sa.Column('sanitizer_type', sa.String(length=50), nullable=True),
        sa.Column('filter_type', sa.String(length=50), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('maintenance_schedule',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False),
        sa.Column('display_name', sa.String(length=100), nullable=False),
        sa.Column('interval_days', sa.Integer(), nullable=False),
        sa.Column('last_completed', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_due', sa.DateTime(timezone=True), nullable=True),
        sa.Column('priority', sa.String(length=20), nullable=False, server_default='normal'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('icon', sa.String(length=10), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_type')
    )


def downgrade() -> None:
    op.drop_table('maintenance_schedule')
    op.drop_table('pool_config')
    op.drop_table('weather_snapshots')
    op.drop_table('sensor_readings')
    op.drop_table('quick_statuses')
    op.drop_table('pool_observations')
    op.drop_table('maintenance_actions')
    op.drop_table('chemical_additions')
    op.drop_table('measurements')
    op.drop_table('journal_entries')
