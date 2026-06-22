"""Treatment plan API — generate and track ordered pool remediation plans."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import PoolConfig, Measurement, PoolObservation, ChemicalInventoryItem
from app.models.treatment_plan import TreatmentPlan, TreatmentStep
from app.schemas.treatment_plan import (
    TreatmentPlanResponse, GeneratePlanRequest, CompleteStepRequest
)
from app.services.treatment_plan import generate_plan

router = APIRouter(prefix="/api/treatment-plans", tags=["treatment-plans"])

CHEMISTRY_PARAMS = ["ph", "free_chlorine", "total_chlorine", "alkalinity",
                    "cyanuric_acid", "calcium_hardness", "bromine"]


def _plan_to_response(plan: TreatmentPlan) -> dict:
    steps = sorted(plan.steps, key=lambda s: s.step_order)
    return {
        "id": plan.id,
        "pool_config_id": plan.pool_config_id,
        "plan_type": plan.plan_type,
        "status": plan.status,
        "condition_label": plan.condition_label,
        "estimated_days": plan.estimated_days,
        "measurement_snapshot": plan.measurement_snapshot,
        "pool_gallons": plan.pool_gallons,
        "notes": plan.notes,
        "created_at": plan.created_at,
        "completed_at": plan.completed_at,
        "steps": [
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
            }
            for s in steps
        ],
        "steps_total": len(steps),
        "steps_completed": sum(1 for s in steps if s.is_completed),
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
        # Use measurement's algae_level if not overridden in request
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

    # Generate plan
    plan_data = generate_plan(
        measurements=measurements,
        pool_config=pool_config_dict,
        algae_level=algae_level,
        water_clarity=water_clarity,
        health_score=health_score,
        inventory=inventory,
    )

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
        condition_label=plan_data["condition_label"],
        estimated_days=plan_data["estimated_days"],
        measurement_snapshot=snapshot,
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

    # Reload with steps
    reload_result = await db.execute(
        select(TreatmentPlan)
        .where(TreatmentPlan.id == plan.id)
        .options(selectinload(TreatmentPlan.steps))
    )
    plan = reload_result.scalar_one()
    return _plan_to_response(plan)


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
    return [_plan_to_response(p) for p in plans]


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
    return _plan_to_response(plan)


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
        plan.status = "completed"
        plan.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(step)

    return _plan_to_response(plan)


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
    return _plan_to_response(plan)
