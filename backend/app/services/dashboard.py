"""Dashboard aggregation service — pulls together all data sources for the main view."""

from datetime import datetime, timezone
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    Measurement, PoolObservation, SensorReading, WeatherSnapshot,
    JournalEntry, PoolConfig,
)
from app.services.chemistry import get_chemistry_status, get_recommendations, CHEMISTRY_RANGES
from app.services.reminders import compute_reminders


CHEMISTRY_PARAMS = ["ph", "free_chlorine", "total_chlorine", "alkalinity",
                     "cyanuric_acid", "calcium_hardness", "bromine"]


async def build_dashboard(db: AsyncSession) -> dict:
    """Build the full dashboard payload."""

    # ── Latest measurement ───────────────────────────────────────
    meas_result = await db.execute(
        select(Measurement).order_by(desc(Measurement.measured_at)).limit(1)
    )
    latest_meas = meas_result.scalar_one_or_none()

    chemistry = []
    recommendations = []
    chemistry_age_hours = None

    if latest_meas:
        now = datetime.now(timezone.utc)
        if latest_meas.measured_at.tzinfo is None:
            from datetime import timezone as tz
            meas_time = latest_meas.measured_at.replace(tzinfo=tz.utc)
        else:
            meas_time = latest_meas.measured_at
        chemistry_age_hours = (now - meas_time).total_seconds() / 3600

        meas_dict = {}
        for param in CHEMISTRY_PARAMS:
            value = getattr(latest_meas, param, None)
            status_info = get_chemistry_status(param, value)
            spec = CHEMISTRY_RANGES.get(param, {})
            chemistry.append({
                "parameter": param,
                "value": value,
                "status": status_info["status"],
                "color": status_info["color"],
                "label": status_info["label"],
                "unit": spec.get("unit", ""),
                "measured_at": latest_meas.measured_at.isoformat() if latest_meas.measured_at else None,
            })
            if value is not None:
                meas_dict[param] = value

        # Get pool volume for dosage calc
        pool_result = await db.execute(select(PoolConfig).limit(1))
        pool_config = pool_result.scalar_one_or_none()
        volume = pool_config.volume_gallons if pool_config and pool_config.volume_gallons else 17000
        recommendations = get_recommendations(meas_dict, volume)

    # ── Latest observation ───────────────────────────────────────
    obs_result = await db.execute(
        select(PoolObservation).order_by(desc(PoolObservation.observed_at)).limit(1)
    )
    latest_obs = obs_result.scalar_one_or_none()

    health_labels = {
        1: "Swamp 🐸", 2: "Very Poor", 3: "Needs Immediate Attention",
        4: "Needs Work", 5: "Cloudy", 6: "Slightly Hazy",
        7: "Okay", 8: "Looking Good", 9: "Clear",
        10: "Crystal Clear 🌊✨",
    }

    # ── Maintenance reminders ────────────────────────────────────
    reminders = await compute_reminders(db)

    # ── Latest sensor readings ───────────────────────────────────
    sensors = {"pool_temp_f": None, "pool_temp_updated": None,
               "pump_state": None, "pump_energy_kwh": None, "pump_updated": None}

    temp_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_type == "pool_temp")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    temp_reading = temp_result.scalar_one_or_none()
    if temp_reading:
        sensors["pool_temp_f"] = temp_reading.value
        sensors["pool_temp_updated"] = temp_reading.read_at.isoformat()

    pump_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_type == "pump_state")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    pump_reading = pump_result.scalar_one_or_none()
    if pump_reading:
        sensors["pump_state"] = "on" if pump_reading.value == 1 else "off"
        sensors["pump_updated"] = pump_reading.read_at.isoformat()

    energy_result = await db.execute(
        select(SensorReading)
        .where(SensorReading.sensor_type == "pump_energy")
        .order_by(desc(SensorReading.read_at)).limit(1)
    )
    energy_reading = energy_result.scalar_one_or_none()
    if energy_reading:
        sensors["pump_energy_kwh"] = energy_reading.value

    # ── Latest weather ───────────────────────────────────────────
    weather_result = await db.execute(
        select(WeatherSnapshot).order_by(desc(WeatherSnapshot.fetched_at)).limit(1)
    )
    latest_weather = weather_result.scalar_one_or_none()
    weather = None
    if latest_weather:
        from app.services.weather import analyze_pool_impact
        weather_dict = {
            "air_temp_f": latest_weather.air_temp_f,
            "humidity": latest_weather.humidity,
            "uv_index": latest_weather.uv_index,
            "condition": latest_weather.condition,
            "icon": latest_weather.icon,
            "wind_speed": latest_weather.wind_speed,
            "forecast": latest_weather.forecast_data or [],
        }
        pool_impact = analyze_pool_impact(weather_dict)
        weather = {**weather_dict, "pool_impact": pool_impact}

    # ── Recent journal entries ───────────────────────────────────
    entries_result = await db.execute(
        select(JournalEntry).order_by(desc(JournalEntry.entry_date)).limit(10)
    )
    recent_entries = []
    for entry in entries_result.scalars().all():
        recent_entries.append({
            "id": entry.id,
            "entry_type": entry.entry_type,
            "entry_date": entry.entry_date.isoformat(),
            "notes": entry.notes,
        })

    # ── Pool status ──────────────────────────────────────────────
    pool_result2 = await db.execute(select(PoolConfig).limit(1))
    pool_cfg = pool_result2.scalar_one_or_none()
    pool_status = (pool_cfg.pool_status or "open") if pool_cfg else "open"
    pool_opened_at = pool_cfg.pool_opened_at.isoformat() if pool_cfg and pool_cfg.pool_opened_at else None
    pool_closed_at = pool_cfg.pool_closed_at.isoformat() if pool_cfg and pool_cfg.pool_closed_at else None

    # Suppress reminders when pool is closed
    active_reminders = [] if pool_status == "closed" else reminders

    return {
        "pool_status": pool_status,
        "pool_opened_at": pool_opened_at,
        "pool_closed_at": pool_closed_at,
        "health_score": latest_obs.health_score if latest_obs else None,
        "health_label": health_labels.get(latest_obs.health_score, "") if latest_obs else None,
        "health_observed_at": latest_obs.observed_at.isoformat() if latest_obs else None,
        "chemistry": chemistry,
        "chemistry_age_hours": round(chemistry_age_hours, 1) if chemistry_age_hours else None,
        "reminders": active_reminders,
        "weather": weather,
        "sensors": sensors,
        "recommendations": recommendations,
        "recent_entries": recent_entries,
    }
