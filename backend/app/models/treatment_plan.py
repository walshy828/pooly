"""Treatment plan models — ordered step-by-step pool remediation plans."""

import enum
from datetime import datetime
from sqlalchemy import Integer, String, Float, Text, DateTime, ForeignKey, JSON, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base


class PlanType(str, enum.Enum):
    chemistry_correction = "chemistry_correction"
    algae_mild = "algae_mild"
    algae_moderate = "algae_moderate"
    algae_severe = "algae_severe"
    maintenance = "maintenance"


class PlanStatus(str, enum.Enum):
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class ActionType(str, enum.Enum):
    add_chemical = "add_chemical"
    mechanical = "mechanical"
    wait = "wait"
    test = "test"
    run_pump = "run_pump"


class TreatmentPlan(Base):
    __tablename__ = "treatment_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pool_config_id: Mapped[int] = mapped_column(ForeignKey("pool_config.id", ondelete="CASCADE"))
    plan_type: Mapped[str] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(20), default="active")
    condition_label: Mapped[str] = mapped_column(String(100))
    estimated_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    measurement_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    pool_gallons: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    steps: Mapped[list["TreatmentStep"]] = relationship(
        back_populates="plan", cascade="all, delete-orphan", order_by="TreatmentStep.step_order"
    )


class TreatmentStep(Base):
    __tablename__ = "treatment_steps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("treatment_plans.id", ondelete="CASCADE"))
    step_order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_type: Mapped[str] = mapped_column(String(30))
    product_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    product_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    amount: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(30), nullable=True)
    bags_needed: Mapped[int | None] = mapped_column(Integer, nullable=True)
    wait_hours_after: Mapped[float | None] = mapped_column(Float, nullable=True)
    why: Mapped[str | None] = mapped_column(Text, nullable=True)
    safety_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    alternative_products: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    user_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    plan: Mapped["TreatmentPlan"] = relationship(back_populates="steps")
