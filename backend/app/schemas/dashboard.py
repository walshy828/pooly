"""Dashboard aggregation schemas."""

from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class ChemistryStatus(BaseModel):
    parameter: str
    value: Optional[float] = None
    status: str  # low, ideal, high
    color: str  # hex color matching test strip
    label: str
    unit: str
    measured_at: Optional[datetime] = None


class ReminderItem(BaseModel):
    task_type: str
    display_name: str
    icon: str
    urgency: str  # good, due_soon, overdue, urgent
    days_since: Optional[int] = None
    interval_days: int
    last_completed: Optional[datetime] = None
    recommendation: Optional[str] = None


class WeatherInfo(BaseModel):
    air_temp_f: Optional[float] = None
    humidity: Optional[float] = None
    uv_index: Optional[float] = None
    condition: Optional[str] = None
    icon: Optional[str] = None
    wind_speed: Optional[float] = None
    forecast: list[dict[str, Any]] = []
    pool_impact: list[str] = []


class SensorInfo(BaseModel):
    pool_temp_f: Optional[float] = None
    pool_temp_updated: Optional[datetime] = None
    pump_state: Optional[str] = None  # on, off, unknown
    pump_energy_kwh: Optional[float] = None
    pump_updated: Optional[datetime] = None


class RecommendationItem(BaseModel):
    category: str
    message: str
    severity: str  # info, warning, critical
    icon: str
    consequences: list[str] = []       # what happens if action is skipped
    impact_tags: list[str] = []        # health, cost, equipment, water
    impact_score: int = 1              # 1–3 magnitude of inaction


class DashboardResponse(BaseModel):
    health_score: Optional[int] = None
    health_label: Optional[str] = None
    health_observed_at: Optional[datetime] = None
    chemistry: list[ChemistryStatus] = []
    chemistry_age_hours: Optional[float] = None
    reminders: list[ReminderItem] = []
    weather: Optional[WeatherInfo] = None
    sensors: Optional[SensorInfo] = None
    recommendations: list[RecommendationItem] = []
    recent_entries: list[dict[str, Any]] = []
