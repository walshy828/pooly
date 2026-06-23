"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """All configuration is read from environment variables."""

    # Database — individual params allow pointing to any external server
    DB_HOST: str = "db"
    DB_PORT: int = 5432
    DB_USER: str = "pooly"
    DB_PASSWORD: str = "pooly_secret"
    DB_NAME: str = "pooly"

    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    @property
    def DATABASE_URL_SYNC(self) -> str:
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

    # Optional PIN protection
    APP_PIN: Optional[str] = None

    # Home Assistant
    HA_URL: Optional[str] = None
    HA_TOKEN: Optional[str] = None
    # Set HA_PUSH_MODE=true when using the HACS integration to push sensor data.
    # This disables the backend's scheduler from polling HA entity states,
    # preventing duplicate sensor_readings rows. HA_URL + HA_TOKEN are still
    # used for outbound notifications regardless of this flag.
    HA_PUSH_MODE: bool = False
    # Only needed when HA_PUSH_MODE=false (Pooly polls HA directly)
    HA_TEMP_ENTITY: Optional[str] = None
    HA_PUMP_ENTITY: Optional[str] = None
    HA_PUMP_ENERGY_ENTITY: Optional[str] = None

    # How many days of sensor readings to retain (older rows are pruned nightly)
    SENSOR_RETENTION_DAYS: int = 30

    # Weather
    WEATHER_API_KEY: Optional[str] = None
    WEATHER_LAT: Optional[float] = None
    WEATHER_LON: Optional[float] = None

    # Timezone
    TZ: str = "America/New_York"

    # Optional AI insights — env fallback/override for both providers.
    # The DB-stored key (set via Settings UI) takes precedence when present.
    ANTHROPIC_API_KEY: Optional[str] = None  # Claude
    GOOGLE_API_KEY: Optional[str] = None     # Gemini

    @property
    def ha_enabled(self) -> bool:
        return bool(self.HA_URL and self.HA_TOKEN)

    @property
    def ha_polling_enabled(self) -> bool:
        """True only when pull-mode is active and all entity IDs are configured."""
        return (
            not self.HA_PUSH_MODE
            and self.ha_enabled
            and bool(self.HA_TEMP_ENTITY or self.HA_PUMP_ENTITY or self.HA_PUMP_ENERGY_ENTITY)
        )

    @property
    def weather_enabled(self) -> bool:
        return bool(self.WEATHER_API_KEY and self.WEATHER_LAT and self.WEATHER_LON)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
