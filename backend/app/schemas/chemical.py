"""Chemical addition schemas."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ChemicalAdditionCreate(BaseModel):
    chemical_type: str
    form: Optional[str] = None
    amount: Optional[float] = None
    unit: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None
    entry_date: Optional[datetime] = None


class ChemicalAdditionResponse(BaseModel):
    id: int
    journal_entry_id: int
    added_at: datetime
    chemical_type: str
    form: Optional[str] = None
    amount: Optional[float] = None
    unit: Optional[str] = None
    cost: Optional[float] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True
