"""Add user_product_catalog table for custom products and built-in product preferences

Revision ID: 008_custom_products
Revises: 007_ai_provider
Create Date: 2026-06-23
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '008_custom_products'
down_revision: Union[str, None] = '007_ai_provider'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS user_product_catalog (
            id SERIAL PRIMARY KEY,
            pool_config_id INTEGER NOT NULL REFERENCES pool_config(id) ON DELETE CASCADE,
            product_id VARCHAR(100) NOT NULL,
            is_custom BOOLEAN NOT NULL DEFAULT TRUE,
            enabled BOOLEAN NOT NULL DEFAULT TRUE,
            name VARCHAR(200),
            brand VARCHAR(100),
            product_type VARCHAR(50),
            form VARCHAR(30),
            package_size FLOAT,
            package_unit VARCHAR(20),
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            UNIQUE (pool_config_id, product_id)
        )
    """))


def downgrade() -> None:
    op.drop_table("user_product_catalog")
