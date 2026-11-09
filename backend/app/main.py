import os
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.app.config import settings
from backend.app.database.seed import seed_database
from backend.app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Auto-initialize SQLite database & seed 39 Stanley drawers on startup
    seed_database()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Smart Electronics Inventory Management System for Stanley 1-93-981 39-Compartment Cabinet",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_PREFIX)

# Static Frontend mounting
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/")
    def serve_frontend_root():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/app/{full_path:path}")
    def serve_frontend_app(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    def root():
        return {
            "system": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "cabinet": "STANLEY 1-93-981 (39 Drawers: 30 Small S01-S30, 9 Large L01-L09)",
            "docs": "/docs",
            "status": "ONLINE",
        }

