import asyncio
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from backend.app.main import app



async def main():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Root
        r = await client.get("/")
        print("Root response:", r.status_code, r.json())
        assert r.status_code == 200

        # 2. Drawers list
        r = await client.get("/api/drawers")
        drawers = r.json()
        print(f"Total drawers returned: {len(drawers)}")
        assert len(drawers) == 39

        # 3. Drawer S12 detail
        r = await client.get("/api/drawers/S12")
        d12 = r.json()
        print(f"Drawer S12 items: {[it['sku'] for it in d12['items']]}")
        assert d12["id"] == "S12"

        # 4. Dashboard Stats
        r = await client.get("/api/dashboard/stats")
        stats = r.json()
        print(f"Dashboard Stats: SKUs={stats['skus_monitored']}, Availability={stats['stock_availability_pct']}%, Budget=Rs {stats['procurement_budget_remaining']}")
        assert stats["total_drawers"] == 39

        # 5. Receive stock into S22
        recv_payload = {
            "item_sku": "STM32F103C8T6",
            "item_name": "Blue Pill STM32 ARM Cortex-M3 Development Board",
            "category": "Microcontrollers",
            "quantity": 6,
            "supplier": "Mouser Electronics Tech",
            "drawer_id": "S22",
            "unit_price": 280.0,
            "invoice_number": "INV-2026-STM",
            "tracking_code": "TRACK-BLUEPILL-99",
            "notes": "Fast verification test",
        }
        r = await client.post("/api/stock/receive", json=recv_payload)
        print("Receive status:", r.status_code, r.json()["message"])
        assert r.status_code == 200

        # 6. Consume 2 units from S22
        cons_payload = {
            "sku": "STM32F103C8T6",
            "drawer_id": "S22",
            "quantity": 2,
            "requester": "Gowthum Vijaay",
            "project_name": "Embedded Controller",
        }
        r = await client.post("/api/stock/consume", json=cons_payload)
        print("Consume status:", r.status_code, r.json()["message"])
        assert r.status_code == 200

        # 7. Transfer 1 unit from S22 to S23
        trans_payload = {
            "sku": "STM32F103C8T6",
            "from_drawer_id": "S22",
            "to_drawer_id": "S23",
            "quantity": 1,
            "notes": "Relocation test",
        }
        r = await client.post("/api/stock/transfer", json=trans_payload)
        print("Transfer status:", r.status_code, r.json()["message"])
        assert r.status_code == 200

        # 8. Approve & Dispatch Requisition REQ-8821
        r = await client.post("/api/requisitions/dispatch", json={"requisition_code": "REQ-8821"})
        print("Requisition dispatch:", r.status_code, r.json()["message"])
        assert r.status_code == 200

        # 9. QR Drawer Labels
        r = await client.get("/api/qr/drawer-labels")
        labels = r.json()
        print(f"Generated QR labels count: {len(labels)}")
        assert len(labels) == 39
        assert labels[0]["qr_data_uri"].startswith("data:image/png;base64,")

        # 10. Audit Transactions
        r = await client.get("/api/transactions")
        txs = r.json()
        print(f"Recorded transaction ledger count: {len(txs)}")
        assert len(txs) > 0

        print("\nALL 10 BACKEND INTEGRATION TESTS PASSED PERFECTLY!")


if __name__ == "__main__":
    asyncio.run(main())
