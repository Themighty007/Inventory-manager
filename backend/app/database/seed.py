from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from backend.app.database.connection import engine, Base, SessionLocal
from backend.app.database.models import (
    Drawer,
    Supplier,
    Item,
    Parcel,
    Invoice,
    InvoiceItem,
    StockLot,
    StockLocation,
    InventoryTransaction,
    Project,
    Reservation,
)


def seed_database():
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()

    try:
        # 1. Seed Drawers if empty
        if db.query(Drawer).count() == 0:
            drawers = []
            # 30 Small Drawers: 5 rows x 6 cols (S01 to S30)
            small_idx = 1
            for row in range(1, 6):
                for col in range(1, 7):
                    drawer_id = f"S{small_idx:02d}"
                    drawers.append(
                        Drawer(
                            id=drawer_id,
                            section="UPPER",
                            drawer_type="SMALL",
                            row_idx=row,
                            col_idx=col,
                            dimensions="13.5 x 5.0 x 3.5 cm",
                            notes=f"Upper matrix Row {row}, Col {col}",
                        )
                    )
                    small_idx += 1

            # 9 Large Drawers: 3 rows x 3 cols (L01 to L09)
            large_idx = 1
            for row in range(1, 4):
                for col in range(1, 4):
                    drawer_id = f"L{large_idx:02d}"
                    drawers.append(
                        Drawer(
                            id=drawer_id,
                            section="LOWER",
                            drawer_type="LARGE",
                            row_idx=row,
                            col_idx=col,
                            dimensions="13.5 x 11.0 x 6.0 cm",
                            notes=f"Lower matrix Row {row}, Col {col}",
                        )
                    )
                    large_idx += 1

            db.add_all(drawers)
            db.commit()
            print("Successfully seeded 39 Stanley drawers (30 Small, 9 Large).")

        # 2. Seed Suppliers if empty
        if db.query(Supplier).count() == 0:
            suppliers = [
                Supplier(name="Schneider Electric India", contact_email="stores@schneider.in", phone="+91-80-4567-8901"),
                Supplier(name="Polycab Networks & Cables", contact_email="orders@polycab.com", phone="+91-22-2432-1100"),
                Supplier(name="Danfoss Industrial Solutions", contact_email="hvac@danfoss.com", phone="+91-44-6789-2233"),
                Supplier(name="Kirloskar Power Systems", contact_email="spares@kirloskar.com", phone="+91-20-2567-9988"),
                Supplier(name="Mouser Electronics Tech", contact_email="orders@mouser.com", phone="+91-80-6712-4000"),
            ]
            db.add_all(suppliers)
            db.commit()

        # 3. Seed Items if empty
        if db.query(Item).count() == 0:
            sup_schneider = db.query(Supplier).filter_by(name="Schneider Electric India").first()
            sup_polycab = db.query(Supplier).filter_by(name="Polycab Networks & Cables").first()
            sup_danfoss = db.query(Supplier).filter_by(name="Danfoss Industrial Solutions").first()
            sup_kirloskar = db.query(Supplier).filter_by(name="Kirloskar Power Systems").first()
            sup_mouser = db.query(Supplier).filter_by(name="Mouser Electronics Tech").first()

            items_data = [
                Item(
                    sku="MCB-63A-3P",
                    name="Triple Pole 63A Miniature Circuit Breaker (10kA)",
                    description="Heavy duty 3-phase miniature circuit breaker for distribution panel boards",
                    category="Electrical",
                    min_stock_threshold=2,
                    unit="pcs",
                    unit_cost=1450.0,
                ),
                Item(
                    sku="CAT6-50M-SHLD",
                    name="Shielded Twisted Pair Cat6 Ethernet Cable Drum",
                    description="50-meter outdoor shielded Cat6 UV-resistant network cable spool",
                    category="Network",
                    min_stock_threshold=5,
                    unit="drums",
                    unit_cost=3200.0,
                ),
                Item(
                    sku="R410A-11KG",
                    name="Eco-Friendly Refrigerant Gas Cylinder (HVAC Chiller)",
                    description="Non-ozone depleting R410A pressurized refrigerant cylinder 11.3kg",
                    category="HVAC",
                    min_stock_threshold=2,
                    unit="cylinders",
                    unit_cost=8500.0,
                ),
                Item(
                    sku="DG-FILTER-48KVA",
                    name="Diesel Generator High-Flow Oil Filter Cartridge",
                    description="Spin-on lubricating oil filter for 40-50kVA standby DG sets",
                    category="HVAC",
                    min_stock_threshold=2,
                    unit="pcs",
                    unit_cost=980.0,
                ),
                Item(
                    sku="ESP32-DEV-01",
                    name="ESP32 Development Board WiFi + BLE",
                    description="Dual-core Xtensa 32-bit LX6 microcontroller with integrated 2.4GHz Wi-Fi and Bluetooth",
                    category="Microcontrollers",
                    min_stock_threshold=3,
                    unit="pcs",
                    unit_cost=250.0,
                ),
                Item(
                    sku="ARD-NANO-01",
                    name="Arduino Nano V3.0 ATmega328P CH340",
                    description="Compact breadboard-friendly microcontroller with USB Mini-B",
                    category="Microcontrollers",
                    min_stock_threshold=4,
                    unit="pcs",
                    unit_cost=180.0,
                ),
                Item(
                    sku="RES-10K-01",
                    name="10K Resistor 1/4W 1% (Pack of 50)",
                    description="Metal film high precision pull-up resistors for logic circuits",
                    category="Passives",
                    min_stock_threshold=20,
                    unit="packs",
                    unit_cost=45.0,
                ),
                Item(
                    sku="HC-SR04-01",
                    name="HC-SR04 Ultrasonic Distance Sensor",
                    description="Ultrasonic ranging module 2cm - 400cm non-contact distance measurement",
                    category="Sensors",
                    min_stock_threshold=2,
                    unit="pcs",
                    unit_cost=110.0,
                ),
            ]
            db.add_all(items_data)
            db.commit()

            # Create projects
            proj = Project(
                name="Campus Main Electrical Maintenance 2026",
                description="Power board and panel repairs for Hall B & C",
                lead_name="S. Venkatesh",
                status="ACTIVE",
            )
            db.add(proj)
            db.commit()

            # Seed Stock Distribution into Drawers:
            # MCB-63A-3P in S04: 3 units received, 1 reserved for B-204
            item_mcb = db.query(Item).filter_by(sku="MCB-63A-3P").first()
            lot_mcb = StockLot(
                lot_number="LOT-MCB-2026-01",
                item_id=item_mcb.id,
                supplier_id=sup_schneider.id,
                quantity_received=3,
                unit_cost=1450.0,
                purchase_date=datetime.utcnow() - timedelta(days=12),
            )
            db.add(lot_mcb)
            db.commit()

            db.add(StockLocation(item_id=item_mcb.id, drawer_id="S04", lot_id=lot_mcb.id, quantity=3))
            db.add(
                InventoryTransaction(
                    item_id=item_mcb.id,
                    drawer_id="S04",
                    lot_id=lot_mcb.id,
                    change_qty=3,
                    balance_after=3,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-8801",
                    notes="Initial receipt of 3-pole circuit breakers",
                )
            )

            # Requisition REQ-8821 for MCB
            res = Reservation(
                requisition_code="REQ-8821",
                project_id=proj.id,
                item_id=item_mcb.id,
                drawer_id="S04",
                quantity=1,
                status="PENDING",
                requester="Rajesh Kumar (Lead Tech)",
                target_location="Hall B-204 Main Power Outage",
                priority="HIGH_EXAM",
            )
            db.add(res)

            # CAT6-50M-SHLD in L02: 14 units
            item_cat6 = db.query(Item).filter_by(sku="CAT6-50M-SHLD").first()
            lot_cat6 = StockLot(
                lot_number="LOT-CAT6-2026-01",
                item_id=item_cat6.id,
                supplier_id=sup_polycab.id,
                quantity_received=14,
                unit_cost=3200.0,
                purchase_date=datetime.utcnow() - timedelta(days=20),
            )
            db.add(lot_cat6)
            db.commit()
            db.add(StockLocation(item_id=item_cat6.id, drawer_id="L02", lot_id=lot_cat6.id, quantity=14))
            db.add(
                InventoryTransaction(
                    item_id=item_cat6.id,
                    drawer_id="L02",
                    lot_id=lot_cat6.id,
                    change_qty=14,
                    balance_after=14,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-7731",
                    notes="Networking spool restock",
                )
            )

            # R410A-11KG in L08: 4 units
            item_r410a = db.query(Item).filter_by(sku="R410A-11KG").first()
            lot_r410a = StockLot(
                lot_number="LOT-R410A-2026-01",
                item_id=item_r410a.id,
                supplier_id=sup_danfoss.id,
                quantity_received=4,
                unit_cost=8500.0,
            )
            db.add(lot_r410a)
            db.commit()
            db.add(StockLocation(item_id=item_r410a.id, drawer_id="L08", lot_id=lot_r410a.id, quantity=4))
            db.add(
                InventoryTransaction(
                    item_id=item_r410a.id,
                    drawer_id="L08",
                    lot_id=lot_r410a.id,
                    change_qty=4,
                    balance_after=4,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-6644",
                    notes="Summer chiller maintenance prep",
                )
            )

            # DG-FILTER-48KVA in L05: 3 units
            item_dg = db.query(Item).filter_by(sku="DG-FILTER-48KVA").first()
            lot_dg = StockLot(
                lot_number="LOT-DG-2026-01",
                item_id=item_dg.id,
                supplier_id=sup_kirloskar.id,
                quantity_received=3,
                unit_cost=980.0,
            )
            db.add(lot_dg)
            db.commit()
            db.add(StockLocation(item_id=item_dg.id, drawer_id="L05", lot_id=lot_dg.id, quantity=3))
            db.add(
                InventoryTransaction(
                    item_id=item_dg.id,
                    drawer_id="L05",
                    lot_id=lot_dg.id,
                    change_qty=3,
                    balance_after=3,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-5512",
                    notes="Backup generator service kit",
                )
            )

            # ESP32-DEV-01 in S12: 8 units
            item_esp32 = db.query(Item).filter_by(sku="ESP32-DEV-01").first()
            lot_esp32 = StockLot(
                lot_number="LOT-ESP32-2026-01",
                item_id=item_esp32.id,
                supplier_id=sup_mouser.id,
                quantity_received=10,
                unit_cost=250.0,
            )
            db.add(lot_esp32)
            db.commit()
            db.add(StockLocation(item_id=item_esp32.id, drawer_id="S12", lot_id=lot_esp32.id, quantity=8))
            db.add(
                InventoryTransaction(
                    item_id=item_esp32.id,
                    drawer_id="S12",
                    lot_id=lot_esp32.id,
                    change_qty=10,
                    balance_after=10,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-00125",
                    notes="Parcel TRACK123456 intake",
                )
            )
            db.add(
                InventoryTransaction(
                    item_id=item_esp32.id,
                    drawer_id="S12",
                    lot_id=lot_esp32.id,
                    change_qty=-2,
                    balance_after=8,
                    action_type="CONSUME",
                    reference_doc="LAB-TEST-01",
                    notes="2 boards used for IoT gateway prototyping",
                )
            )

            # Arduino Nano distributed in S01 (4 pcs) and S02 (6 pcs)
            item_nano = db.query(Item).filter_by(sku="ARD-NANO-01").first()
            lot_nano = StockLot(
                lot_number="LOT-NANO-2026-01",
                item_id=item_nano.id,
                supplier_id=sup_mouser.id,
                quantity_received=10,
                unit_cost=180.0,
            )
            db.add(lot_nano)
            db.commit()
            db.add(StockLocation(item_id=item_nano.id, drawer_id="S01", lot_id=lot_nano.id, quantity=4))
            db.add(StockLocation(item_id=item_nano.id, drawer_id="S02", lot_id=lot_nano.id, quantity=6))
            db.add(
                InventoryTransaction(
                    item_id=item_nano.id,
                    drawer_id="S01",
                    lot_id=lot_nano.id,
                    change_qty=4,
                    balance_after=4,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-00125",
                    notes="Batch split: Tray A to S01",
                )
            )
            db.add(
                InventoryTransaction(
                    item_id=item_nano.id,
                    drawer_id="S02",
                    lot_id=lot_nano.id,
                    change_qty=6,
                    balance_after=6,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-00125",
                    notes="Batch split: Tray B to S02",
                )
            )

            # HC-SR04 in L01: 3 units
            item_hcsr04 = db.query(Item).filter_by(sku="HC-SR04-01").first()
            lot_hc = StockLot(
                lot_number="LOT-HCSR04-2026-01",
                item_id=item_hcsr04.id,
                supplier_id=sup_mouser.id,
                quantity_received=3,
                unit_cost=110.0,
            )
            db.add(lot_hc)
            db.commit()
            db.add(StockLocation(item_id=item_hcsr04.id, drawer_id="L01", lot_id=lot_hc.id, quantity=3))
            db.add(
                InventoryTransaction(
                    item_id=item_hcsr04.id,
                    drawer_id="L01",
                    lot_id=lot_hc.id,
                    change_qty=3,
                    balance_after=3,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-00125",
                    notes="Sonar sensors received",
                )
            )

            # Resistors in S03: 120 packs
            item_res = db.query(Item).filter_by(sku="RES-10K-01").first()
            lot_res = StockLot(
                lot_number="LOT-RES-2026-01",
                item_id=item_res.id,
                supplier_id=sup_mouser.id,
                quantity_received=120,
                unit_cost=45.0,
            )
            db.add(lot_res)
            db.commit()
            db.add(StockLocation(item_id=item_res.id, drawer_id="S03", lot_id=lot_res.id, quantity=120))
            db.add(
                InventoryTransaction(
                    item_id=item_res.id,
                    drawer_id="S03",
                    lot_id=lot_res.id,
                    change_qty=120,
                    balance_after=120,
                    action_type="RECEIVE",
                    reference_doc="INV-2026-00125",
                    notes="Bulk resistor packs stored in S03",
                )
            )

            db.commit()
            print("Successfully seeded catalog items, stock lots, locations, and transaction history.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
