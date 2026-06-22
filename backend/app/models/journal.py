"""Journal-related models: entries, measurements, chemicals, maintenance, observations, quick status."""

import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Integer, String, Float, Text, DateTime, ForeignKey, JSON,
    func, Enum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class AlgaeLevel(str, enum.Enum):
    none = "none"
    slight = "slight"
    moderate = "moderate"
    heavy = "heavy"
    swamp = "swamp"


class JournalEntry(Base):
    """Parent record for every user action — provides a unified timeline."""

    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    entry_type: Mapped[str] = mapped_column(String(50))  # measurement, chemical, maintenance, observation, quick_status, note, shock
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    measurements: Mapped[list["Measurement"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")
    chemical_additions: Mapped[list["ChemicalAddition"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")
    maintenance_actions: Mapped[list["MaintenanceAction"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")
    observations: Mapped[list["PoolObservation"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")
    quick_statuses: Mapped[list["QuickStatus"]] = relationship(back_populates="journal_entry", cascade="all, delete-orphan")


class Measurement(Base):
    """Water chemistry test results — mirrors a test strip reading."""

    __tablename__ = "measurements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"))
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    ph: Mapped[float | None] = mapped_column(Float, nullable=True)
    free_chlorine: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_chlorine: Mapped[float | None] = mapped_column(Float, nullable=True)
    alkalinity: Mapped[float | None] = mapped_column(Float, nullable=True)
    cyanuric_acid: Mapped[float | None] = mapped_column(Float, nullable=True)
    calcium_hardness: Mapped[float | None] = mapped_column(Float, nullable=True)
    bromine: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_clarity: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 1-10 scale
    algae_level: Mapped[str | None] = mapped_column(Enum(AlgaeLevel), nullable=True, default="none")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="measurements")


class ChemicalAddition(Base):
    """Record of chemicals added to the pool."""

    __tablename__ = "chemical_additions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"))
    added_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    chemical_type: Mapped[str] = mapped_column(String(50))  # chlorine, ph_up, ph_down, alkalinity, cyanuric_acid, hardener, algaecide, clarifier, shock
    form: Mapped[str | None] = mapped_column(String(50), nullable=True)  # tabs, granular, liquid, bottle, bag
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)  # tabs, lbs, oz, gallons, bags, bottles
    cost: Mapped[float | None] = mapped_column(Float, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="chemical_additions")


class MaintenanceAction(Base):
    """Maintenance tasks performed on pool equipment or surfaces."""

    __tablename__ = "maintenance_actions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"))
    performed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    action_type: Mapped[str] = mapped_column(String(50))  # clean_cartridge, add_water, backwash, brush_walls, shock
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="maintenance_actions")


class PoolObservation(Base):
    """Visual pool health assessment — 1 (swamp) to 10 (crystal clear)."""

    __tablename__ = "pool_observations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"))
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    health_score: Mapped[int] = mapped_column(Integer)  # 1-10
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="observations")


class QuickStatus(Base):
    """One-tap status logging — clear_water, clean_skimmer, robot_run, vacuumed, basket_emptied."""

    __tablename__ = "quick_statuses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    journal_entry_id: Mapped[int] = mapped_column(ForeignKey("journal_entries.id", ondelete="CASCADE"))
    logged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    status_type: Mapped[str] = mapped_column(String(50))  # clear_water, clean_skimmer, robot_run, vacuumed, basket_emptied
    fullness: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 0-100% for basket tasks

    journal_entry: Mapped["JournalEntry"] = relationship(back_populates="quick_statuses")
