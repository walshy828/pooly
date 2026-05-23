"""Sensor data schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class SensorReadingResponse(BaseModel):
    id: int
    read_at: datetime
    sensor_type: str
    value: float
    unit: Optional[str] = None

    class Config:
        from_attributes = True


class TemperatureHistoryResponse(BaseModel):
    readings: list[SensorReadingResponse]
    current: Optional[float] = None
    min_24h: Optional[float] = None
    max_24h: Optional[float] = None


class PumpStatusResponse(BaseModel):
    state: Optional[str] = None
    energy_kwh: Optional[float] = None
    updated_at: Optional[datetime] = None
    runtime_hours_today: Optional[float] = None
