import sys
import os
import socket
import threading
import asyncio
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn
from backend.app.config import settings


def get_lan_ip() -> str:
    """Attempt to detect local machine IP on active network interface."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # connect to dummy address to determine outgoing interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "192.168.29.243"


def start_http_server():
    try:
        config = uvicorn.Config(
            "backend.app.main:app",
            host=settings.HOST,
            port=settings.HTTP_PORT,
            log_level="info",
        )
        server = uvicorn.Server(config)
        asyncio.run(server.serve())
    except Exception as e:
        print(f"HTTP Server error on port {settings.HTTP_PORT}: {e}")


def start_https_server():
    cert_file = settings.SSL_CERTFILE
    key_file = settings.SSL_KEYFILE

    if not cert_file.exists() or not key_file.exists():
        print("Warning: SSL certificates not found in certs/ directory. Skipping HTTPS server.")
        return

    try:
        config = uvicorn.Config(
            "backend.app.main:app",
            host=settings.HOST,
            port=settings.HTTPS_PORT,
            ssl_certfile=str(cert_file),
            ssl_keyfile=str(key_file),
            log_level="info",
        )
        server = uvicorn.Server(config)
        asyncio.run(server.serve())
    except Exception as e:
        print(f"HTTPS Server error on port {settings.HTTPS_PORT}: {e}")


if __name__ == "__main__":
    lan_ip = get_lan_ip()

    print("=" * 72)
    print("  SMART ELECTRONICS INVENTORY MANAGEMENT SYSTEM (PWA EDITION)")
    print("  Stanley 1-93-981 39-Compartment Storage Matrix")
    print("=" * 72)
    print(f"  Windows Desktop (Local HTTP):   http://localhost:{settings.HTTP_PORT}")
    print(f"  Windows Desktop (Local HTTPS):  https://localhost:{settings.HTTPS_PORT}")
    print(f"  Android Mobile (LAN HTTPS):     https://{lan_ip}:{settings.HTTPS_PORT}")
    print(f"  Android Mobile (LAN HTTP):      http://{lan_ip}:{settings.HTTP_PORT}")
    print(f"  REST API Documentation:         http://localhost:{settings.HTTP_PORT}/docs")
    print("=" * 72)
    print("  NOTE FOR ANDROID PHONE (PWA & CAMERA):")
    print(f"  Open https://{lan_ip}:{settings.HTTPS_PORT} in Chrome on your phone.")
    print("  Tap 'Advanced' -> 'Proceed to site' to accept local SSL certificate.")
    print("  Camera access and 'Add to Home Screen' (PWA) will activate smoothly.")
    print("=" * 72)

    # Seed database once synchronously before launching listener threads
    try:
        from backend.app.database.seed import seed_database
        seed_database()
    except Exception as e:
        print(f"Database init notice: {e}")

    # Start HTTP server in a separate daemon thread
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    # Run HTTPS server in main thread (or vice-versa)
    start_https_server()
