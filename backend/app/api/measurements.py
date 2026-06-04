"""Measurement quick-add endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import JournalEntry, Measurement
from app.schemas.measurement import MeasurementCreate, MeasurementResponse
from app.services.reminders import update_schedule_completion
from app.services.chemistry import get_recommendations, CHEMISTRY_RANGES

router = APIRouter(prefix="/api/measurements", tags=["measurements"])


@router.post("", response_model=MeasurementResponse)
async def add_measurement(data: MeasurementCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now

    entry = JournalEntry(entry_type="measurement", entry_date=entry_dt, notes=data.notes)
    db.add(entry)
    await db.flush()

    meas = Measurement(
        journal_entry_id=entry.id,
        measured_at=entry_dt,
        ph=data.ph,
        free_chlorine=data.free_chlorine,
        total_chlorine=data.total_chlorine,
        alkalinity=data.alkalinity,
        cyanuric_acid=data.cyanuric_acid,
        calcium_hardness=data.calcium_hardness,
        bromine=data.bromine,
        water_clarity=data.water_clarity,
        notes=data.notes,
    )
    db.add(meas)
    await db.flush()

    await update_schedule_completion(db, "test_water", entry_dt)
    if data.cyanuric_acid is not None:
        await update_schedule_completion(db, "check_cya", entry_dt)

    await db.commit()
    await db.refresh(meas)
    return meas


@router.get("/chemistry-config")
async def get_chemistry_config():
    """Return chemistry range definitions for the frontend."""
    return CHEMISTRY_RANGES
