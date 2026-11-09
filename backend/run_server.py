import sys
from pathlib import Path

# Add project root to sys.path so 'backend' package is always resolvable
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

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

