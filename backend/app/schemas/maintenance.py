"""Maintenance action, pool observation, and quick status schemas."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class MaintenanceActionCreate(BaseModel):
    action_type: str
    details: Optional[dict[str, Any]] = None
    notes: Optional[str] = None
    entry_date: Optional[datetime] = None


class MaintenanceActionResponse(BaseModel):
    id: int
    journal_entry_id: int
    performed_at: datetime
    action_type: str
    details: Optional[dict[str, Any]] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class PoolObservationCreate(BaseModel):
    health_score: int  # 1-10
    notes: Optional[str] = None
    entry_date: Optional[datetime] = None


class PoolObservationResponse(BaseModel):
    id: int
    journal_entry_id: int
    observed_at: datetime
    health_score: int
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class QuickStatusCreate(BaseModel):
    status_type: str  # clear_water, clean_skimmer, robot_run, vacuumed, basket_emptied
    entry_date: Optional[datetime] = None
    fullness: Optional[int] = None  # 0-100 for basket tasks


class QuickStatusResponse(BaseModel):
    id: int
    journal_entry_id: int
    logged_at: datetime
    status_type: str
    fullness: Optional[int] = None

    class Config:
        from_attributes = True


class ShockCreate(BaseModel):
    shock_type: str  # bottle, granular
    units: float  # number of bottles or bags
    notes: Optional[str] = None
    entry_date: Optional[datetime] = None


class NoteCreate(BaseModel):
    notes: str
    entry_date: Optional[datetime] = None
