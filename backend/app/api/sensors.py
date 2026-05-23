"""Sensor and weather data API endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models import SensorReading, WeatherSnapshot
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api", tags=["sensors"])


@router.get("/sensors/temperature")
async def get_temperature_history(
    hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
):
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_type == "pool_temp", SensorReading.read_at >= since)
        .order_by(desc(SensorReading.read_at))
    )
    readings = result.scalars().all()
    current = readings[0].value if readings else None
    values = [r.value for r in readings] if readings else []
    return {
        "readings": [{"read_at": r.read_at.isoformat(), "value": r.value} for r in readings],
        "current": current,
        "min_24h": min(values) if values else None,
        "max_24h": max(values) if values else None,
    }


@router.get("/sensors/pump")
async def get_pump_status(db: AsyncSession = Depends(get_db)):
    state_result = await db.execute(
        select(SensorReading).where(SensorReading.sensor_type == "pump_state")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    state = state_result.scalar_one_or_none()

    energy_result = await db.execute(
        select(SensorReading).where(SensorReading.sensor_type == "pump_energy")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    energy = energy_result.scalar_one_or_none()

    return {
        "state": ("on" if state.value == 1 else "off") if state else None,
        "energy_kwh": energy.value if energy else None,
        "updated_at": state.read_at.isoformat() if state else None,
    }


@router.get("/weather")
async def get_weather(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WeatherSnapshot).order_by(desc(WeatherSnapshot.fetched_at)).limit(1)
    )
    w = result.scalar_one_or_none()
    if not w:
        return {"available": False}

    from app.services.weather import analyze_pool_impact
    weather_dict = {
        "air_temp_f": w.air_temp_f, "humidity": w.humidity, "uv_index": w.uv_index,
        "condition": w.condition, "icon": w.icon, "wind_speed": w.wind_speed,
        "forecast": w.forecast_data or [],
    }
    return {
        "available": True,
        **weather_dict,
        "pool_impact": analyze_pool_impact(weather_dict),
        "fetched_at": w.fetched_at.isoformat(),
    }
