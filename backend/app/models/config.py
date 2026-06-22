"""Pool configuration and maintenance schedule models."""

from datetime import datetime
from sqlalchemy import Integer, String, Float, Text, DateTime, Boolean, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class PoolConfig(Base):
    """Pool metadata and configuration — single row for single-pool mode."""

    __tablename__ = "pool_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), default="My Pool")
    shape: Mapped[str | None] = mapped_column(String(50), nullable=True)  # round, oval, rectangular
    length_ft: Mapped[float | None] = mapped_column(Float, nullable=True)
    width_ft: Mapped[float | None] = mapped_column(Float, nullable=True)
    depth_ft: Mapped[float | None] = mapped_column(Float, nullable=True)
    volume_gallons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    pool_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # above_ground, in_ground
    surface_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # vinyl, plaster, fiberglass
    sanitizer_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # chlorine, salt, bromine
    filter_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # cartridge, sand, de
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Season status
    pool_status: Mapped[str] = mapped_column(String(20), default="open")  # open, closed
    pool_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    pool_closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ChemicalInventoryItem(Base):
    """A chemical product the user has on hand, with quantity."""

    __tablename__ = "chemical_inventory"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pool_config_id: Mapped[int] = mapped_column(ForeignKey("pool_config.id", ondelete="CASCADE"))
    product_id: Mapped[str] = mapped_column(String(100))  # key into CHEMICAL_PRODUCTS catalog
    quantity: Mapped[float] = mapped_column(Float, default=0)
    unit: Mapped[str] = mapped_column(String(30))  # lbs, gallons, quarts, oz, bags, bottles
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class MaintenanceSchedule(Base):
    """Configurable maintenance reminder tasks."""

    __tablename__ = "maintenance_schedule"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    task_type: Mapped[str] = mapped_column(String(50), unique=True)
    display_name: Mapped[str] = mapped_column(String(100))
    interval_days: Mapped[int] = mapped_column(Integer)
    last_completed: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    next_due: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    priority: Mapped[str] = mapped_column(String(20), default="normal")  # low, normal, high, critical
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    icon: Mapped[str | None] = mapped_column(String(10), nullable=True)  # emoji icon
