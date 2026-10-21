"""Settings / pool configuration schemas."""

from typing import Optional
from pydantic import BaseModel


class PoolConfigUpdate(BaseModel):
    name: Optional[str] = None
    shape: Optional[str] = None
    length_ft: Optional[float] = None
    width_ft: Optional[float] = None
    depth_ft: Optional[float] = None
    volume_gallons: Optional[int] = None
    pool_type: Optional[str] = None
    surface_type: Optional[str] = None
    sanitizer_type: Optional[str] = None
    filter_type: Optional[str] = None
    notes: Optional[str] = None
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None


class PoolConfigResponse(BaseModel):
    id: int
    name: str
    shape: Optional[str] = None
    length_ft: Optional[float] = None
    width_ft: Optional[float] = None
    depth_ft: Optional[float] = None
    volume_gallons: Optional[int] = None
    pool_type: Optional[str] = None
    surface_type: Optional[str] = None
    sanitizer_type: Optional[str] = None
    filter_type: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class MaintenanceScheduleUpdate(BaseModel):
    interval_days: Optional[int] = None
    enabled: Optional[bool] = None
    priority: Optional[str] = None


class MaintenanceScheduleResponse(BaseModel):
    id: int
    task_type: str
    display_name: str
    interval_days: int
    last_completed: Optional[str] = None
    next_due: Optional[str] = None
    priority: str
    enabled: bool
    icon: Optional[str] = None

    class Config:
        from_attributes = True


class AppSettingsResponse(BaseModel):
    pool: PoolConfigResponse
    schedules: list[MaintenanceScheduleResponse]
    ha_enabled: bool
    weather_enabled: bool
    pin_enabled: bool
