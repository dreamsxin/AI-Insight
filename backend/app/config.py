"""Application configuration."""

import os


class Settings:
    """Central configuration for the backend application."""

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # CORS – allow the Vite dev server (5173) and production origins
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://localhost:8000",
    ]

    # API prefix
    API_PREFIX: str = "/api"


settings = Settings()
