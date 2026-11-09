import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.app.database.connection import SessionLocal
from backend.app.services.inventory_service import InventoryService
from backend.app.schemas.inventory import (
    StockReceiveRequest,
    StockConsumeRequest,
    StockTransferRequest,
    StockAdjustRequest,
)

def run_tests():
    db = SessionLocal()
    try:
        print("1. Testing get_all_drawers()...")
        drawers = InventoryService.get_all_drawers(db)
        print(f"Total drawers: {len(drawers)}")
        assert len(drawers) == 39

        print("2. Testing get_drawer_detail('S12')...")
        d12 = InventoryService.get_drawer_detail(db, "S12")
        print(f"Drawer S12 items: {[it.sku for it in d12.items]}")
        assert d12.id == "S12"

        print("3. Testing get_dashboard_stats()...")
        stats = InventoryService.get_dashboard_stats(db)
        print(f"Dashboard Stats: SKUs={stats.skus_monitored}, Occupied={stats.occupied_drawers}, Empty={stats.empty_drawers}, Budget={stats.procurement_budget_remaining}")
        assert stats.total_drawers == 39

        print("4. Testing receive_stock into S25...")
        recv_req = StockReceiveRequest(
            item_sku="NE555-DIP8",
            item_name="NE555 Precision Timer IC DIP-8",
            category="Passives",
            quantity=25,
            supplier="Mouser Electronics Tech",
            drawer_id="S25",
            unit_price=15.0,
            invoice_number="INV-2026-NE555",
            tracking_code="TRACK-NE555-01",
            notes="Precision timers stock",
        )
        res_recv = InventoryService.receive_stock(db, recv_req)
        print("Receive result:", res_recv["message"])
        assert res_recv["status"] == "success"

        print("5. Testing consume_stock from S25...")
        cons_req = StockConsumeRequest(
            sku="NE555-DIP8",
            drawer_id="S25",
            quantity=5,
            requester="Gowthum Vijaay",
            project_name="Pulse Generator Project",
        )
        res_cons = InventoryService.consume_stock(db, cons_req)
        print("Consume result:", res_cons["message"])
        assert res_cons["remaining_in_drawer"] == 20

        print("6. Testing transfer_stock from S25 to S26...")
        trans_req = StockTransferRequest(
            sku="NE555-DIP8",
            from_drawer_id="S25",
            to_drawer_id="S26",
            quantity=5,
            notes="Moved batch to S26",
        )
        res_trans = InventoryService.transfer_stock(db, trans_req)
        print("Transfer result:", res_trans["message"])
        assert res_trans["from_drawer_qty"] == 15
        assert res_trans["to_drawer_qty"] == 5

        print("7. Testing approve_requisition('REQ-8821')...")
        res_app = InventoryService.approve_requisition(db, "REQ-8821", "S. Venkatesh")
        print("Approval result:", res_app["message"])
        assert res_app["status"] == "success"

        print("8. Testing get_transactions()...")
        txs = InventoryService.get_transactions(db, limit=10)
        print(f"Retrieved {len(txs)} transactions.")
        assert len(txs) >= 4

        print("9. Testing search()...")
        search_res = InventoryService.search(db, "ESP32")
        print(f"Search results for ESP32: {len(search_res['items'])} items found.")
        assert len(search_res["items"]) >= 1

        print("10. Testing QR generation...")
        qr_uri = InventoryService.generate_qr_svg("DRAWER:S12")
        assert qr_uri.startswith("data:image/png;base64,")
        print("QR URI generated successfully.")

        print("\n>>> ALL 10 CORE SERVICES VERIFIED PERFECTLY! <<<")
    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
