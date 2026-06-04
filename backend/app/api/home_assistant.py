"""Home Assistant integration API endpoints.

Provides sensor-friendly maintenance status and action endpoints
for use with a Home Assistant custom integration.
"""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    MaintenanceSchedule, PoolConfig, PoolObservation, SensorReading,
    JournalEntry, MaintenanceAction, QuickStatus,
)
from app.services.reminders import update_schedule_completion

router = APIRouter(prefix="/api/ha", tags=["home_assistant"])


# ── Request schemas ────────────────────────────────────────────────────────────

class CompleteTaskRequest(BaseModel):
    notes: Optional[str] = None


class SensorPushRequest(BaseModel):
    sensor_type: str   # pool_temp | pump_state | pump_energy
    value: float
    unit: Optional[str] = None
    entity_id: Optional[str] = None


# ── How each task_type maps to a journal record when marked complete ──────────

_COMPLETE_MAP = {
    "clean_cartridge": {"type": "maintenance", "action_type": "clean_cartridge"},
    "add_water":       {"type": "maintenance", "action_type": "add_water"},
    "backwash":        {"type": "maintenance", "action_type": "backwash"},
    "brush_walls":     {"type": "maintenance", "action_type": "brush_walls"},
    "clean_skimmer":   {"type": "quick_status", "status_type": "clean_skimmer"},
    "robot_run":       {"type": "quick_status", "status_type": "robot_run"},
    "vacuum":          {"type": "quick_status", "status_type": "vacuumed"},
    "empty_basket":    {"type": "quick_status", "status_type": "basket_emptied"},
    # test_water / add_chlorine / check_cya / shock_pool → note entry only
}

_HEALTH_LABELS = {
    1: "Swamp", 2: "Very Poor", 3: "Needs Immediate Attention",
    4: "Needs Work", 5: "Cloudy", 6: "Slightly Hazy",
    7: "Okay", 8: "Looking Good", 9: "Clear", 10: "Crystal Clear",
}


# ── Shared helpers ─────────────────────────────────────────────────────────────

def _task_state(sched: MaintenanceSchedule, now: datetime) -> dict:
    days_since = int((now - sched.last_completed).total_seconds() / 86400) if sched.last_completed else None
    days_until_due = int((sched.next_due - now).total_seconds() / 86400) if sched.next_due else None

    if sched.last_completed is None:
        state = "urgent"
    else:
        overdue = (days_since or 0) - sched.interval_days
        if overdue >= 3:
            state = "urgent"
        elif overdue >= 0:
            state = "overdue"
        elif overdue >= -1:
            state = "due_soon"
        else:
            state = "good"

    recommendation = None
    if state in ("urgent", "overdue") and days_since is not None:
        recommendation = f"Last done {days_since} days ago. Due every {sched.interval_days} days."
    elif state == "due_soon":
        recommendation = "Due today or tomorrow."

    return {
        "state": state,
        "days_since": days_since,
        "days_until_due": days_until_due,
        "recommendation": recommendation,
    }


def _serialize_task(sched: MaintenanceSchedule, now: datetime) -> dict:
    info = _task_state(sched, now)
    return {
        "task_type": sched.task_type,
        "display_name": sched.display_name,
        "state": info["state"],
        "priority": sched.priority,
        "icon": sched.icon or "📋",
        "interval_days": sched.interval_days,
        "last_completed": sched.last_completed.isoformat() if sched.last_completed else None,
        "next_due": sched.next_due.isoformat() if sched.next_due else None,
        "days_since": info["days_since"],
        "days_until_due": info["days_until_due"],
        "recommendation": info["recommendation"],
        "enabled": sched.enabled,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status")
async def ha_status(db: AsyncSession = Depends(get_db)):
    """Combined status for efficient Home Assistant polling.

    Returns pool status, health score, maintenance summary, and latest sensor
    data in a single request — ideal for a HA coordinator's update interval.
    """
    now = datetime.now(timezone.utc)

    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool_cfg = pool_result.scalar_one_or_none()

    obs_result = await db.execute(
        select(PoolObservation).order_by(desc(PoolObservation.observed_at)).limit(1)
    )
    latest_obs = obs_result.scalar_one_or_none()

    sched_result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.enabled == True)
    )
    schedules = sched_result.scalars().all()
    counts = {"urgent": 0, "overdue": 0, "due_soon": 0, "good": 0}
    for s in schedules:
        counts[_task_state(s, now)["state"]] += 1

    temp_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_type == "pool_temp")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    temp = temp_result.scalar_one_or_none()

    pump_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_type == "pump_state")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    pump = pump_result.scalar_one_or_none()

    return {
        "pool_status": pool_cfg.pool_status if pool_cfg else "open",
        "pool_name": pool_cfg.name if pool_cfg else "My Pool",
        "pool_opened_at": pool_cfg.pool_opened_at.isoformat() if pool_cfg and pool_cfg.pool_opened_at else None,
        "pool_closed_at": pool_cfg.pool_closed_at.isoformat() if pool_cfg and pool_cfg.pool_closed_at else None,
        "health_score": latest_obs.health_score if latest_obs else None,
        "health_label": _HEALTH_LABELS.get(latest_obs.health_score) if latest_obs else None,
        "maintenance_summary": {
            "urgent_count": counts["urgent"],
            "overdue_count": counts["overdue"],
            "due_soon_count": counts["due_soon"],
            "good_count": counts["good"],
            "total_enabled": len(schedules),
        },
        "pool_temp_f": temp.value if temp else None,
        "pump_state": ("on" if pump.value == 1 else "off") if pump else None,
        "last_updated": now.isoformat(),
    }


@router.get("/maintenance")
async def ha_maintenance_list(db: AsyncSession = Depends(get_db)):
    """All maintenance tasks with HA sensor-friendly attributes.

    Each task's `state` field maps directly to a HA sensor state:
    urgent | overdue | due_soon | good
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(select(MaintenanceSchedule))
    return [_serialize_task(s, now) for s in result.scalars().all()]


@router.get("/maintenance/{task_type}")
async def ha_maintenance_task(task_type: str, db: AsyncSession = Depends(get_db)):
    """Single maintenance task status."""
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.task_type == task_type)
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail=f"Task '{task_type}' not found")
    return _serialize_task(sched, now)


@router.post("/maintenance/{task_type}/complete")
async def ha_complete_task(
    task_type: str,
    body: Optional[CompleteTaskRequest] = Body(None),
    db: AsyncSession = Depends(get_db),
):
    """Mark a maintenance task as complete from Home Assistant.

    Creates an appropriate journal entry and advances the schedule:
    - Action tasks (clean_cartridge, backwash, etc.) → MaintenanceAction record
    - Status tasks (clean_skimmer, robot_run, etc.) → QuickStatus record
    - Chemistry/chemical tasks (test_water, add_chlorine, etc.) → note entry
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.task_type == task_type)
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail=f"Task '{task_type}' not found")

    notes_text = body.notes if body and body.notes else None
    ha_note = f"Completed via Home Assistant{': ' + notes_text if notes_text else ''}"
    action_cfg = _COMPLETE_MAP.get(task_type)

    if action_cfg and action_cfg["type"] == "maintenance":
        entry = JournalEntry(entry_type="maintenance", entry_date=now, notes=ha_note)
        db.add(entry)
        await db.flush()
        db.add(MaintenanceAction(
            journal_entry_id=entry.id, performed_at=now,
            action_type=action_cfg["action_type"], notes=ha_note,
        ))
        await db.flush()
    elif action_cfg and action_cfg["type"] == "quick_status":
        entry = JournalEntry(entry_type="quick_status", entry_date=now, notes=ha_note)
        db.add(entry)
        await db.flush()
        db.add(QuickStatus(
            journal_entry_id=entry.id, logged_at=now,
            status_type=action_cfg["status_type"],
        ))
        await db.flush()
    else:
        entry = JournalEntry(entry_type="note", entry_date=now, notes=ha_note)
        db.add(entry)
        await db.flush()

    await update_schedule_completion(db, task_type, now)
    await db.commit()
    await db.refresh(sched)

    return {
        "task_type": task_type,
        "status": "completed",
        "completed_at": now.isoformat(),
        "next_due": sched.next_due.isoformat() if sched.next_due else None,
    }


@router.post("/maintenance/{task_type}/dismiss")
async def ha_dismiss_task(task_type: str, db: AsyncSession = Depends(get_db)):
    """Dismiss/skip a maintenance task from Home Assistant.

    Resets the schedule clock without creating a journal entry.
    Use when you want to postpone a reminder without logging the task as done.
    """
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.task_type == task_type)
    )
    sched = result.scalar_one_or_none()
    if not sched:
        raise HTTPException(status_code=404, detail=f"Task '{task_type}' not found")

    await update_schedule_completion(db, task_type, now)
    await db.commit()
    await db.refresh(sched)

    return {
        "task_type": task_type,
        "status": "dismissed",
        "dismissed_at": now.isoformat(),
        "next_due": sched.next_due.isoformat() if sched.next_due else None,
    }


@router.post("/sensor")
async def ha_push_sensor(body: SensorPushRequest, db: AsyncSession = Depends(get_db)):
    """Push a sensor reading from Home Assistant to Pooly.

    Stores pool temperature, pump state, or pump energy data so it appears
    on the Pooly dashboard. Call this from a HA automation whenever the
    relevant entity state changes.
    """
    valid_types = {"pool_temp", "pump_state", "pump_energy"}
    if body.sensor_type not in valid_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sensor_type. Must be one of: {', '.join(sorted(valid_types))}",
        )

    now = datetime.now(timezone.utc)
    db.add(SensorReading(
        sensor_type=body.sensor_type,
        value=body.value,
        unit=body.unit,
        source=body.entity_id,
        read_at=now,
    ))
    await db.commit()

    return {
        "sensor_type": body.sensor_type,
        "value": body.value,
        "status": "recorded",
        "read_at": now.isoformat(),
    }
