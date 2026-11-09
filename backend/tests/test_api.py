import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database.seed import seed_database

client = TestClient(app)


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    seed_database()


def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert "STANLEY 1-93-981" in data["cabinet"]


def test_get_all_drawers_count():
    response = client.get("/api/drawers")
    assert response.status_code == 200
    drawers = response.json()
    assert len(drawers) == 39

    small_drawers = [d for d in drawers if d["drawer_type"] == "SMALL"]
    large_drawers = [d for d in drawers if d["drawer_type"] == "LARGE"]

    assert len(small_drawers) == 30
    assert len(large_drawers) == 9
    assert small_drawers[0]["id"] == "S01"
    assert small_drawers[-1]["id"] == "S30"
    assert large_drawers[0]["id"] == "L01"
    assert large_drawers[-1]["id"] == "L09"


def test_get_drawer_detail():
    response = client.get("/api/drawers/S12")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "S12"
    assert data["drawer_type"] == "SMALL"
    assert data["is_occupied"] is True
    assert any(item["sku"] == "ESP32-DEV-01" for item in data["items"])


def test_get_dashboard_stats():
    response = client.get("/api/dashboard/stats")
    assert response.status_code == 200
    stats = response.json()
    assert stats["skus_monitored"] >= 4
    assert stats["total_drawers"] == 39
    assert stats["active_reservations"] >= 1
    assert stats["procurement_budget_remaining"] == 42500.0


def test_receive_and_consume_stock():
    # 1. Receive 5 units of OLED display into drawer S15
    receive_payload = {
        "item_sku": "OLED-0.96-I2C",
        "item_name": "0.96 inch I2C OLED Display Module 128x64",
        "category": "Displays",
        "quantity": 5,
        "supplier": "Mouser Electronics Tech",
        "drawer_id": "S15",
        "unit_price": 220.0,
        "invoice_number": "INV-2026-TEST-01",
        "tracking_code": "TRACK-TEST-88",
        "notes": "Test batch arrival",
    }
    recv_resp = client.post("/api/stock/receive", json=receive_payload)
    assert recv_resp.status_code == 200
    recv_data = recv_resp.json()
    assert recv_data["status"] == "success"
    assert recv_data["total_drawer_qty"] == 5

    # Verify drawer S15 shows the item
    d_resp = client.get("/api/drawers/S15")
    assert d_resp.status_code == 200
    d_data = d_resp.json()
    assert d_data["is_occupied"] is True
    assert any(it["sku"] == "OLED-0.96-I2C" and it["quantity"] == 5 for it in d_data["items"])

    # 2. Consume 2 units from S15
    consume_payload = {
        "sku": "OLED-0.96-I2C",
        "drawer_id": "S15",
        "quantity": 2,
        "requester": "Gowthum Vijaay",
        "project_name": "Smart Cabinet Head Display",
    }
    cons_resp = client.post("/api/stock/consume", json=consume_payload)
    assert cons_resp.status_code == 200
    cons_data = cons_resp.json()
    assert cons_data["remaining_in_drawer"] == 3


def test_transfer_stock():
    # Transfer 1 unit of OLED from S15 to S16
    transfer_payload = {
        "sku": "OLED-0.96-I2C",
        "from_drawer_id": "S15",
        "to_drawer_id": "S16",
        "quantity": 1,
        "notes": "Relocating sample unit to S16",
    }
    trans_resp = client.post("/api/stock/transfer", json=transfer_payload)
    assert trans_resp.status_code == 200
    trans_data = trans_resp.json()
    assert trans_data["from_drawer_qty"] == 2
    assert trans_data["to_drawer_qty"] == 1


def test_approve_requisition():
    # Dispatch REQ-8821
    req_payload = {
        "requisition_code": "REQ-8821",
        "approved_by": "Stores & Procurement Manager",
        "notes": "Urgent exam hall power maintenance",
    }
    resp = client.post("/api/requisitions/dispatch", json=req_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "approved & dispatched" in data["message"].lower()


def test_qr_generation():
    resp = client.get("/api/qr/code?code=DRAWER:S12")
    assert resp.status_code == 200
    data = resp.json()
    assert data["code"] == "DRAWER:S12"
    assert data["data_uri"].startswith("data:image/png;base64,")


def test_qr_drawer_labels_all():
    resp = client.get("/api/qr/drawer-labels")
    assert resp.status_code == 200
    labels = resp.json()
    assert len(labels) == 39
    assert labels[0]["drawer_id"] == "S01"
    assert labels[0]["qr_data_uri"].startswith("data:image/png;base64,")


def test_sync_batch():
    batch_payload = {
        "operations": [
            {
                "client_op_id": "mob-sync-uuid-001",
                "action": "RECEIVE",
                "payload": {
                    "item_sku": "POT-10K-ROT",
                    "item_name": "10K Rotary Potentiometer",
                    "category": "Passives",
                    "quantity": 12,
                    "drawer_id": "S20",
                    "unit_price": 30.0,
                },
            }
        ]
    }
    resp = client.post("/api/sync/batch", json=batch_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["synced_count"] == 1
    assert data["results"][0]["status"] == "CONFIRMED"
