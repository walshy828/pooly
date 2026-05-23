"""Sensor and weather models for external data sources."""

from datetime import datetime
from sqlalchemy import Integer, String, Float, Text, DateTime, JSON, func
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base


class SensorReading(Base):
    """Readings polled from Home Assistant (pool temperature, pump status, energy)."""

    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    read_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sensor_type: Mapped[str] = mapped_column(String(50))  # pool_temp, pump_state, pump_energy
    value: Mapped[float] = mapped_column(Float)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True)  # °F, on/off, kWh
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)  # entity_id


class WeatherSnapshot(Base):
    """Weather data fetched from OpenWeatherMap."""

    __tablename__ = "weather_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    air_temp_f: Mapped[float | None] = mapped_column(Float, nullable=True)
    humidity: Mapped[float | None] = mapped_column(Float, nullable=True)
    uv_index: Mapped[float | None] = mapped_column(Float, nullable=True)
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(10), nullable=True)
    wind_speed: Mapped[float | None] = mapped_column(Float, nullable=True)
    forecast_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
