"""Add index on sensor_readings(sensor_type, read_at DESC)

Revision ID: 003_sensor_readings_index
Revises: 002_pool_season_status
Create Date: 2026-06-04

Speeds up the two queries in /api/ha/status and /api/sensors/temperature
that filter by sensor_type and order by read_at DESC.
"""
from typing import Sequence, Union
from alembic import op

revision: str = '003_sensor_readings_index'
down_revision: Union[str, None] = '002_pool_season_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_sensor_readings_type_time',
        'sensor_readings',
        ['sensor_type', 'read_at'],
        unique=False,
        postgresql_ops={'read_at': 'DESC'},
    )


def downgrade() -> None:
    op.drop_index('ix_sensor_readings_type_time', table_name='sensor_readings')
