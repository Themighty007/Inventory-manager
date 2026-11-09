# Smart Electronics Inventory & Cabinet Manager (PWA)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React 19](https://img.shields.io/badge/Frontend-React%2019-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20WAL-003B57.svg?logo=sqlite)](https://www.sqlite.org)

A complete, self-contained, and production-ready **Smart Electronics Inventory Management System** built around the physical **Stanley 1-93-981 39-Compartment Storage Cabinet**.

Engineered as a single, responsive **Progressive Web App (PWA)** that runs on Windows desktop browsers and Android mobile browsers, backed by a local **FastAPI + SQLite** master database.

---

## 📸 Core Features & Highlights

### 1. Dual-Experience Responsive Design
- **Windows Desktop Experience**:
  - Full interactive **Stanley 1-93-981 39-Compartment Matrix** visualizer (30 small drawers: `S01–S30`, 9 large drawers: `L01–L09`).
  - Searchable inventory table with category filtering (`Electrical`, `Network`, `HVAC`, `Microcontrollers`, `Passives`, `Sensors`).
  - Auditable transaction ledger tracking every intake, deduction, and transfer.
  - Printable 39-compartment QR label sheet modal for drawer stickers.
  - One-click demo data controls: **Load Demo Data** for instant testing, and **Clear Demo Data** for a pristine zero-state setup.
- **Android Mobile Experience**:
  - In-browser barcode & QR camera scanner powered by `html5-qrcode` with rear camera selection, flash/torch toggle, photo upload fallback, and manual entry.
  - Touch-friendly 39-drawer grid with drawer detail bottom sheet, quantity stepper, and quick deduction.
  - Parcel intake wizard populating parts and assigning drawers directly from scanned tracking or component codes.
  - Full **PWA Installation**: Install directly from Chrome to your phone's home screen for a full-screen, native-app feel without needing an APK.

### 2. Physical Stanley Cabinet Layout
- **Upper Section**: 30 Small Drawers (`S01` to `S30`), dimensions $13.5 \times 5.0 \times 3.5\text{ cm}$.
- **Lower Section**: 9 Large Drawers (`L01` to `L09`), dimensions $13.5 \times 11.0 \times 6.0\text{ cm}$.
- Live occupancy indicators (Green = Available / Empty, Yellow = In-Use, Red = Low Stock Alert).

### 3. Offline Resilience & Idempotency
- Works seamlessly even if Wi-Fi drops: All transactions queue in **IndexedDB** (`StanleyInventoryOfflineDB`).
- Each pending operation is assigned a cryptographically secure UUID (`client_op_id`).
- When connectivity returns, operations auto-sync to `/api/sync/batch`.
- The SQLite backend records processed UUIDs in the `sync_queue` table to guarantee **strict idempotency** (zero risk of duplicate entries or double deductions).

---

## 🚀 Quick Start (Running Independently)

### Option A: 1-Click Launch (Windows)
Simply double-click:
```cmd
start.bat
```
`start.bat` will:
1. Verify Python is installed.
2. Automatically install all required dependencies from `requirements.txt`.
3. Launch the dual HTTP & HTTPS server.
4. Automatically open `http://localhost:8000` in your default browser.

---

### Option B: Manual Command Line Launch
1. Ensure Python 3.10+ is installed.
2. Install the lightweight Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the dual HTTP/HTTPS server:
   ```bash
   python run_server.py
   ```

The server automatically detects your local Wi-Fi IP and outputs:
- **Windows Desktop (Local HTTP)**: `http://localhost:8000`
- **Windows Desktop (Local HTTPS)**: `https://localhost:8443`
- **Android Mobile (LAN HTTPS)**: `https://<your-local-ip>:8443`
- **Interactive REST API Docs**: `http://localhost:8000/docs`

> **Note**: You **do NOT need Node.js or npm installed to run the app**! The React frontend is already pre-compiled into production assets inside `frontend/dist/` and served directly by FastAPI.

---

## 📱 Connecting Your Android Phone

1. Connect your Android phone to the **same Wi-Fi network** as your computer.
2. Open **Google Chrome** on your phone and navigate to:
   ```
   https://<your-laptop-ip>:8443
   ```
   *(e.g., `https://192.168.29.243:8443`)*
3. **Bypass Local SSL Warning**:
   - Because the SSL certificate is self-signed for local LAN use, Chrome will display: *"Your connection is not private"*.
   - Tap **Advanced**, then tap **Proceed to site (unsafe)**.
   *(HTTPS is strictly required by modern mobile browsers to enable camera permissions and PWA installation).*
4. **Install as App (PWA)**:
   - Tap the three dots (⋮) in Chrome $\rightarrow$ Tap **"Add to Home screen"** or **"Install app"**.
   - An app icon named **Inventory** will appear on your home screen.
5. **Camera Scanning**:
   - Tap the **Scanner** tab $\rightarrow$ Grant camera access $\rightarrow$ Point at any component barcode or drawer QR code!

---

## 🗄️ Database & Demo Data Management

The system uses a standalone SQLite database stored at:
```
inventory_master.db
```
- **Clear Demo Data**: Click the red *"Clear Demo Data"* button on the desktop header to wipe demo parts for real production usage.
- **Load Demo Data**: Click *"Load Demo Data"* to reload sample components (ESP32, Arduino Nano, Resistors, Circuit Breakers, Ethernet spools) for demonstration or testing.

---

## 📦 Repository Structure

```
├── backend/
│   └── app/
│       ├── api/router.py          # REST API endpoints & sync route
│       ├── database/              # SQLAlchemy models, SQLite connection, seed
│       │   ├── connection.py
│       │   ├── models.py
│       │   └── seed.py
│       ├── schemas/inventory.py   # Pydantic request & response schemas
│       ├── services/              # Inventory business logic & QR generator
│       ├── config.py              # Server settings & network configurations
│       └── main.py                # FastAPI app & SPA static asset mount
├── certs/                         # Self-signed TLS/SSL SAN certificates
│   ├── cert.pem
│   └── key.pem
├── frontend/                      # React + TypeScript + Vite + Tailwind source
│   ├── dist/                      # Pre-compiled production bundle (served by FastAPI)
│   ├── public/                    # PWA Web App Manifest, Service Worker, icons
│   ├── src/                       # TypeScript source code
│   ├── package.json
│   └── vite.config.ts
├── inventory_master.db            # Master SQLite database (WAL mode)
├── generate_ssl.ps1               # SSL certificate generator script
├── requirements.txt               # Exact Python dependencies
├── run_server.py                  # Concurrent dual HTTP (8000) & HTTPS (8443) server
├── start.bat                      # 1-Click launcher for Windows
├── LICENSE                        # MIT License
└── README.md                      # Project documentation
```

---

## 🛠️ Modifying Frontend Source (Optional)

If you wish to edit the frontend TypeScript source code:
```bash
cd frontend
npm install
npm run dev     # Starts Vite dev server with hot reload
npm run build   # Rebuilds production bundle into frontend/dist/
```

---

## 📄 License
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
