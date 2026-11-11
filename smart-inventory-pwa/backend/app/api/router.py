from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session

from backend.app.database.connection import get_db
from backend.app.schemas.inventory import (
    DrawerSummary,
    DrawerDetail,
    ItemResponse,
    ItemCreate,
    ItemUpdate,
    StockReceiveRequest,
    StockConsumeRequest,
    StockTransferRequest,
    StockAdjustRequest,
    DashboardStats,
    TransactionResponse,
    SyncBatchRequest,
    SyncBatchResponse,
    DrawerLabelQr,
    ParsedInvoiceResponse,
    InvoiceCommitRequest,
    InvoiceSummaryResponse,
)
from backend.app.services.inventory_service import InventoryService
from backend.app.services.invoice_parser import parse_invoice_document
from backend.app.database.models import Item

api_router = APIRouter()


# ===================== DRAWERS =====================
@api_router.get("/drawers", response_model=List[DrawerSummary], summary="Get all 39 Stanley cabinet drawers")
def get_drawers(db: Session = Depends(get_db)):
    return InventoryService.get_all_drawers(db)


@api_router.get("/drawers/{drawer_id}", response_model=DrawerDetail, summary="Get details and contents of a specific drawer")
def get_drawer_detail(drawer_id: str, db: Session = Depends(get_db)):
    detail = InventoryService.get_drawer_detail(db, drawer_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Drawer '{drawer_id}' not found.")
    return detail


# ===================== ITEMS =====================
@api_router.get("/items", response_model=List[ItemResponse], summary="List all components in inventory")
def list_items(
    q: Optional[str] = Query(None, description="Search term for SKU, name, or description"),
    category: Optional[str] = Query(None, description="Filter by category"),
    db: Session = Depends(get_db),
):
    return InventoryService.get_items(db, query=q, category=category)


@api_router.post("/items", response_model=ItemResponse, summary="Register a new component catalog item")
def create_item(item_in: ItemCreate, db: Session = Depends(get_db)):
    existing = db.query(Item).filter_by(sku=item_in.sku).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Item with SKU '{item_in.sku}' already exists.")

    item = Item(
        sku=item_in.sku.strip().upper(),
        name=item_in.name,
        description=item_in.description,
        category=item_in.category,
        min_stock_threshold=item_in.min_stock_threshold,
        unit=item_in.unit,
        unit_cost=item_in.unit_cost,
        datasheet_url=item_in.datasheet_url,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    items = InventoryService.get_items(db, query=item.sku)
    return items[0]


@api_router.patch("/items/{item_id}", response_model=ItemResponse, summary="Update component metadata")
def update_item(item_id: int, item_in: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter_by(id=item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"Item ID {item_id} not found.")

    update_data = item_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    db.commit()
    db.refresh(item)
    items = InventoryService.get_items(db, query=item.sku)
    return items[0]


# ===================== STOCK MOVEMENTS =====================
@api_router.post("/stock/receive", summary="Receive incoming parcel/components into a Stanley drawer")
def receive_stock(req: StockReceiveRequest, db: Session = Depends(get_db)):
    try:
        return InventoryService.receive_stock(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Stock intake failed: {str(e)}")


@api_router.post("/stock/consume", summary="Consume/deduct components from a drawer")
def consume_stock(req: StockConsumeRequest, db: Session = Depends(get_db)):
    try:
        return InventoryService.consume_stock(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Stock deduction failed: {str(e)}")


@api_router.post("/stock/transfer", summary="Transfer stock between two physical drawers")
def transfer_stock(req: StockTransferRequest, db: Session = Depends(get_db)):
    try:
        return InventoryService.transfer_stock(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Stock transfer failed: {str(e)}")


@api_router.post("/stock/adjust", summary="Audit adjustment for physical stock discrepancies")
def adjust_stock(req: StockAdjustRequest, db: Session = Depends(get_db)):
    try:
        return InventoryService.adjust_stock(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Stock adjustment failed: {str(e)}")


# ===================== STATS & TRANSACTIONS =====================
@api_router.get("/dashboard/stats", response_model=DashboardStats, summary="Retrieve high-level dashboard metrics")
def get_dashboard_stats(db: Session = Depends(get_db)):
    return InventoryService.get_dashboard_stats(db)


@api_router.get("/transactions", response_model=List[TransactionResponse], summary="Retrieve auditable transaction ledger")
def get_transactions(limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    return InventoryService.get_transactions(db, limit=limit)


# ===================== SEARCH =====================
@api_router.get("/search", summary="Search across SKUs, invoices, parcels and drawers")
def search(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    return InventoryService.search(db, q)


# ===================== INVOICE PARSE & COMMIT =====================
@api_router.post(
    "/invoices/parse",
    response_model=ParsedInvoiceResponse,
    summary="Upload and extract electronic components & dates from an invoice PDF, DOCX, CSV, TXT, or JSON",
)
async def parse_invoice_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    filename = file.filename or "invoice.pdf"
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Uploaded file exceeds 25 MB limit.")
    try:
        return parse_invoice_document(content, filename, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse invoice '{filename}': {str(e)}")


@api_router.post(
    "/invoices/commit",
    summary="Commit reviewed invoice items with confirmed quantities & drawers atomically",
)
def commit_invoice_endpoint(
    req: InvoiceCommitRequest,
    db: Session = Depends(get_db),
):
    try:
        return InventoryService.commit_invoice(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Invoice commit failed: {str(e)}")


@api_router.get(
    "/invoices",
    response_model=List[InvoiceSummaryResponse],
    summary="List logged invoices with order date, arrival time, and compartment assignments",
)
def get_invoices(
    q: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
):
    return InventoryService.list_invoices(db, query=q, limit=limit)


@api_router.get(
    "/invoices/{invoice_id}",
    response_model=InvoiceSummaryResponse,
    summary="Get full breakdown for a logged invoice",
)
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    try:
        return InventoryService.get_invoice_detail(db, invoice_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ===================== QR CODES =====================
@api_router.get("/qr/code", summary="Generate QR code data URI for any identifier")
def get_qr_code(code: str = Query(..., description="String to encode, e.g. DRAWER:S12 or ITEM:MCB-63A-3P")):
    data_uri = InventoryService.generate_qr_svg(code)
    return {"code": code, "data_uri": data_uri}


@api_router.get("/qr/drawer-labels", response_model=List[DrawerLabelQr], summary="Generate all 39 drawer QR codes for printing")
def get_all_drawer_labels(db: Session = Depends(get_db)):
    drawers = InventoryService.get_all_drawers(db)
    labels = []
    for d in drawers:
        code = f"DRAWER:{d.id}"
        labels.append({
            "drawer_id": d.id,
            "section": d.section,
            "type": d.drawer_type,
            "dimensions": d.dimensions,
            "code": code,
            "qr_data_uri": InventoryService.generate_qr_svg(code),
        })
    return labels


# ===================== OFFLINE SYNC BATCH =====================
@api_router.post("/sync/batch", response_model=SyncBatchResponse, summary="Batch synchronize queued offline operations with idempotency")
def sync_batch(batch_req: SyncBatchRequest, db: Session = Depends(get_db)):
    return InventoryService.process_batch_sync(db, batch_req)
