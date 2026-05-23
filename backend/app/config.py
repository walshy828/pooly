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
    HA_TEMP_ENTITY: Optional[str] = None
    HA_PUMP_ENTITY: Optional[str] = None
    HA_PUMP_ENERGY_ENTITY: Optional[str] = None

    # Weather
    WEATHER_API_KEY: Optional[str] = None
    WEATHER_LAT: Optional[float] = None
    WEATHER_LON: Optional[float] = None

    # Timezone
    TZ: str = "America/New_York"

    @property
    def ha_enabled(self) -> bool:
        return bool(self.HA_URL and self.HA_TOKEN)

    @property
    def weather_enabled(self) -> bool:
        return bool(self.WEATHER_API_KEY and self.WEATHER_LAT and self.WEATHER_LON)

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
