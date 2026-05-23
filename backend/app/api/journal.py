"""Journal entry CRUD endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import JournalEntry, Measurement
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/journal", tags=["journal"])


def _serialize_col_value(val):
    if isinstance(val, datetime):
        return val.isoformat()
    return val


def serialize_entry(e):
    return {
        "id": e.id,
        "entry_date": e.entry_date.isoformat(),
        "entry_type": e.entry_type,
        "notes": e.notes,
        "created_at": e.created_at.isoformat(),
        "measurements": [
            {c.key: _serialize_col_value(getattr(m, c.key)) for c in m.__table__.columns}
            for m in e.measurements
        ],
        "chemical_additions": [
            {c.key: _serialize_col_value(getattr(ca, c.key)) for c in ca.__table__.columns}
            for ca in e.chemical_additions
        ],
        "maintenance_actions": [
            {c.key: _serialize_col_value(getattr(ma, c.key)) for c in ma.__table__.columns}
            for ma in e.maintenance_actions
        ],
        "observations": [
            {c.key: _serialize_col_value(getattr(o, c.key)) for c in o.__table__.columns}
            for o in e.observations
        ],
        "quick_statuses": [
            {c.key: _serialize_col_value(getattr(qs, c.key)) for c in qs.__table__.columns}
            for qs in e.quick_statuses
        ],
    }


@router.get("")
async def list_entries(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    entry_type: str = Query(None),
    start_date: str = Query(None),
    end_date: str = Query(None),
    sub_type: str = Query(None),  # Specific maintenance action or chemical type
    db: AsyncSession = Depends(get_db),
):
    from app.models import MaintenanceAction, ChemicalAddition, QuickStatus
    from datetime import date as dt_date

    q = select(JournalEntry).order_by(desc(JournalEntry.entry_date))
    count_q = select(func.count(JournalEntry.id))

    # Join if sub_type provided
    if sub_type:
        q = q.outerjoin(MaintenanceAction).outerjoin(ChemicalAddition).outerjoin(QuickStatus)
        count_q = count_q.outerjoin(MaintenanceAction).outerjoin(ChemicalAddition).outerjoin(QuickStatus)
        q = q.where(
            (MaintenanceAction.action_type == sub_type) | 
            (ChemicalAddition.chemical_type == sub_type) |
            (QuickStatus.status_type == sub_type)
        )
        count_q = count_q.where(
            (MaintenanceAction.action_type == sub_type) | 
            (ChemicalAddition.chemical_type == sub_type) |
            (QuickStatus.status_type == sub_type)
        )

    if entry_type:
        q = q.where(JournalEntry.entry_type == entry_type)
        count_q = count_q.where(JournalEntry.entry_type == entry_type)

    if start_date:
        try:
            d = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
            q = q.where(JournalEntry.entry_date >= d)
            count_q = count_q.where(JournalEntry.entry_date >= d)
        except: pass

    if end_date:
        try:
            d = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
            q = q.where(JournalEntry.entry_date <= d)
            count_q = count_q.where(JournalEntry.entry_date <= d)
        except: pass

    total = (await db.execute(count_q)).scalar()
    q = q.offset((page - 1) * page_size).limit(page_size)
    q = q.options(
        selectinload(JournalEntry.measurements),
        selectinload(JournalEntry.chemical_additions),
        selectinload(JournalEntry.maintenance_actions),
        selectinload(JournalEntry.observations),
        selectinload(JournalEntry.quick_statuses),
    )
    result = await db.execute(q)
    entries = result.scalars().all()

    return {
        "entries": [serialize_entry(e) for e in entries],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/trends")
async def get_measurement_trends(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
):
    """Return recent measurements for trend charting on the dashboard."""
    from datetime import timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(Measurement)
        .where(Measurement.measured_at >= since)
        .order_by(Measurement.measured_at.asc())
    )
    measurements = result.scalars().all()

    params = ["ph", "free_chlorine", "total_chlorine", "alkalinity",
              "cyanuric_acid", "calcium_hardness", "bromine"]
    trends = {}
    for p in params:
        points = []
        for m in measurements:
            val = getattr(m, p, None)
            if val is not None:
                points.append({"date": m.measured_at.isoformat(), "value": val})
        if points:
            trends[p] = points
    return trends


@router.get("/{entry_id}")
async def get_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    q = (
        select(JournalEntry)
        .where(JournalEntry.id == entry_id)
        .options(
            selectinload(JournalEntry.measurements),
            selectinload(JournalEntry.chemical_additions),
            selectinload(JournalEntry.maintenance_actions),
            selectinload(JournalEntry.observations),
            selectinload(JournalEntry.quick_statuses),
        )
    )
    result = await db.execute(q)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return serialize_entry(entry)


class JournalEntryUpdate(BaseModel):
    notes: Optional[str] = None
    # Measurement fields
    ph: Optional[float] = None
    free_chlorine: Optional[float] = None
    total_chlorine: Optional[float] = None
    alkalinity: Optional[float] = None
    cyanuric_acid: Optional[float] = None
    calcium_hardness: Optional[float] = None
    bromine: Optional[float] = None
    # Observation
    health_score: Optional[int] = None


@router.put("/{entry_id}")
async def update_entry(entry_id: int, data: JournalEntryUpdate, db: AsyncSession = Depends(get_db)):
    q = (
        select(JournalEntry)
        .where(JournalEntry.id == entry_id)
        .options(
            selectinload(JournalEntry.measurements),
            selectinload(JournalEntry.observations),
        )
    )
    result = await db.execute(q)
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    if data.notes is not None:
        entry.notes = data.notes

    # Update measurement values if this is a measurement entry
    meas_fields = ["ph", "free_chlorine", "total_chlorine", "alkalinity",
                   "cyanuric_acid", "calcium_hardness", "bromine"]
    has_meas_update = any(getattr(data, f) is not None for f in meas_fields)

    if has_meas_update and entry.measurements:
        m = entry.measurements[0]
        for f in meas_fields:
            val = getattr(data, f)
            if val is not None:
                setattr(m, f, val)

    # Update observation health_score
    if data.health_score is not None and entry.observations:
        entry.observations[0].health_score = data.health_score

    await db.commit()
    return {"id": entry.id, "status": "ok"}


@router.delete("/{entry_id}")
async def delete_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(JournalEntry).where(JournalEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
    return {"id": entry_id, "status": "deleted"}


