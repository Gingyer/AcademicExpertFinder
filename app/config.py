import os
from functools import lru_cache


class Settings:
    def __init__(self) -> None:
        self.AI_PROVIDER: str = os.environ.get("AI_PROVIDER", "gemini")
        self.GEMINI_API_KEY: str = os.environ.get("GEMINI_API_KEY", "")
        self.EMBEDDING_MODEL: str = os.environ.get(
            "EMBEDDING_MODEL", "models/text-embedding-004"
        )
        raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
        self.ALLOWED_ORIGINS: list[str] = [
            o.strip()
            for o in raw_origins.split(",")
            if o.strip()
        ]
        self.APP_ENV: str = os.environ.get("APP_ENV", "development")
        self.DATABASE_URL: str = os.environ.get("DATABASE_URL", "")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
