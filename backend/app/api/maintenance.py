"""Maintenance action, shock, observation, quick status, and note endpoints."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import JournalEntry, MaintenanceAction, PoolObservation, QuickStatus, ChemicalAddition
from app.schemas.maintenance import (
    MaintenanceActionCreate, PoolObservationCreate, QuickStatusCreate, ShockCreate, NoteCreate,
    PoolCareActionCreate,
)
from app.services.reminders import update_schedule_completion

router = APIRouter(prefix="/api", tags=["maintenance"])


@router.post("/maintenance")
async def add_maintenance(data: MaintenanceActionCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now

    entry = JournalEntry(entry_type="maintenance", entry_date=entry_dt, notes=data.notes)
    db.add(entry)
    await db.flush()

    action = MaintenanceAction(
        journal_entry_id=entry.id, performed_at=entry_dt,
        action_type=data.action_type, details=data.details, notes=data.notes,
    )
    db.add(action)
    await db.flush()

    schedule_map = {
        "clean_cartridge": "clean_cartridge",
        "add_water": "add_water",
        "backwash": "backwash",
        "brush_walls": "brush_walls",
    }
    if data.action_type in schedule_map:
        await update_schedule_completion(db, schedule_map[data.action_type], entry_dt)

    await db.commit()
    return {"id": action.id, "status": "ok"}


@router.post("/shock")
async def add_shock(data: ShockCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now

    entry = JournalEntry(entry_type="shock", entry_date=entry_dt, notes=data.notes)
    db.add(entry)
    await db.flush()

    chem = ChemicalAddition(
        journal_entry_id=entry.id, added_at=entry_dt,
        chemical_type="shock", form=data.shock_type,
        amount=data.units, unit="bottles" if data.shock_type == "bottle" else "bags",
        notes=data.notes,
    )
    db.add(chem)
    await db.flush()
    await update_schedule_completion(db, "shock_pool", entry_dt)
    await db.commit()
    return {"id": chem.id, "status": "ok"}


@router.post("/observations")
async def add_observation(data: PoolObservationCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now

    entry = JournalEntry(entry_type="observation", entry_date=entry_dt, notes=data.notes)
    db.add(entry)
    await db.flush()

    obs = PoolObservation(
        journal_entry_id=entry.id, observed_at=entry_dt,
        health_score=data.health_score, notes=data.notes,
    )
    db.add(obs)
    await db.commit()
    return {"id": obs.id, "health_score": data.health_score, "status": "ok"}


@router.post("/quick-status")
async def add_quick_status(data: QuickStatusCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now

    entry = JournalEntry(entry_type="quick_status", entry_date=entry_dt)
    db.add(entry)
    await db.flush()

    qs = QuickStatus(
        journal_entry_id=entry.id, logged_at=entry_dt,
        status_type=data.status_type, fullness=data.fullness,
    )
    db.add(qs)
    await db.flush()

    schedule_map = {
        "clean_skimmer": "clean_skimmer",
        "robot_run": "robot_run",
        "vacuumed": "vacuum",
        "basket_emptied": "empty_basket",
        "clear_water": None,
    }
    sched_task = schedule_map.get(data.status_type)
    if sched_task:
        await update_schedule_completion(db, sched_task, entry_dt)

    await db.commit()
    return {"id": qs.id, "status_type": data.status_type, "status": "ok"}


@router.post("/notes")
async def add_note(data: NoteCreate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now
    entry = JournalEntry(entry_type="note", entry_date=entry_dt, notes=data.notes)
    db.add(entry)
    await db.commit()
    return {"id": entry.id, "status": "ok"}


_POOL_CARE_ROUTING = {
    "clean_cartridge": ("maintenance", "clean_cartridge", "clean_cartridge"),
    "add_water":       ("maintenance", "add_water",       "add_water"),
    "backwash":        ("maintenance", "backwash",        "backwash"),
    "brush_walls":     ("maintenance", "brush_walls",     "brush_walls"),
    "clean_skimmer":   ("quick_status", "clean_skimmer", "clean_skimmer"),
    "robot_run":       ("quick_status", "robot_run",      "robot_run"),
    "vacuum":          ("quick_status", "vacuumed",       "vacuum"),
    "empty_basket":    ("quick_status", "basket_emptied", "empty_basket"),
    "clear_water":     ("quick_status", "clear_water",    None),
}


@router.post("/pool-care")
async def log_pool_care_action(data: PoolCareActionCreate, db: AsyncSession = Depends(get_db)):
    """Unified endpoint for all pool care actions. Routes internally to MaintenanceAction or QuickStatus."""
    routing = _POOL_CARE_ROUTING.get(data.task_type)
    if not routing:
        raise HTTPException(status_code=400, detail=f"Unknown task_type: {data.task_type}")

    kind, sub_type, schedule_task = routing
    now = datetime.now(timezone.utc)
    entry_dt = data.entry_date or now

    if kind == "maintenance":
        entry = JournalEntry(entry_type="maintenance", entry_date=entry_dt, notes=data.notes)
        db.add(entry)
        await db.flush()
        action = MaintenanceAction(
            journal_entry_id=entry.id, performed_at=entry_dt,
            action_type=sub_type, notes=data.notes,
        )
        db.add(action)
        await db.flush()
    else:  # quick_status
        entry = JournalEntry(entry_type="quick_status", entry_date=entry_dt)
        db.add(entry)
        await db.flush()
        qs = QuickStatus(
            journal_entry_id=entry.id, logged_at=entry_dt,
            status_type=sub_type, fullness=data.fullness,
        )
        db.add(qs)
        await db.flush()

    if schedule_task:
        await update_schedule_completion(db, schedule_task, entry_dt)

    await db.commit()
    return {"task_type": data.task_type, "status": "ok"}


@router.post("/maintenance/dismiss/{task_type}")
async def dismiss_maintenance(task_type: str, db: AsyncSession = Depends(get_db)):
    """Reset the maintenance schedule clock WITHOUT creating a journal entry."""
    now = datetime.now(timezone.utc)
    await update_schedule_completion(db, task_type, now)
    await db.commit()
    return {"task_type": task_type, "status": "dismissed", "reset_at": now.isoformat()}
