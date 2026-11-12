import asyncio
import os
import sys
import threading
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import uvicorn
from backend.app.config import settings
from backend.app.services.network_service import get_network_info
from backend.app.services.ssl_service import ensure_ssl_certificates


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
    # 1. Detect dynamic network info across all active interfaces
    net_info = get_network_info(http_port=settings.HTTP_PORT, https_port=settings.HTTPS_PORT)
    primary_ip = net_info["primary_ip"]
    all_ips = [iface["ip"] for iface in net_info["interfaces"]]

    # 2. Ensure SSL certificate includes all detected local IPs
    try:
        ensure_ssl_certificates(
            cert_path=settings.SSL_CERTFILE,
            key_path=settings.SSL_KEYFILE,
            additional_ips=all_ips,
        )
    except Exception as ssl_err:
        print(f"SSL auto-provision notice: {ssl_err}")

    print("=" * 76)
    print("  SKR TECH'S INVENTORY SYSTEM (PWA EDITION)")
    print("  Hardware Innovations • Stanley 1-93-981 39-Compartment Storage Matrix")
    print("=" * 76)
    print(f"  Windows Desktop (Local HTTP):   http://localhost:{settings.HTTP_PORT}")
    print(f"  Windows Desktop (Local HTTPS):  https://localhost:{settings.HTTPS_PORT}")
    print(f"  Primary LAN IP:                 {primary_ip} ({net_info['primary_interface_name']})")
    print(f"  Android Mobile (LAN HTTPS):     https://{primary_ip}:{settings.HTTPS_PORT}")
    print(f"  Android Mobile (LAN HTTP):      http://{primary_ip}:{settings.HTTP_PORT}")
    if len(net_info["interfaces"]) > 1:
        print("  Additional Detected Adapters:")
        for iface in net_info["interfaces"]:
            if iface["ip"] != primary_ip:
                print(f"    - {iface['name']}: https://{iface['ip']}:{settings.HTTPS_PORT}")
    print(f"  REST API Documentation:         http://localhost:{settings.HTTP_PORT}/docs")
    print("=" * 76)
    print("  MOBILE CONNECTION (CHROME ON ANDROID):")
    print(f"  1. Ensure phone & laptop are on the same Wi-Fi (or phone on laptop hotspot).")
    print(f"  2. Open https://{primary_ip}:{settings.HTTPS_PORT} in Chrome.")
    print("  3. Tap 'Advanced' -> 'Proceed to site' to accept local SSL certificate.")
    print("  4. Tap Chrome menu (:) -> 'Add to Home screen' or 'Install app'.")
    print("=" * 76)

    # Seed database once synchronously before launching listener threads
    try:
        from backend.app.database.seed import seed_database
        seed_database()
    except Exception as e:
        print(f"Database init notice: {e}")

    # Start HTTP server in a separate daemon thread
    http_thread = threading.Thread(target=start_http_server, daemon=True)
    http_thread.start()

    # Run HTTPS server in main thread
    start_https_server()
