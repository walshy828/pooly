"""Journal entry schemas."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class JournalEntryCreate(BaseModel):
    entry_type: str
    notes: Optional[str] = None
    entry_date: Optional[datetime] = None


class JournalEntryResponse(BaseModel):
    id: int
    entry_date: datetime
    entry_type: str
    notes: Optional[str] = None
    created_at: datetime
    measurements: list[Any] = []
    chemical_additions: list[Any] = []
    maintenance_actions: list[Any] = []
    observations: list[Any] = []
    quick_statuses: list[Any] = []

    class Config:
        from_attributes = True


class JournalEntryListResponse(BaseModel):
    entries: list[JournalEntryResponse]
    total: int
    page: int
    page_size: int
