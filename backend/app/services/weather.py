"""OpenWeatherMap client with pool impact analysis."""

import httpx
from typing import Optional
from app.config import settings


async def fetch_weather() -> Optional[dict]:
    """Fetch current weather + 5-day forecast from OpenWeatherMap."""
    if not settings.weather_enabled:
        return None
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Current weather
            current_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": settings.WEATHER_LAT, "lon": settings.WEATHER_LON,
                         "appid": settings.WEATHER_API_KEY, "units": "imperial"},
            )
            current_resp.raise_for_status()
            current = current_resp.json()

            # UV index
            uv_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/uvi",
                params={"lat": settings.WEATHER_LAT, "lon": settings.WEATHER_LON,
                         "appid": settings.WEATHER_API_KEY},
            )
            uv_index = None
            if uv_resp.status_code == 200:
                uv_index = uv_resp.json().get("value")

            # 5-day forecast
            forecast_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={"lat": settings.WEATHER_LAT, "lon": settings.WEATHER_LON,
                         "appid": settings.WEATHER_API_KEY, "units": "imperial"},
            )
            forecast_data = []
            if forecast_resp.status_code == 200:
                for item in forecast_resp.json().get("list", [])[:8]:  # next 24 hours
                    forecast_data.append({
                        "dt": item["dt"],
                        "temp": item["main"]["temp"],
                        "condition": item["weather"][0]["main"],
                        "icon": item["weather"][0]["icon"],
                        "humidity": item["main"]["humidity"],
                    })

            return {
                "air_temp_f": current["main"]["temp"],
                "humidity": current["main"]["humidity"],
                "uv_index": uv_index,
                "condition": current["weather"][0]["main"],
                "icon": current["weather"][0]["icon"],
                "wind_speed": current.get("wind", {}).get("speed"),
                "forecast": forecast_data,
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

    # Forecast trends
    forecast = weather.get("forecast", [])
    if len(forecast) >= 4:
        temps = [f["temp"] for f in forecast]
        if temps[-1] - temps[0] > 10:
            impacts.append("📈 Temperature rising — expect increased chlorine demand this week.")
        elif temps[0] - temps[-1] > 10:
            impacts.append("📉 Temperature dropping — pool will need less chemical attention.")
        rain_coming = any("rain" in f.get("condition", "").lower() for f in forecast)
        if rain_coming and "rain" not in condition:
            impacts.append("🌧️ Rain in forecast — plan to test water chemistry after it passes.")

    return impacts
