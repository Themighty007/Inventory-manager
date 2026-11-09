import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "inventory.db"
DATABASE_URL = f"sqlite:///{DB_PATH.as_posix()}"

class Settings(BaseModel):
    APP_NAME: str = "Smart Electronics Inventory Management"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DATABASE_URL: str = DATABASE_URL
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    CORS_ORIGINS: list[str] = ["*"]
    CABINET_SMALL_ROWS: int = 5
    CABINET_SMALL_COLS: int = 6
    CABINET_LARGE_ROWS: int = 3
    CABINET_LARGE_COLS: int = 3

settings = Settings()
