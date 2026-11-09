# aegis '26 — Smart Electronics Inventory Management System

A local-first, QR-enabled smart inventory management system tailored for the **STANLEY 1-93-981 39-Compartment Storage Cabinet** (30 small drawers at top + 9 large drawers at bottom).

Built with a unified local backend architecture so your **Windows Desktop Dashboard** and **Android Mobile Terminal** share one synchronized SQLite master database with transactional ledgers.

---

## 📸 Exact Neo-Brutalist Theme & Visual Styling
The user interface replicates the **aegis '26 Campus CRM** and **Bruddle** visual aesthetic:
- **Canvas**: Warm vintage ivory paper background (`#F8F6F1`)
- **Sidebar**: Deep obsidian charcoal (`#121316`)
- **Card Panels**: Crisp 2px solid black borders with signature 4px hard offset shadows (`box-shadow: 4px 4px 0px #18181B`)
- **Accents**: Mint green (`#86EFAC`), Pastel gold (`#FEF08A`), Lavender (`#DDD6FE`), Coral (`#FCA5A5`), and Sky blue (`#93C5FD`)
- **Typography**: High-contrast sans-serif + Tabular Monospace numbers for SKUs, counts, and Indian Rupee (`₹`) pricing.

---

## 🗄️ Stanley 1-93-981 Physical Cabinet Matrix

```
┌────────────────────────────────────────────────────────────────────────┐
│ STANLEY 1-93-981: 39 COMPARTMENT PHYSICAL MAPPING                      │
├────────────────────────────────────────────────────────────────────────┤
│ UPPER SECTION: 30 Small Drawers (5 Rows × 6 Columns)                  │
│ [ S01 ][ S02 ][ S03 ][ S04 ][ S05 ][ S06 ]  (Row 1)                   │
│ [ S07 ][ S08 ][ S09 ][ S10 ][ S11 ][ S12 ]  (Row 2)                   │
│ [ S13 ][ S14 ][ S15 ][ S16 ][ S17 ][ S18 ]  (Row 3)                   │
│ [ S19 ][ S20 ][ S21 ][ S22 ][ S23 ][ S24 ]  (Row 4)                   │
│ [ S25 ][ S26 ][ S27 ][ S28 ][ S29 ][ S30 ]  (Row 5)                   │
├────────────────────────────────────────────────────────────────────────┤
│ LOWER SECTION: 9 Large Drawers (3 Rows × 3 Columns)                   │
│ [     L01     ][     L02     ][     L03     ]  (Row 1)                │
│ [     L04     ][     L05     ][     L06     ]  (Row 2)                │
│ [     L07     ][     L08     ][     L09     ]  (Row 3)                │
└────────────────────────────────────────────────────────────────────────┘
```

- **S01–S30**: Small drawers (13.5 × 5.0 × 3.5 cm) for ICs, microcontrollers, passive components, sensors, and relays.
- **L01–L09**: Large drawers (13.5 × 11.0 × 6.0 cm) for cable drums, refrigerant cylinders, filters, and bulky modules.
- **Drawer Color Coding**:
  - `Gray / Outline`: Empty (Available)
  - `Pastel Yellow (#FEF08A)`: Occupied (Single SKU)
  - `Lavender (#DDD6FE)`: Multi-SKU Partitioned
  - `Coral (#FCA5A5)`: Low Stock Warning (below threshold)
  - `Sky Blue (#93C5FD)`: Active Project Reservation

---

## 🚀 Quick Start Guide (Windows Laptop)

### 1-Click Launch
Double-click `scripts\start_all.bat` or run:
```cmd
scripts\start_all.bat
```
This will:
1. Initialize the SQLite database and seed all 39 Stanley drawers automatically.
2. Launch the FastAPI Uvicorn server on `http://localhost:8000`.
3. Open the complete dashboard in your default browser.

### Separate Services (Optional)
- **Backend Only**:
  ```cmd
  scripts\start_backend.bat
  ```
- **Frontend Hot-Reloading Dev Server**:
  ```cmd
  scripts\start_frontend.bat
  ```
- **Run Backend Verification Tests**:
  ```cmd
  .venv\Scripts\python.exe scripts\test_services.py
  ```

---

## 📱 Testing the Android Mobile Application on Your Laptop

You have 3 easy ways to see, test, and use the mobile version on your Windows laptop:

### Option 1: Built-in Live Phone Simulator (Zero Install)
1. Open the dashboard at `http://localhost:8000`.
2. Click the **"Android Phone Terminal"** mint button in the top right corner (or in the left sidebar).
3. An interactive Android smartphone frame appears directly on your screen with:
   - Barcode / QR Scanner viewfinder (with instant simulation test button).
   - Incoming parcel registration wizard.
   - Stanley 39-drawer touch picker.
   - Quick stock consumption & offline sync queue.

### Option 2: Antigravity Android Device Hub Sidecar
Antigravity includes the `android-cli-plugin` and `sidecar://android-cli/device-hub`:
1. Run `scripts\run_device_hub.bat` or run in terminal:
   ```cmd
   android sidecar run device-hub
   ```
2. Open the sidecar panel directly inside Antigravity by clicking:
   [sidecar://android-cli/device-hub](sidecar://android-cli/device-hub)
3. You can start/mirror an Android Virtual Device (AVD) or plug in your physical Android phone via USB (`adb devices`) to mirror and control the live mobile app with your mouse and keyboard!

### Option 3: Android Studio Native Project
1. Open **Android Studio**.
2. Select **Open Existing Project** -> navigate to `c:\Users\test\Desktop\Gowthum workspace\daily life\Inventory manager\android-app`.
3. Select your emulator (or connected phone) and click **Run (Shift + F10)**.
4. The app will connect to `http://10.0.2.2:8000` (the emulator's alias for your host laptop) or your laptop's local Wi-Fi IP address.

---

## 🏷️ Printing Stanley Drawer QR Labels
1. Click **"Print Drawer QR Sheet"** in the sidebar.
2. The system formats high-resolution QR codes for all 39 drawers (`DRAWER:S01` to `DRAWER:L09`).
3. Click **"Print Sticker Sheet"** to print directly or save as PDF.
4. Stick each QR code on your physical Stanley drawer handle. Scanning any drawer QR from your phone immediately opens that drawer's inventory record!

---

## 📂 Repository Structure

```
Inventory manager/
├── backend/
│   ├── app/
│   │   ├── api/router.py          # Complete REST API (drawers, stock, requisitions, sync)
│   │   ├── database/
│   │   │   ├── connection.py      # SQLite WAL mode & foreign key setup
│   │   │   ├── models.py          # SQLAlchemy ORM models (11 tables)
│   │   │   └── seed.py            # Stanley 39-drawer auto-seed + catalog
│   │   ├── schemas/inventory.py   # Pydantic request & response schemas
│   │   ├── services/
│   │   │   └── inventory_service.py # Core business logic, stock ledger, QR engine
│   │   ├── config.py              # App settings & cabinet dimensions
│   │   └── main.py                # FastAPI app + static bundle serving
│   ├── tests/
│   │   └── test_api.py            # API test suite
│   ├── requirements.txt
│   └── run_server.py              # Server entry point
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CabinetVisualizer.tsx   # Stanley 1-93-981 39-drawer visualizer
│   │   │   ├── DrawerModal.tsx         # Slide-out compartment inspector & actions
│   │   │   ├── MetricCards.tsx         # 4 top KPI cards from Image 1
│   │   │   ├── RequisitionCard.tsx     # Technician part requisition card
│   │   │   ├── InventoryTable.tsx      # Central Stores inventory data table
│   │   │   ├── CategoryUsage.tsx       # 30-day category progress bars
│   │   │   ├── ParcelIntakeModal.tsx   # Barcode parcel intake wizard
│   │   │   ├── QrPrintModal.tsx        # 39-compartment QR sticker sheet
│   │   │   └── MobileSimulatorModal.tsx # Embedded Android phone mockup frame
│   │   ├── mobile/
│   │   │   └── MobileApp.tsx           # Mobile-first parcel scanner & offline queue
│   │   ├── api/client.ts               # Frontend API client
│   │   ├── types/inventory.ts          # TypeScript interfaces
│   │   ├── App.tsx                     # Main dashboard layout
│   │   ├── index.css                   # Handcrafted Neo-Brutalist CSS
│   │   └── main.tsx
│   ├── dist/                           # Production web bundle
│   ├── package.json
│   └── vite.config.ts
├── android-app/                        # Full Android Studio project
│   ├── app/
│   │   ├── src/main/AndroidManifest.xml
│   │   ├── src/main/java/com/aegis/inventory/MainActivity.kt
│   │   └── src/main/res/
│   ├── build.gradle
│   └── settings.gradle
├── data/
│   └── inventory.db                    # Master SQLite DB (WAL mode)
├── scripts/
│   ├── start_all.bat                   # 1-click launch script
│   ├── start_backend.bat               # FastAPI runner
│   ├── start_frontend.bat              # Vite dev runner
│   ├── run_device_hub.bat              # Antigravity Android Device Hub runner
│   └── test_services.py                # 10 automated backend tests
└── README.md
```

---

## 🔒 Reliability & Data Integrity Rules
- **Atomic Operations**: Receiving, consuming, and transferring stock execute inside strict database transactions; if any step fails, the entire transaction rolls back.
- **Permanent Ledger**: No stock is ever deleted without a trace. Every movement generates an immutable `InventoryTransaction` record.
- **Offline Idempotence**: Mobile transactions generated offline are assigned UUIDs and synchronized via `/api/sync/batch` so duplicates can never occur.
