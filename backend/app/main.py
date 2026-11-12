from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.config import settings
from backend.app.database.seed import seed_database
from backend.app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database & seed 39 Stanley drawers on startup
    seed_database()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Smart Electronics Inventory Management System (PWA Edition) - Stanley 1-93-981 39-Compartment Cabinet",
    lifespan=lifespan,
)

# Robust CORS Configuration for local network and mobile devices
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
    # Mount assets folder
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    # Mount icons folder
    if (FRONTEND_DIST / "icons").exists():
        app.mount("/icons", StaticFiles(directory=FRONTEND_DIST / "icons"), name="icons")

    # Mount logos folder
    if (FRONTEND_DIST / "logos").exists():
        app.mount("/logos", StaticFiles(directory=FRONTEND_DIST / "logos"), name="logos")

    # Serve Service Worker with required PWA header
    @app.get("/sw.js")
    def serve_service_worker():
        sw_file = FRONTEND_DIST / "sw.js"
        if sw_file.exists():
            return FileResponse(
                sw_file,
                media_type="application/javascript",
                headers={
                    "Service-Worker-Allowed": "/",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                },
            )
        return Response(content="// Service worker not built yet", media_type="application/javascript")

    # Serve Web App Manifest
    @app.get("/manifest.json")
    @app.get("/manifest.webmanifest")
    def serve_manifest():
        manifest_file = FRONTEND_DIST / "manifest.json"
        if manifest_file.exists():
            return FileResponse(
                manifest_file,
                media_type="application/manifest+json",
                headers={"Cache-Control": "no-cache"},
            )
        return Response(content="{}", media_type="application/manifest+json")

    # SPA Fallback for all client-side routes
    @app.get("/")
    @app.get("/{full_path:path}")
    def serve_spa_root(full_path: str = ""):
        # Don't intercept API calls
        if full_path.startswith("api/"):
            return Response(status_code=404)
        if full_path:
            direct_file = FRONTEND_DIST / full_path
            if direct_file.is_file():
                return FileResponse(direct_file)
        index_file = FRONTEND_DIST / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return Response(content="<h1>SKR Tech's Inventory System</h1><p>Frontend building...</p>", media_type="text/html")
else:
    @app.get("/")
    def root():
        return {
            "system": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "architecture": "Single Progressive Web App (PWA) + FastAPI SQLite",
            "cabinet": "STANLEY 1-93-981 (39 Drawers: 30 Small S01-S30, 9 Large L01-L09)",
            "docs": "/docs",
            "status": "ONLINE",
        }
