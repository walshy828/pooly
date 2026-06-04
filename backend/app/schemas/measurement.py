"""Measurement schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MeasurementCreate(BaseModel):
    ph: Optional[float] = None
    free_chlorine: Optional[float] = None
    total_chlorine: Optional[float] = None
    alkalinity: Optional[float] = None
    cyanuric_acid: Optional[float] = None
    calcium_hardness: Optional[float] = None
    bromine: Optional[float] = None
    water_clarity: Optional[int] = None
    notes: Optional[str] = None
    entry_date: Optional[datetime] = None


class MeasurementResponse(BaseModel):
    id: int
    journal_entry_id: int
    measured_at: datetime
    ph: Optional[float] = None
    free_chlorine: Optional[float] = None
    total_chlorine: Optional[float] = None
    alkalinity: Optional[float] = None
    cyanuric_acid: Optional[float] = None
    calcium_hardness: Optional[float] = None
    bromine: Optional[float] = None
    water_clarity: Optional[int] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True
