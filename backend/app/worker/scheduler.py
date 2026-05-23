"""Background worker — polls HA sensors, weather, and sends reminder notifications."""

import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.database import async_session
from app.models import SensorReading, WeatherSnapshot
from app.services.home_assistant import get_pool_temperature, get_pump_state, get_pump_energy, send_ha_notification
from app.services.weather import fetch_weather
from app.services.reminders import auto_update_schedules, compute_reminders, ensure_default_schedules
from app.config import settings


async def poll_sensors():
    """Poll Home Assistant sensors and store readings."""
    if not settings.ha_enabled:
        return

    now = datetime.now(timezone.utc)
    async with async_session() as db:
        temp = await get_pool_temperature()
        if temp is not None:
            db.add(SensorReading(read_at=now, sensor_type="pool_temp", value=temp, unit="°F", source=settings.HA_TEMP_ENTITY))

        state = await get_pump_state()
        if state is not None:
            db.add(SensorReading(read_at=now, sensor_type="pump_state", value=1.0 if state == "on" else 0.0, unit="state", source=settings.HA_PUMP_ENTITY))

        energy = await get_pump_energy()
        if energy is not None:
            db.add(SensorReading(read_at=now, sensor_type="pump_energy", value=energy, unit="kWh", source=settings.HA_PUMP_ENERGY_ENTITY))

        await db.commit()
    print(f"[Worker] Sensors polled at {now.isoformat()}")


async def poll_weather():
    """Fetch weather data and store snapshot."""
    if not settings.weather_enabled:
        return

    now = datetime.now(timezone.utc)
    data = await fetch_weather()
    if data:
        async with async_session() as db:
            db.add(WeatherSnapshot(
                fetched_at=now,
                air_temp_f=data.get("air_temp_f"),
                humidity=data.get("humidity"),
                uv_index=data.get("uv_index"),
                condition=data.get("condition"),
                icon=data.get("icon"),
                wind_speed=data.get("wind_speed"),
                forecast_data=data.get("forecast"),
            ))
            await db.commit()
        print(f"[Worker] Weather fetched at {now.isoformat()}")


async def check_reminders():
    """Update schedules and send HA notifications for urgent items."""
    async with async_session() as db:
        await auto_update_schedules(db)
        reminders = await compute_reminders(db)

    urgent = [r for r in reminders if r["urgency"] in ("urgent", "overdue")]
    if urgent and settings.ha_enabled:
        lines = []
        for r in urgent[:5]:
            icon = r["icon"]
            name = r["display_name"]
            days = r["days_since"]
            if days is not None:
                lines.append(f"{icon} {name} — {days}d ago")
            else:
                lines.append(f"{icon} {name} — never done")

        message = "\\n".join(lines)
        await send_ha_notification("🏊 Pool Maintenance Due", message)
        print(f"[Worker] Sent reminder notification for {len(urgent)} items")


async def main():
    """Worker entry point."""
    # Wait for DB to be ready
    await asyncio.sleep(5)

    # Ensure defaults
    async with async_session() as db:
        await ensure_default_schedules(db)

    scheduler = AsyncIOScheduler()
    scheduler.add_job(poll_sensors, "interval", minutes=5, id="poll_sensors")
    scheduler.add_job(poll_weather, "interval", minutes=30, id="poll_weather")
    scheduler.add_job(check_reminders, "interval", hours=6, id="check_reminders")

    scheduler.start()
    print("[Worker] Scheduler started")

    # Run initial polls
    await poll_sensors()
    await poll_weather()

    # Keep running
    try:
        while True:
            await asyncio.sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
