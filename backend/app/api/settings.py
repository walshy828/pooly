from fastapi import APIRouter, Depends, HTTPException
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import PoolConfig, MaintenanceSchedule
from app.schemas.settings import PoolConfigUpdate, MaintenanceScheduleUpdate
from app.config import settings as app_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])


def _serialize_col(obj, col):
    val = getattr(obj, col.key)
    if isinstance(val, datetime):
        return val.isoformat()
    return val


@router.get("")
async def get_settings(db: AsyncSession = Depends(get_db)):
    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool = pool_result.scalar_one_or_none()
    if not pool:
        pool = PoolConfig(name="My Pool", shape="round", length_ft=27, depth_ft=4, volume_gallons=17000)
        db.add(pool)
        await db.commit()
        await db.refresh(pool)

    sched_result = await db.execute(select(MaintenanceSchedule).order_by(MaintenanceSchedule.id))
    schedules = sched_result.scalars().all()

    # Never expose the raw AI key; report only whether one is set.
    pool_dict = {c.key: _serialize_col(pool, c) for c in pool.__table__.columns}
    pool_dict.pop("ai_api_key", None)

    return {
        "pool": pool_dict,
        "pool_status": pool.pool_status or "open",
        "pool_opened_at": pool.pool_opened_at.isoformat() if pool.pool_opened_at else None,
        "pool_closed_at": pool.pool_closed_at.isoformat() if pool.pool_closed_at else None,
        "schedules": [
            {c.key: _serialize_col(s, c) for c in s.__table__.columns}
            for s in schedules
        ],
        "ha_enabled": app_settings.ha_enabled,
        "weather_enabled": app_settings.weather_enabled,
        "pin_enabled": bool(app_settings.APP_PIN),
    }


@router.put("/pool")
async def update_pool_config(data: PoolConfigUpdate, db: AsyncSession = Depends(get_db)):
    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool = pool_result.scalar_one_or_none()
    if not pool:
        pool = PoolConfig()
        db.add(pool)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pool, field, value)

    await db.commit()
    await db.refresh(pool)
    out = {c.key: getattr(pool, c.key) for c in pool.__table__.columns}
    out.pop("ai_api_key", None)
    return out


@router.put("/schedule/{task_type}")
async def update_schedule(task_type: str, data: MaintenanceScheduleUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(MaintenanceSchedule).where(MaintenanceSchedule.task_type == task_type)
    )
    schedule = result.scalar_one_or_none()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(schedule, field, value)

    await db.commit()
    return {"status": "ok"}


@router.post("/verify-pin")
async def verify_pin(pin: str):
    if not app_settings.APP_PIN:
        return {"valid": True, "pin_required": False}
    return {"valid": pin == app_settings.APP_PIN, "pin_required": True}


@router.get("/pin-required")
async def pin_required():
    return {"pin_required": bool(app_settings.APP_PIN)}


@router.post("/pool/open")
async def open_pool(notes: str = "", db: AsyncSession = Depends(get_db)):
    """Open the pool for the season — records timestamp and creates a journal entry."""
    from app.models import JournalEntry
    from datetime import timezone
    now = datetime.now(timezone.utc)

    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool = pool_result.scalar_one_or_none()
    if not pool:
        raise HTTPException(status_code=404, detail="Pool config not found")

    pool.pool_status = "open"
    pool.pool_opened_at = now

    entry = JournalEntry(
        entry_type="pool_event",
        entry_date=now,
        notes=f"🏊 Pool opened for the season.{(' ' + notes) if notes else ''}",
    )
    db.add(entry)
    await db.commit()
    return {"status": "open", "opened_at": now.isoformat()}


@router.post("/pool/close")
async def close_pool(notes: str = "", db: AsyncSession = Depends(get_db)):
    """Close/winterize the pool — records timestamp and creates a journal entry."""
    from app.models import JournalEntry
    from datetime import timezone
    now = datetime.now(timezone.utc)

    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool = pool_result.scalar_one_or_none()
    if not pool:
        raise HTTPException(status_code=404, detail="Pool config not found")

    pool.pool_status = "closed"
    pool.pool_closed_at = now

    entry = JournalEntry(
        entry_type="pool_event",
        entry_date=now,
        notes=f"❄️ Pool closed / winterized.{(' ' + notes) if notes else ''}",
    )
    db.add(entry)
    await db.commit()
    return {"status": "closed", "closed_at": now.isoformat()}

