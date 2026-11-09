import uvicorn
from backend.app.config import settings

if __name__ == "__main__":
    print(f"Starting Smart Electronics Inventory Backend on {settings.HOST}:{settings.PORT}...")
    uvicorn.run(
        "backend.app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False,
    )
