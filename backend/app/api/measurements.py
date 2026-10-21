"""Measurement quick-add endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import JournalEntry, Measurement, PoolConfig
from app.models.treatment_plan import TreatmentPlan
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
        algae_level=data.algae_level,
        notes=data.notes,
    )
    db.add(meas)
    await db.flush()

    await update_schedule_completion(db, "test_water", entry_dt)
    if data.cyanuric_acid is not None:
        await update_schedule_completion(db, "check_cya", entry_dt)

    # If a SLAM treatment plan is actively running for this pool, link this test to it
    # and let the SLAM engine recompute the next step from this new reading.
    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool_config = pool_result.scalar_one_or_none()
    if pool_config:
        plan_result = await db.execute(
            select(TreatmentPlan)
            .where(TreatmentPlan.pool_config_id == pool_config.id)
            .where(TreatmentPlan.status == "active")
            .where(TreatmentPlan.method == "slam")
        )
        active_slam_plan = plan_result.scalar_one_or_none()
        if active_slam_plan:
            from sqlalchemy.orm import selectinload
            from app.api.treatment_plans import reevaluate_slam_plan

            meas.treatment_plan_id = active_slam_plan.id
            reload_result = await db.execute(
                select(TreatmentPlan)
                .where(TreatmentPlan.id == active_slam_plan.id)
                .options(selectinload(TreatmentPlan.steps))
            )
            active_slam_plan = reload_result.scalar_one()
            await reevaluate_slam_plan(db, active_slam_plan, meas)

    await db.commit()
    await db.refresh(meas)
    return meas


@router.get("/chemistry-config")
async def get_chemistry_config():
    """Return chemistry range definitions for the frontend."""
    return CHEMISTRY_RANGES
