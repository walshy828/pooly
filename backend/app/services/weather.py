"""OpenWeatherMap client with pool impact analysis."""

import httpx
from datetime import datetime, timezone
from typing import Optional
from app.config import settings

# Severity order for picking the "worst" condition in a day's 3-hourly blocks
_CONDITION_SEVERITY = {
    "Thunderstorm": 4,
    "Rain": 3,
    "Drizzle": 2,
    "Snow": 1,
}


def _aggregate_daily_forecast(items: list) -> list:
    """Group 3-hourly OWM forecast items into per-day summaries."""
    by_date: dict = {}
    for item in items:
        dt = datetime.fromtimestamp(item["dt"], tz=timezone.utc)
        date_str = dt.strftime("%Y-%m-%d")
        day = by_date.setdefault(date_str, {
            "date": date_str,
            "weekday": dt.strftime("%A"),
            "weekday_short": dt.strftime("%a"),
            "condition": "Clear",
            "condition_severity": 0,
            "pop": 0.0,
            "rain_mm": 0.0,
        })
        # Track most severe condition of the day
        cond = item["weather"][0]["main"]
        sev = _CONDITION_SEVERITY.get(cond, 0)
        if sev > day["condition_severity"]:
            day["condition"] = cond
            day["condition_severity"] = sev
        # Max precipitation probability
        pop = item.get("pop", 0) or 0
        day["pop"] = max(day["pop"], pop)
        # Accumulate rain volume
        rain = item.get("rain", {}).get("3h", 0) or 0
        day["rain_mm"] += rain

    result = []
    for i, (_, day) in enumerate(sorted(by_date.items())):
        day["day_offset"] = i
        day["is_rain_day"] = (
            day["pop"] >= 0.4
            or day["condition"] in ("Rain", "Drizzle", "Thunderstorm")
        )
        day["is_heavy_rain_day"] = (
            day["pop"] >= 0.7
            or day["condition"] == "Thunderstorm"
        )
        # Remove internal severity key before storing
        day.pop("condition_severity", None)
        result.append(day)
    return result


def parse_daily_forecast(forecast_data) -> list:
    """Parse stored forecast_data JSON back into daily summary dicts.

    Handles both the legacy 3-hourly list format and the new daily-summary list.
    """
    if not forecast_data:
        return []
    # New format: list of dicts that already have 'day_offset'
    if isinstance(forecast_data, list):
        if forecast_data and isinstance(forecast_data[0], dict) and "day_offset" in forecast_data[0]:
            return forecast_data
        # Legacy: raw 3-hourly items with 'dt' key — re-aggregate
        if forecast_data and isinstance(forecast_data[0], dict) and "dt" in forecast_data[0]:
            return _aggregate_daily_forecast(forecast_data)
    return []


async def fetch_weather(lat: Optional[float] = None, lon: Optional[float] = None) -> Optional[dict]:
    """Fetch current weather + 5-day 3-hourly forecast from OpenWeatherMap."""
    use_lat = lat if lat is not None else settings.WEATHER_LAT
    use_lon = lon if lon is not None else settings.WEATHER_LON
    api_key = settings.WEATHER_API_KEY

    if not (api_key and use_lat is not None and use_lon is not None):
        return None

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Current weather
            current_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": use_lat, "lon": use_lon, "appid": api_key, "units": "imperial"},
            )
            current_resp.raise_for_status()
            current = current_resp.json()

            # UV index
            uv_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/uvi",
                params={"lat": use_lat, "lon": use_lon, "appid": api_key},
            )
            uv_index = None
            if uv_resp.status_code == 200:
                uv_index = uv_resp.json().get("value")

            # 5-day / 3-hourly forecast — all 40 items
            forecast_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": use_lat, "lon": use_lon, "appid": api_key, "units": "imperial"},
            )
            daily_forecast = []
            raw_items = []
            if forecast_resp.status_code == 200:
                raw_items = forecast_resp.json().get("list", [])
                daily_forecast = _aggregate_daily_forecast(raw_items)

            return {
                "air_temp_f": current["main"]["temp"],
                "humidity": current["main"]["humidity"],
                "uv_index": uv_index,
                "condition": current["weather"][0]["main"],
                "icon": current["weather"][0]["icon"],
                "wind_speed": current.get("wind", {}).get("speed"),
                "forecast": daily_forecast,  # 5-day daily summaries (new format)
            }
    except Exception as e:
        print(f"[Weather] Error: {e}")
        return None


def analyze_pool_impact(weather: dict) -> list[str]:
    """Generate pool-impact advice based on weather conditions."""
    impacts = []
    temp = weather.get("air_temp_f")
    uv = weather.get("uv_index")
    humidity = weather.get("humidity")
    condition = weather.get("condition", "").lower()

    if uv and uv >= 6:
        impacts.append("☀️ High UV — chlorine will degrade faster. Consider extra chlorine today.")
    if temp and temp >= 90:
        impacts.append("🌡️ Hot day — algae risk increases. Monitor chlorine levels closely.")
    if temp and temp <= 60:
        impacts.append("❄️ Cool weather — reduced chemical demand. Consider lowering chlorine dose.")
    if "rain" in condition or "storm" in condition:
        impacts.append("🌧️ Rain detected — test water after rain. pH and chlorine may drop.")
    if "thunderstorm" in condition:
        impacts.append("⛈️ Storms — delay chemical additions until weather clears.")
    if humidity and humidity >= 80:
        impacts.append("💦 High humidity — may slow evaporation but increase algae risk.")

    # Forecast trends (daily summaries)
    forecast = weather.get("forecast", [])
    if forecast:
        rain_days = [f for f in forecast if f.get("is_rain_day")]
        if rain_days and "rain" not in condition:
            impacts.append("🌧️ Rain in forecast — plan to test water chemistry after it passes.")
        temps = [f.get("temp_max") or f.get("temp") for f in forecast if f.get("temp_max") or f.get("temp")]
        if len(temps) >= 2:
            if temps[-1] - temps[0] > 10:
                impacts.append("📈 Temperature rising — expect increased chlorine demand this week.")
            elif temps[0] - temps[-1] > 10:
                impacts.append("📉 Temperature dropping — pool will need less chemical attention.")

    return impacts
