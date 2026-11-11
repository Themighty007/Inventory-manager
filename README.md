# Smart Electronics Inventory & Cabinet Manager (PWA)

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/Frontend-React%2018-61DAFB.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20WAL-003B57.svg?logo=sqlite)](https://www.sqlite.org)

A complete, self-contained, and production-ready **Smart Electronics Inventory Management System** built around the physical **Stanley 1-93-981 39-Compartment Storage Cabinet**.

Engineered as a single, responsive **Progressive Web App (PWA)** that runs on Windows desktop browsers and Android mobile browsers, backed by a local **FastAPI + SQLite** master database.

---

## Core Features & Highlights

### 1. Dual-Experience Responsive Design
- **Windows Desktop Experience**:
  - Full interactive **Stanley 1-93-981 39-Compartment Matrix** visualizer (`S01–S30` small drawers and `L01–L09` large drawers).
  - Clean unified search bar (`Search SKU, invoice, or drawer...`) and category dropdown filter (`Electrical`, `Network`, `HVAC`, `Microcontrollers`, `Passives`, `Sensors`, etc.).
  - **Invoice Document Auto-Logger**: Upload supplier invoices (`.pdf`, `.docx`, `.csv`, `.tsv`, `.txt`, `.json`) to automatically extract item **Name**, **SKU**, **Quantity**, **Order Date**, and **Delivery / Arrival Time**. Confirm quantities, assign each component to its Stanley drawer, and commit atomically.
  - **Logged Invoices & Arrivals** panel and an auditable **Transaction Ledger** tracking every intake, deduction, and transfer.
  - Printable 39-compartment QR label sheet modal for drawer stickers.
- **Android Mobile Experience**:
  - High-precision in-browser QR & 1D barcode camera scanner (native `BarcodeDetector` + `jsQR` engine with tap-to-focus, center-crop sensor precision, rear camera selection, flash/torch toggle, photo upload fallback, and manual entry).
  - **Mobile Invoice Tab**: Upload downloaded PDF/DOCX/CSV invoices directly from your phone, confirm quantities, tap Stanley compartments (`S01–L09`), and commit to the master database.
  - Touch-friendly 39-drawer grid with drawer detail bottom sheet, quantity stepper, and quick deduction.
  - Full **PWA Installation**: Install directly from Chrome to your phone's home screen without needing an APK.

### 2. Physical Stanley Cabinet Layout
- **Upper Section**: 30 Small Drawers (`S01` to `S30`), dimensions `13.5 x 5.0 x 3.5 cm`.
- **Lower Section**: 9 Large Drawers (`L01` to `L09`), dimensions `13.5 x 11.0 x 6.0 cm`.
- Live occupancy indicators (`OCCUPIED`, `EMPTY`, and `ALL` filters).

### 3. Offline Resilience & Idempotency
- Works seamlessly even if Wi-Fi drops: transactions queue locally in **IndexedDB** (`StanleyInventoryOfflineDB`).
- Each pending operation receives a cryptographically unique UUID (`client_op_id`).
- When connectivity returns, operations sync automatically to `/api/sync/batch`, and the SQLite backend checks processed UUIDs in `sync_queue` to guarantee **strict idempotency** with zero duplicate transactions.

---

## Quick Start (Running Independently)

### Option A: 1-Click Launch (Windows)
Double-click:
```cmd
start.bat
```
`start.bat` will:
1. Verify Python is installed.
2. Automatically install all required dependencies from `requirements.txt`.
3. Launch the dual HTTP (`8000`) & HTTPS (`8443`) server.
4. Automatically open `http://localhost:8000` in your default browser.

---

### Option B: Manual Command Line Launch
1. Ensure Python 3.10+ is installed.
2. Install the Python dependencies:
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

> **Note**: You **do NOT need Node.js or npm installed to run the app**. The React + TypeScript frontend is pre-compiled inside `frontend/dist/` and served directly by FastAPI.

---

## Connecting Your Android Phone

1. Connect your Android phone to the **same Wi-Fi network** as your Windows PC.
2. Open **Google Chrome** on your phone and navigate to:
   ```
   https://<your-laptop-ip>:8443
   ```
   *(e.g., `https://192.168.29.243:8443`)*
3. **Accept Local SSL Certificate**:
   - Because the LAN SSL certificate is self-signed, Chrome displays *"Your connection is not private"*.
   - Tap **Advanced**, then tap **Proceed to site (unsafe)**.
   *(HTTPS is required by Android Chrome for camera access and PWA installation).*
4. **Install as App (PWA)**:
   - Tap Chrome's menu (`⋮`) -> **"Add to Home screen"** or **"Install app"**.
5. **Camera Scanning & Invoices**:
   - Use the **Scanner** tab to scan QR/barcodes or tap the **Invoice** tab to upload supplier PDF/DOCX/CSV invoices directly from your phone.

---

## Database Storage

The application initializes cleanly with all **39 Stanley compartments (`S01–S30`, `L01–L09`)** and zero pre-loaded demo data. All production records are persisted in:
```
inventory_master.db
```

---

## Repository Structure

```
├── backend/
│   └── app/
│       ├── api/router.py                    # REST API endpoints, invoice parsing & sync route
│       ├── database/                        # SQLAlchemy models, SQLite WAL engine & migrations
│       │   ├── connection.py
│       │   ├── models.py
│       │   └── seed.py
│       ├── schemas/inventory.py             # Pydantic request & response schemas
│       ├── services/
│       │   ├── inventory_service.py         # Core inventory, stock & atomic invoice logging
│       │   └── invoice_parser.py            # Spatial PDF, DOCX, CSV, TXT & JSON invoice extractor
│       ├── config.py                        # Server settings & LAN network configs
│       └── main.py                          # FastAPI app & SPA static asset mount
├── certs/                                   # Self-signed TLS/SSL SAN certificates
│   ├── cert.pem
│   └── key.pem
├── frontend/                                # React + TypeScript + Vite + Tailwind v4 source
│   ├── dist/                                # Pre-compiled production bundle served by FastAPI
│   ├── public/                              # PWA Web App Manifest, Service Worker, icons
│   ├── src/
│   │   ├── api/client.ts                    # Typed API client
│   │   ├── components/
│   │   │   ├── cabinet/                     # Stanley 39-drawer visualizer & drawer modal
│   │   │   ├── desktop/                     # Desktop dashboard, parcel intake & invoice modal
│   │   │   ├── inventory/                   # Inventory table, logged invoices & ledger
│   │   │   ├── mobile/                      # Mobile cabinet, scanner, invoice & intake views
│   │   │   └── qr/                          # Printable drawer QR sheet
│   │   ├── db/offlineDb.ts                  # IndexedDB offline operations queue
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── inventory_master.db                      # Master SQLite database (WAL mode)
├── generate_ssl.ps1                         # Optional SSL certificate regenerator script
├── requirements.txt                         # Python backend dependencies
├── run_server.py                            # Concurrent dual HTTP (8000) & HTTPS (8443) server
├── start.bat                                # 1-Click launcher for Windows
├── LICENSE                                  # Apache License 2.0
└── README.md                                # Project documentation
```

---

## Modifying Frontend Source (Optional)

If you want to customize the React + TypeScript UI:
```bash
cd frontend
npm install
npm run dev     # Starts Vite dev server with hot reload
npm run build   # Rebuilds production bundle into frontend/dist/
```

---

## License
This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
