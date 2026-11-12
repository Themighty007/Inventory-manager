# SKR Tech's Inventory System (PWA)
**Hardware Innovations • Stanley 1-93-981 39-Compartment Storage System**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-00B4D8.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/Frontend-React%2018-00B4D8.svg?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?logo=typescript)](https://www.typescriptlang.org)
[![PWA](https://img.shields.io/badge/PWA-Installable-2EC4B6.svg?logo=pwa)](https://web.dev/progressive-web-apps/)
[![SQLite](https://img.shields.io/badge/Database-SQLite%20WAL-0B132B.svg?logo=sqlite)](https://www.sqlite.org)

A complete, self-contained, and production-ready **Smart Electronics Inventory Management System** built around the physical **Stanley 1-93-981 39-Compartment Storage Cabinet**.

Engineered as a single, responsive **Progressive Web App (PWA)** that runs on Windows desktop browsers and Android mobile browsers, backed by a local **FastAPI + SQLite** master database.

Developed by **Gowthum Vijaay D** (`srigowv@gmail.com`).

---

## Brand Aesthetic & Color Palette

Designed with a sleek, minimalist hardware engineering aesthetic:
- **Primary Color**: Deep Hardware Navy (`#0B132B`)
- **Accent Color 1**: Electric Circuit Cyan (`#00B4D8`)
- **Accent Color 2**: Precision Metrology Teal (`#2EC4B6`)
- **Neutral Light**: Clean Room White (`#F8FAFC`)
- **Neutral Dark**: Anodized Charcoal (`#1E293B`)
- **Typography**: Inter (Variable) for UI precision; Space Grotesk for display headers.

---

## Core Features & Highlights

### 1. Dual-Experience Responsive Design
- **Windows Desktop Experience**:
  - Full interactive **Stanley 1-93-981 39-Compartment Matrix** visualizer (`S01–S30` small drawers and `L01–L09` large drawers).
  - Clean unified search bar (`Search SKU, invoice, or drawer...`) and category filters (`Microcontrollers`, `Semiconductors`, `Passives`, `Sensors`, `Cables & Connectors`, etc.).
  - **Invoice Document Auto-Logger**: Upload supplier invoices (`.pdf`, `.docx`, `.csv`, `.tsv`, `.txt`, `.json`) to automatically extract item **Name**, **SKU**, **Quantity**, **Order Date**, and **Delivery / Arrival Time**. Extracted items are staged directly into the **"Yet to be Delivered"** box without forcing compartment assignments upfront.
  - **"Yet to be Delivered" In-Transit Hub**: Dedicated management space displaying incoming electronic components, expected arrivals, and in-transit valuation. When parcels arrive, assign physical Stanley drawers (`S01–S30` or `L01–L09`) via the visual matrix modal or mobile scanner.
  - **Dynamic Network Discovery**: Seamless dropdown selector for multiple Wi-Fi/Ethernet adapters, custom IP input, and live QR code generation.
  - **Logged Invoices & Arrivals** audit panel and **Permanent Transaction Ledger**.
  - Printable 39-compartment QR label sheet modal for drawer stickers.
- **Android Mobile Experience**:
  - High-precision in-browser QR & all-format 1D/2D barcode camera scanner (hardware `BarcodeDetector` + `jsQR` engine supporting QR, Code 128, Code 39, Code 93, Codabar, ITF, EAN-13, EAN-8, UPC-A, UPC-E, PDF417, Aztec, Data Matrix with tap-to-focus, center-crop sensor precision, rear camera selection, flash/torch toggle, photo upload fallback, and manual entry).
  - **Hardware Arrival Auto-Match**: Scanning an in-transit SKU or barcode automatically detects the pending invoice order and pre-fills details, requiring only a single tap on the Stanley compartment.
  - **Mobile Invoice Tab**: Upload downloaded PDF/DOCX/CSV invoices directly from your phone to stage them into "Yet to be Delivered".
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
2. Automatically add Windows Firewall rules for TCP ports 8000 and 8443 so mobile devices can connect across your local network.
3. Automatically install all required dependencies from `requirements.txt`.
4. Launch the dual HTTP (`8000`) & HTTPS (`8443`) server.
5. Automatically open `http://localhost:8000` in your default browser.

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

The server automatically detects your active network adapters and displays:
- **Windows Desktop (Local HTTP)**: `http://localhost:8000`
- **Windows Desktop (Local HTTPS)**: `https://localhost:8443`
- **Android Mobile (LAN HTTPS)**: `https://<your-local-ip>:8443`
- **Interactive REST API Docs**: `http://localhost:8000/docs`

> **Note**: You **do NOT need Node.js or npm installed to run the app**. The React + TypeScript frontend is pre-compiled inside `frontend/dist/` and served directly by FastAPI.

---

## Connecting Your Android Phone & Troubleshooting Network Timeouts

If you or a friend test on another laptop and Wi-Fi network and get a **"Connection timed out"** error on mobile:

### 1. Active Network Adapter Selection
Click **"Connect Mobile (PWA)"** on the desktop dashboard. If the laptop has multiple network adapters (e.g. Wi-Fi, Ethernet, WSL, or VirtualBox), use the **"Active Network Adapter"** dropdown to select the IP of the Wi-Fi network your phone is connected to. The QR code updates instantly.

### 2. Windows Firewall Check
Windows Firewall may block inbound connections on public Wi-Fi networks by default. Run this in PowerShell (as Administrator):
```powershell
New-NetFirewallRule -DisplayName "SKR Tech Inventory (HTTP 8000)" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow
New-NetFirewallRule -DisplayName "SKR Tech Inventory (HTTPS 8443)" -Direction Inbound -Protocol TCP -LocalPort 8443 -Action Allow
```
*(Our `start.bat` script automatically configures these rules on launch!)*

### 3. Wi-Fi AP Isolation
Some home routers or public guest Wi-Fi networks have **"AP Isolation"** / **"Client Isolation"** enabled, preventing connected devices from talking to one another.
- **Easy Workaround**: Turn on **Mobile Hotspot** on the Windows laptop (Settings → Network & internet → Mobile hotspot) and connect the Android phone directly to the laptop's hotspot! Then open `https://192.168.137.1:8443`.

### 4. Accept Local SSL Certificate
Because camera permissions and PWA installation on Android Chrome strictly require HTTPS, a locally-generated SSL certificate is used:
1. Open `https://<laptop-ip>:8443` in Chrome on your phone.
2. When Chrome shows *"Your connection is not private"*, tap **Advanced**, then tap **Proceed to site (unsafe)**.
3. Tap Chrome's menu (`⋮`) -> **"Add to Home screen"** or **"Install app"**.

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
│       ├── api/router.py                    # REST API endpoints, invoice parsing, network info & sync
│       ├── database/                        # SQLAlchemy models, SQLite WAL engine & migrations
│       │   ├── connection.py
│       │   ├── models.py
│       │   └── seed.py
│       ├── schemas/inventory.py             # Pydantic request & response schemas
│       ├── services/
│       │   ├── inventory_service.py         # Core inventory, stock & atomic invoice logging
│       │   ├── invoice_parser.py            # Spatial PDF, DOCX, CSV, TXT & JSON invoice extractor
│       │   ├── network_service.py           # Multi-interface LAN IP detection
│       │   └── ssl_service.py               # Dynamic SAN SSL certificate provisioning
│       ├── config.py                        # Server settings & branding
│       └── main.py                          # FastAPI app, static assets & SPA mount
├── certs/                                   # Dynamic TLS/SSL SAN certificates
│   ├── cert.pem
│   └── key.pem
├── frontend/                                # React + TypeScript + Vite + Tailwind source
│   ├── dist/                                # Pre-compiled production bundle served by FastAPI
│   ├── public/                              # PWA Web App Manifest, Service Worker, logos, icons
│   ├── src/
│   │   ├── api/client.ts                    # Typed API client
│   │   ├── components/
│   │   │   ├── cabinet/                     # Stanley 39-drawer visualizer & drawer modal
│   │   │   ├── desktop/                     # Desktop dashboard, parcel intake & invoice modal
│   │   │   ├── inventory/                   # Inventory table, logged invoices & ledger
│   │   │   ├── mobile/                      # Mobile cabinet, multi-barcode scanner, invoice & intake
│   │   │   └── qr/                          # Printable drawer QR sheet
│   │   ├── db/offlineDb.ts                  # IndexedDB offline operations queue
│   │   ├── App.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── inventory_master.db                      # Master SQLite database (WAL mode)
├── requirements.txt                         # Python backend dependencies
├── run_server.py                            # Concurrent dual HTTP (8000) & HTTPS (8443) server
├── start.bat                                # 1-Click launcher with firewall auto-configuration
├── LICENSE                                  # Apache License 2.0
└── README.md                                # Project documentation
```

---

## License & Attribution

Developed by **Gowthum Vijaay D** (`srigowv@gmail.com`).
Licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.
