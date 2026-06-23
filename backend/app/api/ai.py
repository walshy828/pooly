"""Optional AI (Claude) insights API.

All endpoints degrade safely when AI is disabled. The raw API key is never
returned by any response.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import PoolConfig
from app.models.treatment_plan import TreatmentPlan
from app.services import ai_insights
from app.services.dashboard import build_dashboard

router = APIRouter(prefix="/api/ai", tags=["ai"])


async def _get_pool(db: AsyncSession) -> Optional[PoolConfig]:
    result = await db.execute(select(PoolConfig).limit(1))
    return result.scalar_one_or_none()


def _status_payload(pool: Optional[PoolConfig]) -> dict:
    has_db_key = bool(pool is not None and pool.ai_api_key)
    key = ai_insights.resolve_key(pool)
    return {
        "enabled": bool(pool is not None and pool.ai_enabled),
        "available": ai_insights.ai_available(pool),
        "key_set": bool(key),
        "key_source": "db" if has_db_key else ("env" if key else None),
        "model": ai_insights.model_for(pool),
    }


@router.get("/status")
async def ai_status(db: AsyncSession = Depends(get_db)):
    return _status_payload(await _get_pool(db))


class AiSettingsUpdate(BaseModel):
    ai_enabled: Optional[bool] = None
    ai_model: Optional[str] = None
    # Omit to keep the existing key; "" clears it; a value sets a new key.
    ai_api_key: Optional[str] = None


@router.put("/settings")
async def update_ai_settings(data: AiSettingsUpdate, db: AsyncSession = Depends(get_db)):
    pool = await _get_pool(db)
    if not pool:
        raise HTTPException(status_code=404, detail="Pool configuration not found")

    if data.ai_enabled is not None:
        pool.ai_enabled = data.ai_enabled
    if data.ai_model:
        pool.ai_model = data.ai_model
    if data.ai_api_key is not None:
        pool.ai_api_key = data.ai_api_key or None

    await db.commit()
    await db.refresh(pool)
    return _status_payload(pool)


class AiTestRequest(BaseModel):
    ai_api_key: Optional[str] = None
    ai_model: Optional[str] = None


@router.post("/test")
async def test_ai(data: AiTestRequest, db: AsyncSession = Depends(get_db)):
    pool = await _get_pool(db)
    key = data.ai_api_key or ai_insights.resolve_key(pool)
    if not key:
        return {"ok": False, "message": "No API key configured"}
    model = data.ai_model or ai_insights.model_for(pool)
    ok, message = await ai_insights.test_key(key, model)
    return {"ok": ok, "message": message}


@router.post("/insights")
async def ai_insights_endpoint(db: AsyncSession = Depends(get_db)):
    pool = await _get_pool(db)
    if not ai_insights.ai_available(pool):
        raise HTTPException(status_code=409, detail="AI insights are not enabled")
    dashboard = await build_dashboard(db)
    briefing = await ai_insights.generate_briefing(pool, dashboard)
    if briefing is None:
        raise HTTPException(status_code=502, detail="AI request failed")
    return {"briefing": briefing}


class PlanRationaleRequest(BaseModel):
    plan_id: Optional[int] = None


@router.post("/plan-rationale")
async def plan_rationale(data: PlanRationaleRequest, db: AsyncSession = Depends(get_db)):
    pool = await _get_pool(db)
    if not ai_insights.ai_available(pool):
        raise HTTPException(status_code=409, detail="AI insights are not enabled")

    query = select(TreatmentPlan).options(selectinload(TreatmentPlan.steps))
    if data.plan_id is not None:
        query = query.where(TreatmentPlan.id == data.plan_id)
    else:
        query = query.where(TreatmentPlan.status == "active").order_by(desc(TreatmentPlan.created_at))
    result = await db.execute(query.limit(1))
    plan = result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Treatment plan not found")

    plan_dict = {
        "condition_label": plan.condition_label,
        "pool_gallons": plan.pool_gallons,
        "steps": [
            {
                "order": s.step_order,
                "title": s.title,
                "description": s.description,
                "amount": s.amount,
                "unit": s.unit,
                "product_name": s.product_name,
            }
            for s in sorted(plan.steps, key=lambda s: s.step_order)
        ],
    }
    enrichment = await ai_insights.enrich_plan(pool, plan_dict)
    if enrichment is None:
        raise HTTPException(status_code=502, detail="AI request failed")
    return {"plan_id": plan.id, **enrichment}
