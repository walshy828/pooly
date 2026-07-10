"""Schemas for treatment plans, steps, and chemical inventory."""

from datetime import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel

PlanTypeStr = Literal[
    "chemistry_correction", "algae_mild", "algae_moderate", "algae_severe", "algae_slam", "maintenance"
]
PlanStatusStr = Literal["active", "completed", "cancelled"]
PlanMethodStr = Literal["fixed", "slam"]
ActionTypeStr = Literal["add_chemical", "mechanical", "wait", "test", "run_pump", "oclt_evening", "oclt_morning"]


class SlamOcltState(BaseModel):
    status: Literal["not_started", "evening_logged", "passed", "failed"] = "not_started"
    evening_fc: Optional[float] = None
    evening_logged_at: Optional[datetime] = None
    morning_fc: Optional[float] = None
    loss: Optional[float] = None


class SlamStateResponse(BaseModel):
    cya: Optional[float] = None
    target_fc: Optional[float] = None
    day_count: int = 1
    dose_count: int = 0
    last_dose_at: Optional[datetime] = None
    phase: Literal["awaiting_cya", "dosing_loop", "awaiting_oclt", "complete"] = "awaiting_cya"
    oclt: SlamOcltState = SlamOcltState()


class TreatmentStepResponse(BaseModel):
    id: int
    plan_id: int
    step_order: int
    title: str
    description: Optional[str] = None
    action_type: ActionTypeStr
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    amount: Optional[float] = None
    unit: Optional[str] = None
    bags_needed: Optional[int] = None
    wait_hours_after: Optional[float] = None
    why: Optional[str] = None
    safety_notes: Optional[str] = None
    alternative_products: Optional[list] = None
    is_completed: bool
    completed_at: Optional[datetime] = None
    user_notes: Optional[str] = None

    class Config:
        from_attributes = True


class TreatmentPlanResponse(BaseModel):
    id: int
    pool_config_id: int
    plan_type: PlanTypeStr
    status: PlanStatusStr
    method: PlanMethodStr = "fixed"
    condition_label: str
    estimated_days: Optional[int] = None
    measurement_snapshot: Optional[dict] = None
    slam_state: Optional[SlamStateResponse] = None
    pool_gallons: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    steps: list[TreatmentStepResponse] = []
    steps_total: int = 0
    steps_completed: int = 0

    class Config:
        from_attributes = True


class GeneratePlanRequest(BaseModel):
    algae_level: Optional[Literal["none", "slight", "moderate", "heavy", "swamp"]] = None
    method: PlanMethodStr = "fixed"
    notes: Optional[str] = None


class OcltEveningRequest(BaseModel):
    free_chlorine: float


class OcltMorningRequest(BaseModel):
    free_chlorine: float


class CompleteStepRequest(BaseModel):
    is_completed: bool
    user_notes: Optional[str] = None


class InventoryItemCreate(BaseModel):
    product_id: str
    quantity: float
    unit: str


class InventoryResponse(BaseModel):
    id: int
    pool_config_id: int
    product_id: str
    quantity: float
    unit: str
    updated_at: datetime
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    product_brand: Optional[str] = None

    class Config:
        from_attributes = True
