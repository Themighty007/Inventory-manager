import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings:
    APP_NAME: str = "SKR Tech's Inventory System"
    APP_VERSION: str = "2.1.0-PWA"
    API_PREFIX: str = "/api"

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'inventory_master.db'}"
    )

    HOST: str = os.getenv("HOST", "0.0.0.0")
    HTTP_PORT: int = int(os.getenv("PORT", "8000"))
    HTTPS_PORT: int = int(os.getenv("HTTPS_PORT", "8443"))

    SSL_KEYFILE: Path = BASE_DIR / "certs" / "key.pem"
    SSL_CERTFILE: Path = BASE_DIR / "certs" / "cert.pem"

    CORS_ORIGINS: list = [
        "*",
        "http://localhost:5173",
        "http://localhost:8000",
        "https://localhost:8443",
        "http://127.0.0.1:8000",
        "https://127.0.0.1:8443",
    ]

settings = Settings()
