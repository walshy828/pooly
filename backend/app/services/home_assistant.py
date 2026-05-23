"""Home Assistant REST API client for polling sensor data."""

import httpx
from typing import Optional
from app.config import settings


async def _ha_get(entity_id: str) -> Optional[dict]:
    if not settings.ha_enabled or not entity_id:
        return None
    url = f"{settings.HA_URL}/api/states/{entity_id}"
    headers = {"Authorization": f"Bearer {settings.HA_TOKEN}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"[HA] Error fetching {entity_id}: {e}")
        return None


async def get_pool_temperature() -> Optional[float]:
    data = await _ha_get(settings.HA_TEMP_ENTITY)
    if data and data.get("state") not in (None, "unavailable", "unknown"):
        try:
            return float(data["state"])
        except (ValueError, TypeError):
            return None
    return None


async def get_pump_state() -> Optional[str]:
    data = await _ha_get(settings.HA_PUMP_ENTITY)
    if data and data.get("state") not in (None, "unavailable", "unknown"):
        return data["state"]
    return None


async def get_pump_energy() -> Optional[float]:
    data = await _ha_get(settings.HA_PUMP_ENERGY_ENTITY)
    if data and data.get("state") not in (None, "unavailable", "unknown"):
        try:
            return float(data["state"])
        except (ValueError, TypeError):
            return None
    return None


async def send_ha_notification(title: str, message: str) -> bool:
    if not settings.ha_enabled:
        return False
    url = f"{settings.HA_URL}/api/services/notify/notify"
    headers = {"Authorization": f"Bearer {settings.HA_TOKEN}", "Content-Type": "application/json"}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, headers=headers, json={"title": title, "message": message})
            resp.raise_for_status()
            return True
    except Exception as e:
        print(f"[HA] Notification error: {e}")
        return False
