"""Chemical addition endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import JournalEntry, ChemicalAddition
from app.schemas.chemical import ChemicalAdditionCreate, ChemicalAdditionResponse
from app.services.reminders import update_schedule_completion

router = APIRouter(prefix="/api/chemicals", tags=["chemicals"])


@router.post("", response_model=ChemicalAdditionResponse)
async def add_chemical(data: ChemicalAdditionCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)

    entry = JournalEntry(entry_type="chemical", entry_date=now, notes=data.notes)
    db.add(entry)
    await db.flush()

    chem = ChemicalAddition(
        journal_entry_id=entry.id,
        added_at=now,
        chemical_type=data.chemical_type,
        form=data.form,
        amount=data.amount,
        unit=data.unit,
        cost=data.cost,
        notes=data.notes,
    )
    db.add(chem)
    await db.flush()

    # Update schedule for chlorine
    if data.chemical_type == "chlorine":
        await update_schedule_completion(db, "add_chlorine", now)

    await db.commit()
    await db.refresh(chem)
    return chem
