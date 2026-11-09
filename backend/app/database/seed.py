from sqlalchemy.orm import Session
from backend.app.database.connection import engine, SessionLocal, Base
from backend.app.database.models import (
    Drawer,
    Item,
    StockLocation,
    StockLot,
    Parcel,
    Invoice,
    InvoiceItem,
    InventoryTransaction,
)


def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed 39 Stanley 1-93-981 Drawers if empty
        if db.query(Drawer).count() == 0:
            drawers = []
            # Upper Section: 30 Small Drawers (5 rows x 6 cols)
            for row in range(1, 6):
                for col in range(1, 7):
                    num = (row - 1) * 6 + col
                    drawer_id = f"S{num:02d}"
                    drawers.append(
                        Drawer(
                            id=drawer_id,
                            section="UPPER",
                            drawer_type="SMALL",
                            row_idx=row,
                            col_idx=col,
                            dimensions="13.5 x 5.0 x 3.5 cm",
                            max_sub_trays=3,
                        )
                    )

            # Lower Section: 9 Large Drawers (3 rows x 3 cols)
            for row in range(1, 4):
                for col in range(1, 4):
                    num = (row - 1) * 3 + col
                    drawer_id = f"L{num:02d}"
                    drawers.append(
                        Drawer(
                            id=drawer_id,
                            section="LOWER",
                            drawer_type="LARGE",
                            row_idx=row,
                            col_idx=col,
                            dimensions="13.5 x 11.0 x 6.0 cm",
                            max_sub_trays=4,
                        )
                    )

            db.add_all(drawers)
            db.commit()

        # 2. Seed Realistic Electronic Components if empty
        if db.query(Item).count() == 0:
            demo_items = [
                {
                    "sku": "ARD-NANO-01",
                    "name": "Arduino Nano V3.0 ATmega328P CH340",
                    "description": "Compact breadboard-friendly microcontroller with USB Mini-B",
                    "category": "Microcontrollers",
                    "min_stock_threshold": 5,
                    "unit": "pcs",
                    "unit_cost": 180.0,
                    "locations": [("S01", 4), ("S02", 6)],
                },
                {
                    "sku": "ESP32-DEV-01",
                    "name": "ESP32 Development Board WiFi + BLE",
                    "description": "Dual-core Xtensa 32-bit LX6 microcontroller with integrated 2.4GHz Wi-Fi and Bluetooth",
                    "category": "Microcontrollers",
                    "min_stock_threshold": 4,
                    "unit": "pcs",
                    "unit_cost": 250.0,
                    "locations": [("S12", 8)],
                },
                {
                    "sku": "RES-10K-01",
                    "name": "10K Resistor 1/4W 1% (Pack of 50)",
                    "description": "Metal film high precision pull-up resistors for logic circuits",
                    "category": "Passives",
                    "min_stock_threshold": 20,
                    "unit": "pack",
                    "unit_cost": 45.0,
                    "locations": [("S03", 120)],
                },
                {
                    "sku": "MCB-63A-3P",
                    "name": "Triple Pole 63A Miniature Circuit Breaker (10kA)",
                    "description": "Heavy duty 3-phase miniature circuit breaker for distribution panel boards",
                    "category": "Electrical",
                    "min_stock_threshold": 2,
                    "unit": "pcs",
                    "unit_cost": 1450.0,
                    "locations": [("S04", 3)],
                },
                {
                    "sku": "NE555-DIP8",
                    "name": "NE555 Precision Timer IC DIP-8",
                    "description": "Standard precision timing circuit DIP-8 package",
                    "category": "Passives",
                    "min_stock_threshold": 10,
                    "unit": "pcs",
                    "unit_cost": 15.0,
                    "locations": [("S25", 15), ("S26", 5)],
                },
                {
                    "sku": "HC-SR04-01",
                    "name": "HC-SR04 Ultrasonic Distance Sensor",
                    "description": "Ultrasonic ranging module 2cm - 400cm non-contact distance measurement",
                    "category": "Sensors",
                    "min_stock_threshold": 4,
                    "unit": "pcs",
                    "unit_cost": 110.0,
                    "locations": [("L01", 3)],
                },
                {
                    "sku": "CAT6-50M-SHLD",
                    "name": "Shielded Twisted Pair Cat6 Ethernet Cable Drum",
                    "description": "50-meter outdoor shielded Cat6 UV resistant network cable spool",
                    "category": "Network",
                    "min_stock_threshold": 2,
                    "unit": "drum",
                    "unit_cost": 3200.0,
                    "locations": [("L02", 14)],
                },
                {
                    "sku": "DG-FILTER-48KVA",
                    "name": "Diesel Generator High-Flow Oil Filter Cartridge",
                    "description": "Spin-on lubricating oil filter for 40-50kVA standby DG sets",
                    "category": "HVAC",
                    "min_stock_threshold": 2,
                    "unit": "pcs",
                    "unit_cost": 980.0,
                    "locations": [("L05", 3)],
                },
                {
                    "sku": "R410A-11KG",
                    "name": "Eco-Friendly Refrigerant Gas Cylinder (HVAC Chiller)",
                    "description": "Non-ozone depleting R410A pressurized refrigerant cylinder 11.3kg",
                    "category": "HVAC",
                    "min_stock_threshold": 2,
                    "unit": "cyl",
                    "unit_cost": 8500.0,
                    "locations": [("L08", 4)],
                },
            ]

            for item_data in demo_items:
                locs = item_data.pop("locations")
                item = Item(**item_data)
                db.add(item)
                db.flush()

                total_init = 0
                for drawer_id, qty in locs:
                    db.add(
                        StockLocation(
                            item_id=item.id,
                            drawer_id=drawer_id,
                            quantity=qty,
                            sub_tray="MAIN",
                        )
                    )
                    total_init += qty
                    db.add(
                        InventoryTransaction(
                            item_id=item.id,
                            drawer_id=drawer_id,
                            action_type="RECEIVE",
                            change_qty=qty,
                            balance_after=qty,
                            reference_doc=f"INIT-STOCK-{drawer_id}",
                            notes=f"Initial stock placement into drawer {drawer_id}",
                        )
                    )

            # Sample demo parcels
            db.add_all([
                Parcel(
                    tracking_code="TRACK-ESP32-901",
                    supplier="Mouser Electronics",
                    invoice_number="INV-2026-00125",
                    item_sku="ESP32-DEV-01",
                    drawer_id="S12",
                    quantity=8,
                    notes="WiFi dev boards for IoT sensor prototypes",
                ),
                Parcel(
                    tracking_code="TRACK-MCB-63A-44",
                    supplier="Schneider Electric Direct",
                    invoice_number="INV-2026-8801",
                    item_sku="MCB-63A-3P",
                    drawer_id="S04",
                    quantity=3,
                    notes="Main distribution board circuit breakers",
                ),
            ])

            db.commit()

    finally:
        db.close()
