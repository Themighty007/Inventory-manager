# Smart Electronics Inventory & Cabinet Manager (PWA)

A unified, high-performance Progressive Web Application (PWA) and inventory management system designed for electronics workshops, maker labs, and engineering stockrooms.

Replaces the previous native Android application with a **single, responsive PWA** that works seamlessly across **Windows desktop browsers** and **Android mobile devices**, backed by a local **FastAPI + SQLite** server.

---

## 📸 Architecture & Design Highlights

### 1. Dual-Experience Responsive Frontend
- **Desktop Experience (Windows)**:
  - Full **Stanley 1-93-981 39-Compartment Matrix** visualizer (30 small drawers: S01–S30, 9 large drawers: L01–L09).
  - Searchable inventory ledger with category filtering (`Electrical`, `Network`, `HVAC`, `Microcontrollers`, `Passives`, `Sensors`).
  - Auditable transaction ledger tracking every intake, deduction, and transfer.
  - Printable 39-compartment QR label sheet modal.
  - One-click demo data controls: **Load Demo Data** for testing, and **Clear Demo Data** for a clean production setup.
- **Mobile Experience (Android Chrome / Installed PWA)**:
  - Touch-friendly 39-drawer grid with drawer detail bottom sheet, quantity stepper, and quick deduction.
  - In-browser barcode & QR camera scanner powered by `html5-qrcode` with rear camera selection, flash toggle, photo upload fallback, and manual entry.
  - Parcel intake wizard populating parts and assigning drawers directly from scanned tracking or component codes.
  - Offline sync queue with client-side UUID idempotency.

### 2. Physical Stanley Cabinet Layout
- **Upper Section**: 30 Small Drawers (`S01` to `S30`), dimensions $13.5 \times 5.0 \times 3.5\text{ cm}$.
- **Lower Section**: 9 Large Drawers (`L01` to `L09`), dimensions $13.5 \times 11.0 \times 6.0\text{ cm}$.
- Live occupancy indicators (Green = Available / Empty, Yellow = In-Use, Red = Low Stock).

### 3. Solved All UI Issues from Previous Iterations
- ✅ **Clean Text Alignment**: All table cells, drawer cards, and headers use explicit padding, font metrics, and responsive overflow wrappers. No text leaks outside borders.
- ✅ **Configurable User Sign-In**: First-time prompt allows the user to enter their name, persisted in local storage. Clickable profile chip in sidebar/header allows changing at any time.
- ✅ **Eliminated Clutter**: Removed unwanted badges ("Aegis '26", "Switch Role", "Android Phone Terminal", "SKUs Monitored", "Stock Availability", "Procurement Budget", "Technician Requisitions", "Switch rows").
- ✅ **Renamed to "Cabinet"**: Physical visualizer is cleanly titled "Cabinet".
- ✅ **Compartment QR & Actions**: Every drawer compartment has a generated QR code, and shows instant "Available" status and "Remove / Add" actions.

---

## 🚀 Quick Start Guide

### 1. Start the Dual HTTP / HTTPS Server
From the project folder (`smart-inventory-pwa/` or `Inventory-Manager-PWA/`), run:

```bash
# Using python directly:
python run_server.py
```

The server automatically starts:
- **HTTP Server**: `http://localhost:8000` (or `http://192.168.29.243:8000`)
- **HTTPS Server**: `https://localhost:8443` (or `https://192.168.29.243:8443`)

> **Why HTTPS?** Modern Android browsers strictly require a secure origin (`https://`) to grant camera access for the barcode/QR scanner and to enable PWA installation ("Add to Home screen").

---

## 📱 Connecting Your Android Phone

1. Ensure your Android phone and Windows laptop are connected to the **same Wi-Fi network**.
2. On your phone, open **Google Chrome** and browse to:
   ```
   https://192.168.29.243:8443
   ```
3. **Bypass Local SSL Warning**:
   - Because the SSL certificate is self-signed for local LAN use, Chrome will display a warning: *"Your connection is not private"*.
   - Tap **Advanced**, then tap **Proceed to 192.168.29.243 (unsafe)**.
4. **Install as App (PWA)**:
   - Tap the three-dot menu in Chrome (top right).
   - Tap **"Add to Home screen"** or **"Install app"**.
   - An icon named **Inventory** will be added to your phone's home screen. Launching it provides a full-screen, native-app feel!
5. **Camera Scanning**:
   - Tap the **Scanner** tab.
   - Tap **"Allow Camera Access"** when prompted.
   - Point your phone camera at any component barcode or drawer QR sticker!

---

## 🔄 Offline Synchronization & Idempotency

When your phone loses Wi-Fi connection:
- All parcel intakes and stock deductions are saved locally in **IndexedDB** (`StanleyInventoryOfflineDB`).
- The status bar displays **OFFLINE MODE** and counts queued operations.
- Each pending operation is assigned a unique cryptographic UUID (`client_op_id`).
- When Wi-Fi is restored, operations are transmitted in batches to `/api/sync/batch`.
- The SQLite backend records processed UUIDs in the `sync_queue` table, ensuring **strict idempotency** (zero risk of duplicate stock entries or double deductions).

---

## 🗄️ Database Management
The master database is stored locally at:
```
smart-inventory-pwa/inventory_master.db
```
- **Clear Demo Data**: Click the red *"Clear Demo Data"* button on the desktop top bar to wipe sample parts and start 100% clean for real-world usage.
- **Load Demo Data**: Click *"Load Demo Data"* to reload sample components (ESP32, Arduino, Resistors, Circuit Breakers, Ethernet spools) for demonstration or testing.

---

## 📦 Directory Structure

```
smart-inventory-pwa/
├── certs/                      # Self-signed TLS/SSL SAN certificates
│   ├── cert.pem
│   └── key.pem
├── backend/                    # Python FastAPI application
│   ├── app/
│   │   ├── api/router.py       # REST API endpoints & sync route
│   │   ├── database/           # SQLAlchemy models, SQLite connection, seed
│   │   ├── schemas/            # Pydantic request/response models
│   │   ├── services/           # Inventory & QR generation logic
│   │   ├── config.py           # Server & network configuration
│   │   └── main.py             # FastAPI entrypoint & SPA static asset mount
├── frontend/                   # React + TypeScript + Vite + Tailwind PWA
│   ├── public/
│   │   ├── icons/              # 192px, 512px, maskable, and SVG app icons
│   │   ├── manifest.json       # Web App Manifest for PWA installation
│   │   └── sw.js               # Service Worker caching app shell
│   ├── src/
│   │   ├── api/client.ts       # Unified API client
│   │   ├── components/
│   │   │   ├── cabinet/        # Stanley cabinet visualizer & drawer modal
│   │   │   ├── desktop/        # Desktop dashboard & parcel intake
│   │   │   ├── inventory/      # Clean inventory table & audit ledger
│   │   │   ├── mobile/         # Mobile scanner, cabinet, intake, sync queue
│   │   │   └── qr/             # Printable QR label sheets
│   │   ├── db/offlineDb.ts     # IndexedDB offline store with UUIDs
│   │   ├── types/inventory.ts  # TypeScript interfaces
│   │   ├── App.tsx             # Responsive layout switcher & online listener
│   │   └── index.css           # Neo-Brutalist design system
│   └── dist/                   # Production-ready built assets served by backend
├── inventory_master.db         # Master SQLite database (WAL mode)
├── run_server.py               # Concurrent dual HTTP (8000) & HTTPS (8443) launcher
└── generate_ssl.ps1            # SSL generation helper
```
