"""Treatment plan API — generate and track ordered pool remediation plans."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import PoolConfig, Measurement, PoolObservation, ChemicalInventoryItem, JournalEntry
from app.models.treatment_plan import TreatmentPlan, TreatmentStep
from app.models.sensor import WeatherSnapshot
from app.schemas.treatment_plan import (
    TreatmentPlanResponse, GeneratePlanRequest, CompleteStepRequest,
    OcltEveningRequest, OcltMorningRequest,
)
from app.services.treatment_plan import generate_plan, annotate_with_weather
from app.services import slam as slam_service
from app.services.weather import parse_daily_forecast

router = APIRouter(prefix="/api/treatment-plans", tags=["treatment-plans"])

CHEMISTRY_PARAMS = ["ph", "free_chlorine", "total_chlorine", "alkalinity",
                    "cyanuric_acid", "calcium_hardness", "bromine"]


async def _fetch_daily_forecast(db: AsyncSession) -> list:
    """Return the latest stored 5-day daily forecast, or empty list if unavailable."""
    result = await db.execute(
        select(WeatherSnapshot).order_by(desc(WeatherSnapshot.fetched_at)).limit(1)
    )
    snap = result.scalar_one_or_none()
    if snap and snap.forecast_data:
        return parse_daily_forecast(snap.forecast_data)
    return []


def _plan_to_response(plan: TreatmentPlan, daily_forecast: list = []) -> dict:
    steps = sorted(plan.steps, key=lambda s: s.step_order)

    # Build step dicts then annotate with weather notes
    step_dicts = [
        {
            "id": s.id,
            "plan_id": s.plan_id,
            "step_order": s.step_order,
            "title": s.title,
            "description": s.description,
            "action_type": s.action_type,
            "product_id": s.product_id,
            "product_name": s.product_name,
            "amount": s.amount,
            "unit": s.unit,
            "bags_needed": s.bags_needed,
            "wait_hours_after": s.wait_hours_after,
            "why": s.why,
            "safety_notes": s.safety_notes,
            "alternative_products": s.alternative_products or [],
            "is_completed": s.is_completed,
            "completed_at": s.completed_at,
            "user_notes": s.user_notes,
            "weather_note": None,
        }
        for s in steps
    ]
    annotate_with_weather(step_dicts, daily_forecast)

    return {
        "id": plan.id,
        "pool_config_id": plan.pool_config_id,
        "plan_type": plan.plan_type,
        "status": plan.status,
        "method": plan.method,
        "condition_label": plan.condition_label,
        "estimated_days": plan.estimated_days,
        "measurement_snapshot": plan.measurement_snapshot,
        "slam_state": plan.slam_state,
        "pool_gallons": plan.pool_gallons,
        "notes": plan.notes,
        "created_at": plan.created_at,
        "completed_at": plan.completed_at,
        "weather_forecast": daily_forecast,
        "steps": step_dicts,
        "steps_total": len(step_dicts),
        "steps_completed": sum(1 for s in step_dicts if s["is_completed"]),
    }


@router.post("/generate")
async def generate_treatment_plan(
    data: GeneratePlanRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate a new treatment plan from current pool state."""
    # Load pool config
    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool_config = pool_result.scalar_one_or_none()
    if not pool_config:
        raise HTTPException(status_code=400, detail="Pool configuration not found. Set up your pool first.")

    pool_config_dict = {
        "volume_gallons": pool_config.volume_gallons or 10000,
        "filter_type": pool_config.filter_type or "cartridge",
        "pool_type": pool_config.pool_type,
        "surface_type": pool_config.surface_type,
    }

    # Load latest measurement
    meas_result = await db.execute(
        select(Measurement).order_by(desc(Measurement.measured_at)).limit(1)
    )
    latest_meas = meas_result.scalar_one_or_none()

    measurements: dict = {}
    water_clarity = None
    algae_level = data.algae_level

    if latest_meas:
        for param in CHEMISTRY_PARAMS:
            val = getattr(latest_meas, param, None)
            if val is not None:
                measurements[param] = val
        water_clarity = latest_meas.water_clarity
        if algae_level is None and latest_meas.algae_level:
            algae_level = latest_meas.algae_level

    # Load latest health observation
    obs_result = await db.execute(
        select(PoolObservation).order_by(desc(PoolObservation.observed_at)).limit(1)
    )
    latest_obs = obs_result.scalar_one_or_none()
    health_score = latest_obs.health_score if latest_obs else None

    # Load chemical inventory
    inv_result = await db.execute(
        select(ChemicalInventoryItem).where(
            ChemicalInventoryItem.pool_config_id == pool_config.id
        )
    )
    inventory = [
        {"product_id": i.product_id, "quantity": i.quantity, "unit": i.unit}
        for i in inv_result.scalars().all()
    ]

    # Generate plan (also classifies condition, used to decide fixed vs. SLAM below)
    plan_data = generate_plan(
        measurements=measurements,
        pool_config=pool_config_dict,
        algae_level=algae_level,
        water_clarity=water_clarity,
        health_score=health_score,
        inventory=inventory,
    )

    condition = plan_data["condition"]
    use_slam = data.method == "slam" and condition in ("algae_moderate", "algae_severe")
    slam_state = None

    if use_slam:
        slam_steps, slam_state = slam_service.initial_slam_steps(
            measurements, algae_level,
            pool_gal=float(pool_config_dict["volume_gallons"]),
            inventory=inventory,
            water_clarity=water_clarity,
        )
        plan_data["steps"] = slam_steps
        plan_data["plan_type"] = "algae_slam"
        plan_data["estimated_days"] = plan_data["estimated_days"] or 5

    # Mark any existing active plans for this pool as cancelled
    existing_active = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.pool_config_id == pool_config.id)
        .where(TreatmentPlan.status == "active")
    )
    for old_plan in existing_active.scalars().all():
        old_plan.status = "cancelled"
    await db.flush()

    # Save new plan
    snapshot = {k: measurements.get(k) for k in CHEMISTRY_PARAMS}
    snapshot["water_clarity"] = water_clarity
    snapshot["algae_level"] = algae_level

    plan = TreatmentPlan(
        pool_config_id=pool_config.id,
        plan_type=plan_data["plan_type"],
        status="active",
        method="slam" if use_slam else "fixed",
        condition_label=plan_data["condition_label"],
        estimated_days=plan_data["estimated_days"],
        measurement_snapshot=snapshot,
        slam_state=slam_state,
        pool_gallons=plan_data["pool_gallons"],
        notes=data.notes,
    )
    db.add(plan)
    await db.flush()

    for step_data in plan_data["steps"]:
        step = TreatmentStep(
            plan_id=plan.id,
            step_order=step_data["step_order"],
            title=step_data["title"],
            description=step_data.get("description"),
            action_type=step_data["action_type"],
            product_id=step_data.get("product_id"),
            product_name=step_data.get("product_name"),
            amount=step_data.get("amount"),
            unit=step_data.get("unit"),
            bags_needed=step_data.get("bags_needed"),
            wait_hours_after=step_data.get("wait_hours_after"),
            why=step_data.get("why"),
            safety_notes=step_data.get("safety_notes"),
            alternative_products=step_data.get("alternative_products"),
        )
        db.add(step)

    await db.commit()

    # Reload with steps and fetch weather
    reload_result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan.id)
        .options(selectinload(TreatmentPlan.steps))
    )
    plan = reload_result.scalar_one()
    daily_forecast = await _fetch_daily_forecast(db)
    return _plan_to_response(plan, daily_forecast)


@router.get("")
async def list_treatment_plans(db: AsyncSession = Depends(get_db)):
    pool_result = await db.execute(select(PoolConfig).limit(1))
    pool_config = pool_result.scalar_one_or_none()
    if not pool_config:
        return []

    result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.pool_config_id == pool_config.id)
        .options(selectinload(TreatmentPlan.steps))
        .order_by(desc(TreatmentPlan.created_at))
        .limit(20)
    )
    plans = result.scalars().all()
    daily_forecast = await _fetch_daily_forecast(db)
    return [_plan_to_response(p, daily_forecast) for p in plans]


@router.get("/{plan_id}")
async def get_treatment_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan_id)
        .options(selectinload(TreatmentPlan.steps))
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    daily_forecast = await _fetch_daily_forecast(db)
    return _plan_to_response(plan, daily_forecast)


@router.patch("/{plan_id}/steps/{step_id}")
async def complete_step(
    plan_id: int,
    step_id: int,
    data: CompleteStepRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TreatmentStep).where(
            TreatmentStep.id == step_id,
            TreatmentStep.plan_id == plan_id,
        )
    )
    step = result.scalar_one_or_none()
    if not step:
        raise HTTPException(status_code=404, detail="Step not found")

    step.is_completed = data.is_completed
    step.completed_at = datetime.now(timezone.utc) if data.is_completed else None
    if data.user_notes is not None:
        step.user_notes = data.user_notes

    # Check if all steps are now complete
    plan_result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan_id)
        .options(selectinload(TreatmentPlan.steps))
    )
    plan = plan_result.scalar_one()
    if all(s.is_completed for s in plan.steps):
        if plan.method == "slam":
            # SLAM plans are retest-driven — finishing every known step just means we've
            # caught up to the last measurement, not that treatment is done. Re-run the
            # engine against the latest test so there's always a next step to show,
            # instead of closing out the plan out from under the user.
            meas_result = await db.execute(
                select(Measurement).order_by(desc(Measurement.measured_at)).limit(1)
            )
            latest_meas = meas_result.scalar_one_or_none()
            await reevaluate_slam_plan(db, plan, latest_meas)
        else:
            plan.status = "completed"
            plan.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(step)

    daily_forecast = await _fetch_daily_forecast(db)
    return _plan_to_response(plan, daily_forecast)


@router.post("/{plan_id}/cancel")
async def cancel_plan(plan_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan_id)
        .options(selectinload(TreatmentPlan.steps))
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    plan.status = "cancelled"
    await db.commit()
    daily_forecast = await _fetch_daily_forecast(db)
    return _plan_to_response(plan, daily_forecast)


# ─── SLAM ──────────────────────────────────────────────────────────────────

def _measurements_dict(latest_meas: Measurement | None) -> dict:
    measurements: dict = {}
    if latest_meas:
        for param in CHEMISTRY_PARAMS:
            val = getattr(latest_meas, param, None)
            if val is not None:
                measurements[param] = val
    return measurements


async def _load_active_slam_plan(db: AsyncSession, plan_id: int) -> TreatmentPlan:
    result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan_id)
        .options(selectinload(TreatmentPlan.steps))
    )
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")
    if plan.method != "slam":
        raise HTTPException(status_code=400, detail="This plan is not a SLAM plan")
    if plan.status != "active":
        raise HTTPException(status_code=400, detail="This plan is not active")
    return plan


def _append_steps(plan: TreatmentPlan, step_dicts: list[dict]) -> None:
    next_order = (max((s.step_order for s in plan.steps), default=0)) + 1
    for i, step_data in enumerate(step_dicts):
        step = TreatmentStep(
            plan_id=plan.id,
            step_order=next_order + i,
            title=step_data["title"],
            description=step_data.get("description"),
            action_type=step_data["action_type"],
            product_id=step_data.get("product_id"),
            product_name=step_data.get("product_name"),
            amount=step_data.get("amount"),
            unit=step_data.get("unit"),
            bags_needed=step_data.get("bags_needed"),
            wait_hours_after=step_data.get("wait_hours_after"),
            why=step_data.get("why"),
            safety_notes=step_data.get("safety_notes"),
            alternative_products=step_data.get("alternative_products"),
        )
        plan.steps.append(step)


async def reevaluate_slam_plan(db: AsyncSession, plan: TreatmentPlan, latest_meas: Measurement | None) -> None:
    """Shared SLAM re-evaluation logic — called from the /slam/reevaluate endpoint and from
    POST /api/measurements whenever a new test is logged while a SLAM plan is active."""
    pool_result = await db.execute(select(PoolConfig).where(PoolConfig.id == plan.pool_config_id))
    pool_config = pool_result.scalar_one_or_none()
    pool_gal = float(pool_config.volume_gallons or 10000) if pool_config else 10000.0

    inv_result = await db.execute(
        select(ChemicalInventoryItem).where(ChemicalInventoryItem.pool_config_id == plan.pool_config_id)
    )
    inventory = [
        {"product_id": i.product_id, "quantity": i.quantity, "unit": i.unit}
        for i in inv_result.scalars().all()
    ]

    measurements = _measurements_dict(latest_meas)
    water_clarity = latest_meas.water_clarity if latest_meas else None
    algae_level = latest_meas.algae_level if latest_meas else None

    next_order = (max((s.step_order for s in plan.steps), default=0)) + 1
    result = slam_service.evaluate_slam(
        plan_slam_state=plan.slam_state or {},
        measurements=measurements,
        water_clarity=water_clarity,
        algae_level=algae_level,
        pool_gal=pool_gal,
        inventory=inventory,
        next_order=next_order,
    )
    plan.slam_state = result["slam_state"]
    _append_steps(plan, result["steps"])
    if result["plan_completed"]:
        plan.status = "completed"
        plan.completed_at = datetime.now(timezone.utc)


@router.post("/{plan_id}/slam/reevaluate")
async def reevaluate_slam(plan_id: int, db: AsyncSession = Depends(get_db)):
    """Recompute the next SLAM step(s) from the latest water test."""
    plan = await _load_active_slam_plan(db, plan_id)

    meas_result = await db.execute(
        select(Measurement).order_by(desc(Measurement.measured_at)).limit(1)
    )
    latest_meas = meas_result.scalar_one_or_none()

    await reevaluate_slam_plan(db, plan, latest_meas)
    await db.commit()

    reload_result = await db.execute(
        select(TreatmentPlan).where(TreatmentPlan.id == plan.id).options(selectinload(TreatmentPlan.steps))
    )
    plan = reload_result.scalar_one()
    daily_forecast = await _fetch_daily_forecast(db)
    return _plan_to_response(plan, daily_forecast)


@router.post("/{plan_id}/slam/oclt/evening")
async def log_oclt_evening(plan_id: int, data: OcltEveningRequest, db: AsyncSession = Depends(get_db)):
    """Log the evening FC reading that starts the Overnight Chlorine Loss Test."""
    plan = await _load_active_slam_plan(db, plan_id)

    now = datetime.now(timezone.utc)
    entry = JournalEntry(entry_type="measurement", entry_date=now, notes="SLAM OCLT — evening reading")
    db.add(entry)
    await db.flush()
    meas = Measurement(
        journal_entry_id=entry.id,
        measured_at=now,
        free_chlorine=data.free_chlorine,
        treatment_plan_id=plan.id,
    )
    db.add(meas)
    await db.flush()

    next_order = (max((s.step_order for s in plan.steps), default=0)) + 1
    result = slam_service.start_oclt_evening(plan.slam_state or {}, data.free_chlorine, next_order)
    plan.slam_state = result["slam_state"]
    _append_steps(plan, result["steps"])

    await db.commit()

    reload_result = await db.execute(
        select(TreatmentPlan).where(TreatmentPlan.id == plan.id).options(selectinload(TreatmentPlan.steps))
    )
    plan = reload_result.scalar_one()
    daily_forecast = await _fetch_daily_forecast(db)
    return _plan_to_response(plan, daily_forecast)


@router.post("/{plan_id}/slam/oclt/morning")
async def log_oclt_morning(plan_id: int, data: OcltMorningRequest, db: AsyncSession = Depends(get_db)):
    """Log the morning FC reading, score the OCLT, and advance the plan accordingly."""
    plan = await _load_active_slam_plan(db, plan_id)

    oclt_state = (plan.slam_state or {}).get("oclt") or {}
    if oclt_state.get("status") != "evening_logged":
        raise HTTPException(status_code=400, detail="No evening OCLT reading has been logged yet")

    now = datetime.now(timezone.utc)
    entry = JournalEntry(entry_type="measurement", entry_date=now, notes="SLAM OCLT — morning reading")
    db.add(entry)
    await db.flush()
    meas = Measurement(
        journal_entry_id=entry.id,
        measured_at=now,
        free_chlorine=data.free_chlorine,
        treatment_plan_id=plan.id,
    )
    db.add(meas)
    await db.flush()

    # Latest full water test (for CC / clarity / algae) — falls back to the pool's latest measurement
    meas_result = await db.execute(
        select(Measurement)
        .where(Measurement.treatment_plan_id == plan.id)
        .order_by(desc(Measurement.measured_at))
    )
    recent = meas_result.scalars().all()
    latest_full = next((m for m in recent if m.total_chlorine is not None), None)
    cc = max(0, (latest_full.total_chlorine - latest_full.free_chlorine)) if latest_full else 0.0
    water_clarity = latest_full.water_clarity if latest_full else None
    algae_level = latest_full.algae_level if latest_full else None

    next_order = (max((s.step_order for s in plan.steps), default=0)) + 1
    result = slam_service.complete_oclt_morning(
        plan.slam_state or {}, data.free_chlorine, cc, water_clarity, algae_level, next_order
    )
    plan.slam_state = result["slam_state"]
    _append_steps(plan, result["steps"])
    if result["plan_completed"]:
        plan.status = "completed"
        plan.completed_at = now

    await db.commit()

    reload_result = await db.execute(
        select(TreatmentPlan).where(TreatmentPlan.id == plan.id).options(selectinload(TreatmentPlan.steps))
    )
    plan = reload_result.scalar_one()
    daily_forecast = await _fetch_daily_forecast(db)
    response = _plan_to_response(plan, daily_forecast)
    response["oclt_result"] = {"passed": result["passed"], "loss": result["loss"]}
    return response
