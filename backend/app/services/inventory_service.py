import io
import json
import uuid
import base64
from datetime import datetime
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

import qrcode
import qrcode.image.svg

from backend.app.database.models import (
    Drawer,
    Item,
    StockLocation,
    StockLot,
    Parcel,
    Invoice,
    InvoiceItem,
    InventoryTransaction,
    SyncQueue,
)
from backend.app.schemas.inventory import (
    DrawerSummary,
    DrawerDetail,
    DrawerStockItem,
    ItemResponse,
    ItemLocation,
    StockReceiveRequest,
    StockConsumeRequest,
    StockTransferRequest,
    StockAdjustRequest,
    DashboardStats,
    TransactionResponse,
    SyncBatchRequest,
    SyncBatchResponse,
    InvoiceCommitRequest,
    InvoiceSummaryResponse,
    InvoiceItemDetailResponse,
)


class InventoryService:

    @staticmethod
    def get_all_drawers(db: Session) -> List[DrawerSummary]:
        drawers = db.query(Drawer).order_by(Drawer.id).all()
        summaries = []

        for d in drawers:
            total_qty = 0
            items_preview = []
            unique_count = len(d.stock_locations)

            for loc in d.stock_locations:
                total_qty += loc.quantity
                if loc.quantity > 0 and loc.item:
                    items_preview.append(f"{loc.item.sku} ({loc.quantity})")

            is_occupied = total_qty > 0
            status_color = "gray"
            if is_occupied:
                if total_qty > 20:
                    status_color = "coral"
                elif total_qty > 5:
                    status_color = "yellow"
                else:
                    status_color = "blue"

            summaries.append(
                DrawerSummary(
                    id=d.id,
                    section=d.section,
                    drawer_type=d.drawer_type,
                    row_idx=d.row_idx,
                    col_idx=d.col_idx,
                    dimensions=d.dimensions,
                    is_occupied=is_occupied,
                    unique_items_count=unique_count,
                    total_units=total_qty,
                    status_color=status_color,
                    items_preview=items_preview[:3],
                )
            )
        return summaries

    @staticmethod
    def get_drawer_detail(db: Session, drawer_id: str) -> Optional[DrawerDetail]:
        d = db.query(Drawer).filter(Drawer.id == drawer_id.upper()).first()
        if not d:
            return None

        items_detail = []
        total_units = 0

        for loc in d.stock_locations:
            if loc.quantity > 0 and loc.item:
                total_units += loc.quantity
                items_detail.append(
                    DrawerStockItem(
                        sku=loc.item.sku,
                        name=loc.item.name,
                        category=loc.item.category,
                        quantity=loc.quantity,
                        unit=loc.item.unit,
                        unit_cost=loc.item.unit_cost,
                        sub_tray=loc.sub_tray or "MAIN",
                    )
                )

        return DrawerDetail(
            id=d.id,
            section=d.section,
            drawer_type=d.drawer_type,
            row_idx=d.row_idx,
            col_idx=d.col_idx,
            dimensions=d.dimensions,
            is_occupied=total_units > 0,
            total_units=total_units,
            items=items_detail,
        )

    @staticmethod
    def get_items(
        db: Session,
        query: Optional[str] = None,
        category: Optional[str] = None,
    ) -> List[ItemResponse]:
        q = db.query(Item)

        if query:
            pattern = f"%{query.strip()}%"
            q = q.filter(
                or_(
                    Item.sku.ilike(pattern),
                    Item.name.ilike(pattern),
                    Item.description.ilike(pattern),
                )
            )

        if category and category.upper() != "ALL":
            q = q.filter(Item.category.ilike(category.strip()))

        items = q.order_by(Item.sku).all()
        results = []

        for it in items:
            total_avail = sum(loc.quantity for loc in it.stock_locations)
            locations = [
                ItemLocation(
                    drawer_id=loc.drawer_id,
                    quantity=loc.quantity,
                    sub_tray=loc.sub_tray or "MAIN",
                )
                for loc in it.stock_locations
                if loc.quantity > 0
            ]

            last_order, last_delivery = InventoryService._latest_item_dates(it)

            results.append(
                ItemResponse(
                    id=it.id,
                    sku=it.sku,
                    name=it.name,
                    description=it.description,
                    category=it.category,
                    min_stock_threshold=it.min_stock_threshold,
                    unit=it.unit,
                    unit_cost=it.unit_cost,
                    datasheet_url=it.datasheet_url,
                    total_available=total_avail,
                    is_low_stock=total_avail <= it.min_stock_threshold,
                    last_order_date=last_order,
                    last_delivery_time=last_delivery,
                    locations=locations,
                )
            )
        return results

    @staticmethod
    def _latest_item_dates(it: Item) -> Tuple[Optional[datetime], Optional[datetime]]:
        lots_sorted = sorted(it.lots, key=lambda l: l.id or 0, reverse=True)
        txs_sorted = sorted(it.transactions, key=lambda t: t.id or 0, reverse=True)
        last_order = next((l.order_date for l in lots_sorted if l.order_date), None)
        if not last_order:
            last_order = next((t.order_date for t in txs_sorted if t.order_date), None)
        last_delivery = next((l.delivery_arrival_time for l in lots_sorted if l.delivery_arrival_time), None)
        if not last_delivery:
            last_delivery = next((t.delivery_arrival_time for t in txs_sorted if t.delivery_arrival_time), None)
        return last_order, last_delivery

    @staticmethod
    def _upsert_stock_in_session(
        db: Session,
        *,
        sku: str,
        item_name: Optional[str],
        category: str,
        unit: str,
        quantity: int,
        unit_price: float,
        drawer_id: str,
        sub_tray: str = "MAIN",
        supplier: Optional[str] = None,
        invoice_number: Optional[str] = None,
        tracking_code: Optional[str] = None,
        order_date: Optional[datetime] = None,
        delivery_arrival_time: Optional[datetime] = None,
        notes: Optional[str] = None,
    ) -> Tuple[Item, Drawer, int]:
        drawer = db.query(Drawer).filter(Drawer.id == drawer_id.strip().upper()).first()
        if not drawer:
            raise ValueError(f"Target drawer '{drawer_id}' does not exist.")

        clean_sku = sku.strip().upper()
        item = db.query(Item).filter(Item.sku == clean_sku).first()
        clean_name = (item_name or "").strip()

        if not item:
            item = Item(
                sku=clean_sku,
                name=clean_name or clean_sku,
                category=category or "General",
                unit=unit or "pcs",
                unit_cost=unit_price or 0.0,
            )
            db.add(item)
            db.flush()
        else:
            if item.name == item.sku and clean_name:
                item.name = clean_name
            if (not item.unit_cost or item.unit_cost == 0.0) and unit_price > 0:
                item.unit_cost = unit_price

        loc = (
            db.query(StockLocation)
            .filter_by(item_id=item.id, drawer_id=drawer.id, sub_tray=sub_tray or "MAIN")
            .first()
        )
        if not loc:
            loc = StockLocation(
                item_id=item.id,
                drawer_id=drawer.id,
                quantity=quantity,
                sub_tray=sub_tray or "MAIN",
            )
            db.add(loc)
        else:
            loc.quantity += quantity

        db.flush()

        delivery_dt = delivery_arrival_time or datetime.now().replace(second=0, microsecond=0)
        eff_cost = unit_price if unit_price > 0 else (item.unit_cost or 0.0)

        lot = StockLot(
            lot_number=f"LOT-{clean_sku[:14]}-{uuid.uuid4().hex[:8].upper()}",
            item_id=item.id,
            supplier=supplier or "Standard Vendor",
            invoice_number=invoice_number,
            received_quantity=quantity,
            remaining_quantity=quantity,
            unit_cost=eff_cost,
            order_date=order_date,
            delivery_arrival_time=delivery_dt,
            received_at=delivery_dt,
        )
        db.add(lot)

        total_avail = sum(
            l.quantity
            for l in db.query(StockLocation).filter_by(item_id=item.id).all()
        )

        ref_doc = invoice_number or tracking_code or "RECEIVE-DIRECT"
        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer.id,
            action_type="RECEIVE",
            change_qty=quantity,
            balance_after=total_avail,
            reference_doc=ref_doc,
            notes=notes or f"Received {quantity} {item.unit} into {drawer.id}",
            order_date=order_date,
            delivery_arrival_time=delivery_dt,
        )
        db.add(tx)

        parcel_code = (tracking_code or "").strip()
        if not parcel_code and invoice_number:
            candidate = f"INV:{invoice_number}:{clean_sku}"
            if db.query(Parcel).filter_by(tracking_code=candidate).first():
                candidate = f"INV:{invoice_number}:{clean_sku}:{uuid.uuid4().hex[:6]}"
            parcel_code = candidate

        if parcel_code:
            existing_parcel = db.query(Parcel).filter_by(tracking_code=parcel_code).first()
            if not existing_parcel:
                parcel = Parcel(
                    tracking_code=parcel_code,
                    supplier=supplier or "Standard Vendor",
                    invoice_number=invoice_number,
                    item_sku=clean_sku,
                    drawer_id=drawer.id,
                    quantity=quantity,
                    order_date=order_date,
                    delivery_arrival_time=delivery_dt,
                    notes=notes,
                )
                db.add(parcel)

        # Auto-fulfill any matching YET_TO_BE_DELIVERED item for this SKU
        pending_item = (
            db.query(InvoiceItem)
            .filter(InvoiceItem.sku == clean_sku, InvoiceItem.status == "YET_TO_BE_DELIVERED")
            .first()
        )
        if pending_item:
            pending_item.drawer_id = drawer.id
            pending_item.status = "DELIVERED"
            if pending_item.invoice_id:
                parent_inv = db.query(Invoice).filter(Invoice.id == pending_item.invoice_id).first()
                if parent_inv:
                    rem = (
                        db.query(InvoiceItem)
                        .filter(InvoiceItem.invoice_id == parent_inv.id, InvoiceItem.status == "YET_TO_BE_DELIVERED")
                        .count()
                    )
                    if rem == 0:
                        parent_inv.status = "DELIVERED"

        return item, drawer, total_avail

    @staticmethod
    def receive_stock(db: Session, req: StockReceiveRequest) -> Dict[str, Any]:
        item, drawer, total_avail = InventoryService._upsert_stock_in_session(
            db,
            sku=req.item_sku,
            item_name=req.item_name,
            category=req.category,
            unit=req.unit,
            quantity=req.quantity,
            unit_price=req.unit_price,
            drawer_id=req.drawer_id,
            sub_tray=req.sub_tray,
            supplier=req.supplier,
            invoice_number=req.invoice_number,
            tracking_code=req.tracking_code,
            order_date=req.order_date,
            delivery_arrival_time=req.delivery_arrival_time,
            notes=req.notes,
        )

        db.commit()

        return {
            "status": "success",
            "message": f"Successfully received {req.quantity} {item.unit} of {item.sku} into Drawer {drawer.id}.",
            "item_sku": item.sku,
            "drawer_id": drawer.id,
            "new_balance": total_avail,
        }

    @staticmethod
    def consume_stock(db: Session, req: StockConsumeRequest) -> Dict[str, Any]:
        drawer = db.query(Drawer).filter(Drawer.id == req.drawer_id.upper()).first()
        if not drawer:
            raise ValueError(f"Drawer '{req.drawer_id}' not found.")

        item = None
        if req.sku:
            item = db.query(Item).filter(Item.sku == req.sku.strip().upper()).first()
        elif req.item_id:
            item = db.query(Item).filter(Item.id == req.item_id).first()

        if not item:
            raise ValueError("Item not found.")

        loc = (
            db.query(StockLocation)
            .filter_by(item_id=item.id, drawer_id=drawer.id)
            .first()
        )
        if not loc or loc.quantity < req.quantity:
            available = loc.quantity if loc else 0
            raise ValueError(
                f"Insufficient stock in {drawer.id}. Requested: {req.quantity}, Available: {available}."
            )

        loc.quantity -= req.quantity
        db.flush()

        total_avail = sum(
            l.quantity
            for l in db.query(StockLocation).filter_by(item_id=item.id).all()
        )

        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer.id,
            action_type="CONSUME",
            change_qty=-req.quantity,
            balance_after=total_avail,
            reference_doc=req.project_name or "DIRECT-CONSUMPTION",
            notes=f"Used by {req.requester}. {req.notes or ''}".strip(),
        )
        db.add(tx)
        db.commit()

        return {
            "status": "success",
            "message": f"Deducted {req.quantity} of {item.sku} from Drawer {drawer.id}.",
            "item_sku": item.sku,
            "drawer_id": drawer.id,
            "new_balance": total_avail,
        }

    @staticmethod
    def transfer_stock(db: Session, req: StockTransferRequest) -> Dict[str, Any]:
        from_drawer = db.query(Drawer).filter(Drawer.id == req.from_drawer_id.upper()).first()
        to_drawer = db.query(Drawer).filter(Drawer.id == req.to_drawer_id.upper()).first()

        if not from_drawer or not to_drawer:
            raise ValueError("Source or destination drawer does not exist.")

        item = None
        if req.sku:
            item = db.query(Item).filter(Item.sku == req.sku.strip().upper()).first()
        elif req.item_id:
            item = db.query(Item).filter(Item.id == req.item_id).first()

        if not item:
            raise ValueError("Item not found.")

        source_loc = (
            db.query(StockLocation)
            .filter_by(item_id=item.id, drawer_id=from_drawer.id)
            .first()
        )
        if not source_loc or source_loc.quantity < req.quantity:
            available = source_loc.quantity if source_loc else 0
            raise ValueError(
                f"Insufficient stock in source {from_drawer.id}. Available: {available}."
            )

        source_loc.quantity -= req.quantity

        dest_loc = (
            db.query(StockLocation)
            .filter_by(item_id=item.id, drawer_id=to_drawer.id)
            .first()
        )
        if not dest_loc:
            dest_loc = StockLocation(
                item_id=item.id,
                drawer_id=to_drawer.id,
                quantity=req.quantity,
            )
            db.add(dest_loc)
        else:
            dest_loc.quantity += req.quantity

        db.flush()

        total_avail = sum(
            l.quantity
            for l in db.query(StockLocation).filter_by(item_id=item.id).all()
        )

        db.add(
            InventoryTransaction(
                item_id=item.id,
                drawer_id=from_drawer.id,
                action_type="TRANSFER",
                change_qty=-req.quantity,
                balance_after=total_avail,
                reference_doc=f"TRANSFER->{to_drawer.id}",
                notes=f"Moved {req.quantity} to {to_drawer.id}. {req.notes or ''}",
            )
        )
        db.add(
            InventoryTransaction(
                item_id=item.id,
                drawer_id=to_drawer.id,
                action_type="TRANSFER",
                change_qty=req.quantity,
                balance_after=total_avail,
                reference_doc=f"TRANSFER<-{from_drawer.id}",
                notes=f"Received {req.quantity} from {from_drawer.id}. {req.notes or ''}",
            )
        )

        db.commit()

        return {
            "status": "success",
            "message": f"Transferred {req.quantity} of {item.sku} from {from_drawer.id} to {to_drawer.id}.",
        }

    @staticmethod
    def adjust_stock(db: Session, req: StockAdjustRequest) -> Dict[str, Any]:
        drawer = db.query(Drawer).filter(Drawer.id == req.drawer_id.upper()).first()
        if not drawer:
            raise ValueError("Drawer not found.")

        item = db.query(Item).filter(Item.sku == req.sku.strip().upper()).first()
        if not item:
            raise ValueError("Item not found.")

        loc = (
            db.query(StockLocation)
            .filter_by(item_id=item.id, drawer_id=drawer.id)
            .first()
        )
        old_qty = loc.quantity if loc else 0
        diff = req.physical_count - old_qty

        if not loc:
            loc = StockLocation(
                item_id=item.id,
                drawer_id=drawer.id,
                quantity=req.physical_count,
            )
            db.add(loc)
        else:
            loc.quantity = req.physical_count

        db.flush()

        total_avail = sum(
            l.quantity
            for l in db.query(StockLocation).filter_by(item_id=item.id).all()
        )

        db.add(
            InventoryTransaction(
                item_id=item.id,
                drawer_id=drawer.id,
                action_type="AUDIT_ADJUST",
                change_qty=diff,
                balance_after=total_avail,
                reference_doc="PHYSICAL-AUDIT",
                notes=f"Count adjustment ({old_qty} -> {req.physical_count}): {req.reason}",
            )
        )

        db.commit()

        return {
            "status": "success",
            "message": f"Drawer {drawer.id} adjusted to {req.physical_count} units.",
            "change": diff,
            "new_balance": total_avail,
        }

    @staticmethod
    def get_dashboard_stats(db: Session) -> DashboardStats:
        total_skus = db.query(Item).count()
        drawers = db.query(Drawer).all()
        total_drawers = len(drawers)

        occupied_count = 0
        total_units = 0

        for d in drawers:
            drawer_units = sum(loc.quantity for loc in d.stock_locations)
            total_units += drawer_units
            if drawer_units > 0:
                occupied_count += 1

        empty_drawers = total_drawers - occupied_count

        items = db.query(Item).all()
        low_stock_count = 0
        total_valuation = 0.0

        for it in items:
            item_units = sum(loc.quantity for loc in it.stock_locations)
            if item_units <= it.min_stock_threshold:
                low_stock_count += 1
            total_valuation += item_units * it.unit_cost

        return DashboardStats(
            total_skus=total_skus,
            total_units=total_units,
            total_drawers=total_drawers,
            occupied_drawers=occupied_count,
            empty_drawers=empty_drawers,
            low_stock_count=low_stock_count,
            total_valuation=round(total_valuation, 2),
        )

    @staticmethod
    def get_transactions(db: Session, limit: int = 50) -> List[TransactionResponse]:
        txs = (
            db.query(InventoryTransaction)
            .order_by(InventoryTransaction.timestamp.desc())
            .limit(limit)
            .all()
        )
        results = []
        for tx in txs:
            results.append(
                TransactionResponse(
                    id=tx.id,
                    item_sku=tx.item.sku if tx.item else "UNKNOWN",
                    item_name=tx.item.name if tx.item else None,
                    drawer_id=tx.drawer_id,
                    action_type=tx.action_type,
                    change_qty=tx.change_qty,
                    balance_after=tx.balance_after,
                    reference_doc=tx.reference_doc,
                    notes=tx.notes,
                    order_date=tx.order_date,
                    delivery_arrival_time=tx.delivery_arrival_time,
                    timestamp=tx.timestamp,
                )
            )
        return results

    @staticmethod
    def search(db: Session, query_str: str) -> Dict[str, Any]:
        term = f"%{query_str.strip()}%"

        items = (
            db.query(Item)
            .filter(or_(Item.sku.ilike(term), Item.name.ilike(term)))
            .all()
        )

        drawers = (
            db.query(Drawer)
            .filter(Drawer.id.ilike(term))
            .all()
        )

        parcels = (
            db.query(Parcel)
            .filter(
                or_(
                    Parcel.tracking_code.ilike(term),
                    Parcel.invoice_number.ilike(term),
                    Parcel.supplier.ilike(term),
                )
            )
            .all()
        )

        invoices = (
            db.query(Invoice)
            .filter(
                or_(
                    Invoice.invoice_number.ilike(term),
                    Invoice.sale_order_number.ilike(term),
                    Invoice.supplier.ilike(term),
                )
            )
            .all()
        )

        return {
            "query": query_str,
            "items": [
                {
                    "sku": it.sku,
                    "name": it.name,
                    "category": it.category,
                    "drawers": [l.drawer_id for l in it.stock_locations if l.quantity > 0],
                }
                for it in items
            ],
            "drawers": [d.id for d in drawers],
            "parcels": [
                {
                    "tracking_code": p.tracking_code,
                    "supplier": p.supplier,
                    "invoice": p.invoice_number,
                    "drawer_id": p.drawer_id,
                }
                for p in parcels
            ],
            "invoices": [
                {
                    "id": inv.id,
                    "invoice_number": inv.invoice_number,
                    "sale_order_number": inv.sale_order_number,
                    "supplier": inv.supplier,
                    "order_date": inv.order_date,
                    "delivery_arrival_time": inv.delivery_arrival_time,
                }
                for inv in invoices
            ],
        }

    @staticmethod
    def generate_qr_svg(code: str) -> str:
        factory = qrcode.image.svg.SvgPathImage
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_Q,
            box_size=10,
            border=4,
            image_factory=factory,
        )
        qr.add_data(code)
        qr.make(fit=True)
        img = qr.make_image(fill_color="#000000", back_color="#FFFFFF")

        stream = io.BytesIO()
        img.save(stream)
        svg_bytes = stream.getvalue()
        b64 = base64.b64encode(svg_bytes).decode("utf-8")
        return f"data:image/svg+xml;base64,{b64}"

    @staticmethod
    def process_batch_sync(db: Session, batch: SyncBatchRequest) -> SyncBatchResponse:
        synced_count = 0
        failed_count = 0
        results = []

        for op in batch.operations:
            op_id = op.client_op_id

            # Idempotency check: Has this client operation already been processed?
            existing = db.query(SyncQueue).filter_by(client_op_id=op_id).first()
            if existing:
                results.append({
                    "client_op_id": op_id,
                    "status": "ALREADY_CONFIRMED",
                    "action": op.action,
                    "message": "Operation previously synchronized and confirmed.",
                })
                synced_count += 1
                continue

            try:
                if op.action == "RECEIVE":
                    req = StockReceiveRequest(**op.payload)
                    res = InventoryService.receive_stock(db, req)
                elif op.action == "CONSUME":
                    req = StockConsumeRequest(**op.payload)
                    res = InventoryService.consume_stock(db, req)
                elif op.action == "TRANSFER":
                    req = StockTransferRequest(**op.payload)
                    res = InventoryService.transfer_stock(db, req)
                elif op.action == "INVOICE_COMMIT":
                    req = InvoiceCommitRequest(**op.payload)
                    res = InventoryService.commit_invoice(db, req)
                else:
                    raise ValueError(f"Unsupported action: {op.action}")

                # Record processed operation in SyncQueue
                record = SyncQueue(
                    client_op_id=op_id,
                    action=op.action,
                    payload=json.dumps(op.payload),
                    status="CONFIRMED",
                    synced_at=datetime.utcnow(),
                )
                db.add(record)
                db.commit()

                results.append({
                    "client_op_id": op_id,
                    "status": "CONFIRMED",
                    "action": op.action,
                    "detail": res,
                })
                synced_count += 1

            except Exception as e:
                db.rollback()
                failed_count += 1
                results.append({
                    "client_op_id": op_id,
                    "status": "FAILED",
                    "action": op.action,
                    "error": str(e),
                })

        return SyncBatchResponse(
            synced_count=synced_count,
            failed_count=failed_count,
            results=results,
        )

    # ===================== INVOICE WORKFLOW =====================
    @staticmethod
    def commit_invoice(db: Session, req: InvoiceCommitRequest) -> Dict[str, Any]:
        if not req.items:
            raise ValueError("Invoice commit requires at least one component item.")

        inv_num = req.invoice_number.strip()
        if not inv_num:
            raise ValueError("Invoice number cannot be empty.")

        existing_inv = db.query(Invoice).filter(Invoice.invoice_number == inv_num).first()
        if existing_inv and not req.allow_duplicate_append:
            raise ValueError(
                f"Invoice '{inv_num}' is already logged in the database. "
                "Enable append mode if you intentionally want to log additional batches for this invoice."
            )

        delivery_dt = req.delivery_arrival_time or datetime.now().replace(second=0, microsecond=0)
        order_dt = req.order_date

        try:
            if existing_inv:
                inv = existing_inv
                inv.delivery_arrival_time = delivery_dt
                if order_dt and not inv.order_date:
                    inv.order_date = order_dt
                if req.notes:
                    inv.notes = f"{inv.notes or ''} | {req.notes}".strip(" |")
            else:
                inv = Invoice(
                    invoice_number=inv_num,
                    sale_order_number=req.sale_order_number,
                    supplier=(req.supplier or "Unknown Vendor").strip(),
                    subtotal_amount=req.subtotal_amount,
                    tax_amount=req.tax_amount,
                    total_amount=req.total_amount,
                    currency=req.currency or "INR",
                    order_date=order_dt,
                    delivery_arrival_time=delivery_dt,
                    received_date=delivery_dt,
                    source_filename=req.source_filename,
                    notes=req.notes,
                    status="LOGGED",
                )
                db.add(inv)
                db.flush()

            committed_results: List[Dict[str, Any]] = []
            drawers_used: List[str] = []
            total_units = 0

            for line in req.items:
                clean_sku = line.sku.strip().upper()
                item = db.query(Item).filter(Item.sku == clean_sku).first()
                if not item:
                    item = Item(
                        sku=clean_sku,
                        name=line.name.strip() or clean_sku,
                        category=(line.category or "General").strip(),
                        unit=(line.unit or "pcs").strip(),
                        unit_cost=line.unit_price or 0.0,
                    )
                    db.add(item)
                    db.flush()

                target_drawer_id = (line.drawer_id or "").strip().upper()
                is_assigned = bool(target_drawer_id and target_drawer_id not in ("UNASSIGNED", "NONE", ""))

                if is_assigned:
                    item, drawer, total_avail = InventoryService._upsert_stock_in_session(
                        db,
                        sku=clean_sku,
                        item_name=line.name,
                        category=line.category,
                        unit=line.unit,
                        quantity=line.quantity,
                        unit_price=line.unit_price,
                        drawer_id=target_drawer_id,
                        sub_tray=line.sub_tray,
                        supplier=inv.supplier,
                        invoice_number=inv.invoice_number,
                        tracking_code=req.sale_order_number and f"SO:{req.sale_order_number}:{clean_sku}",
                        order_date=order_dt,
                        delivery_arrival_time=delivery_dt,
                        notes=line.notes or f"Invoice {inv.invoice_number} ({inv.supplier}) -> {target_drawer_id}",
                    )

                    inv_item = InvoiceItem(
                        invoice_id=inv.id,
                        sku=clean_sku,
                        item_name=line.name.strip() or item.name,
                        quantity=line.quantity,
                        unit_price=line.unit_price,
                        drawer_id=drawer.id,
                        hsn_code=line.hsn_code,
                        tax_rate=line.tax_rate,
                        line_total=line.line_total or round(line.unit_price * line.quantity, 2),
                        status="DELIVERED",
                    )
                    db.add(inv_item)

                    if drawer.id not in drawers_used:
                        drawers_used.append(drawer.id)
                    committed_results.append({
                        "sku": clean_sku,
                        "name": item.name,
                        "quantity": line.quantity,
                        "drawer_id": drawer.id,
                        "status": "DELIVERED",
                        "new_balance": total_avail,
                    })
                else:
                    inv_item = InvoiceItem(
                        invoice_id=inv.id,
                        sku=clean_sku,
                        item_name=line.name.strip() or item.name,
                        quantity=line.quantity,
                        unit_price=line.unit_price,
                        drawer_id=None,
                        hsn_code=line.hsn_code,
                        tax_rate=line.tax_rate,
                        line_total=line.line_total or round(line.unit_price * line.quantity, 2),
                        status="YET_TO_BE_DELIVERED",
                    )
                    db.add(inv_item)

                    committed_results.append({
                        "sku": clean_sku,
                        "name": item.name,
                        "quantity": line.quantity,
                        "drawer_id": None,
                        "status": "YET_TO_BE_DELIVERED",
                        "new_balance": 0,
                    })

                total_units += line.quantity

            has_pending = any(r["status"] == "YET_TO_BE_DELIVERED" for r in committed_results)
            inv.status = "PENDING_DELIVERY" if has_pending else "DELIVERED"

            db.commit()
            db.refresh(inv)

            pending_count = sum(1 for r in committed_results if r["status"] == "YET_TO_BE_DELIVERED")
            delivered_count = len(committed_results) - pending_count

            msg = (
                f"Logged invoice {inv.invoice_number}: {pending_count} component(s) saved to 'Yet to be Delivered'."
                if pending_count > 0 and delivered_count == 0
                else f"Logged invoice {inv.invoice_number}: {delivered_count} assigned, {pending_count} in 'Yet to be Delivered'."
            )

            return {
                "status": "success",
                "message": msg,
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "sale_order_number": inv.sale_order_number,
                "supplier": inv.supplier,
                "order_date": inv.order_date,
                "delivery_arrival_time": inv.delivery_arrival_time,
                "items_logged": len(committed_results),
                "total_units": total_units,
                "pending_delivery_count": pending_count,
                "drawers_used": drawers_used,
                "results": committed_results,
            }
        except Exception:
            db.rollback()
            raise

    @staticmethod
    def get_pending_deliveries(
        db: Session,
        sku: Optional[str] = None,
        invoice_number: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        q = (
            db.query(InvoiceItem, Invoice)
            .join(Invoice, InvoiceItem.invoice_id == Invoice.id)
            .filter(InvoiceItem.status == "YET_TO_BE_DELIVERED")
        )

        if sku:
            q = q.filter(InvoiceItem.sku == sku.upper().strip())
        if invoice_number:
            q = q.filter(Invoice.invoice_number.ilike(f"%{invoice_number.strip()}%"))

        results = []
        for inv_item, inv in q.order_by(Invoice.created_at.desc()).all():
            results.append({
                "id": inv_item.id,
                "invoice_id": inv.id,
                "invoice_number": inv.invoice_number,
                "sale_order_number": inv.sale_order_number,
                "supplier": inv.supplier,
                "sku": inv_item.sku,
                "item_name": inv_item.item_name or inv_item.sku,
                "category": "General",
                "quantity": inv_item.quantity,
                "unit_price": inv_item.unit_price,
                "order_date": inv.order_date.isoformat() if inv.order_date else None,
                "expected_arrival": inv.delivery_arrival_time.isoformat() if inv.delivery_arrival_time else None,
                "status": "YET_TO_BE_DELIVERED",
                "created_at": inv.created_at.isoformat(),
            })
        return results

    @staticmethod
    def assign_pending_delivery_drawer(
        db: Session,
        item_id: int,
        drawer_id: str,
        quantity: Optional[int] = None,
        sub_tray: str = "MAIN",
        operator_name: str = "Operator",
        notes: Optional[str] = None,
    ) -> Dict[str, Any]:
        inv_item = db.query(InvoiceItem).filter(InvoiceItem.id == item_id).first()
        if not inv_item:
            raise ValueError(f"Pending delivery item #{item_id} not found.")

        clean_drawer = drawer_id.strip().upper()
        drawer = db.query(Drawer).filter(Drawer.id == clean_drawer).first()
        if not drawer:
            raise ValueError(f"Physical compartment '{clean_drawer}' not found.")

        qty = quantity if (quantity and quantity > 0) else inv_item.quantity
        inv = db.query(Invoice).filter(Invoice.id == inv_item.invoice_id).first() if inv_item.invoice_id else None
        inv_num = inv.invoice_number if inv else "Direct"
        supplier = inv.supplier if inv else "Supplier"

        item, target_drawer, total_avail = InventoryService._upsert_stock_in_session(
            db,
            sku=inv_item.sku,
            item_name=inv_item.item_name,
            category="General",
            unit="pcs",
            quantity=qty,
            unit_price=inv_item.unit_price,
            drawer_id=clean_drawer,
            sub_tray=sub_tray or "MAIN",
            supplier=supplier,
            invoice_number=inv_num,
            tracking_code=f"INV:{inv_num}:{inv_item.sku}",
            delivery_arrival_time=datetime.utcnow(),
            notes=notes or f"Assigned from 'Yet to be Delivered' by {operator_name} -> {clean_drawer}",
        )

        inv_item.drawer_id = clean_drawer
        inv_item.status = "DELIVERED"

        if inv:
            rem_count = (
                db.query(InvoiceItem)
                .filter(InvoiceItem.invoice_id == inv.id, InvoiceItem.status == "YET_TO_BE_DELIVERED")
                .count()
            )
            if rem_count == 0:
                inv.status = "DELIVERED"

        db.commit()

        return {
            "status": "success",
            "message": f"Assigned {inv_item.sku} ({qty} units) into compartment {clean_drawer}!",
            "item_id": inv_item.id,
            "sku": inv_item.sku,
            "drawer_id": clean_drawer,
            "quantity": qty,
            "new_balance": total_avail,
        }

    @staticmethod
    def _build_invoice_summary(inv: Invoice) -> InvoiceSummaryResponse:
        drawers = sorted({it.drawer_id for it in inv.items if it.drawer_id})
        total_units = sum(it.quantity for it in inv.items)
        return InvoiceSummaryResponse(
            id=inv.id,
            invoice_number=inv.invoice_number,
            sale_order_number=inv.sale_order_number,
            supplier=inv.supplier,
            subtotal_amount=inv.subtotal_amount or 0.0,
            tax_amount=inv.tax_amount or 0.0,
            total_amount=inv.total_amount or 0.0,
            currency=inv.currency or "INR",
            order_date=inv.order_date,
            delivery_arrival_time=inv.delivery_arrival_time,
            received_date=inv.received_date,
            source_filename=inv.source_filename,
            status=inv.status or "LOGGED",
            items_count=len(inv.items),
            total_units=total_units,
            drawers_used=drawers,
            items=[
                InvoiceItemDetailResponse(
                    id=it.id,
                    sku=it.sku,
                    item_name=it.item_name,
                    quantity=it.quantity,
                    unit_price=it.unit_price,
                    drawer_id=it.drawer_id,
                    hsn_code=it.hsn_code,
                    tax_rate=it.tax_rate or 0.0,
                    line_total=it.line_total or round(it.quantity * it.unit_price, 2),
                    status=it.status or "LOGGED",
                )
                for it in inv.items
            ],
        )

    @staticmethod
    def list_invoices(
        db: Session,
        query: Optional[str] = None,
        limit: int = 100,
    ) -> List[InvoiceSummaryResponse]:
        q = db.query(Invoice).order_by(Invoice.id.desc())
        invoices = q.limit(limit).all()
        summaries = [InventoryService._build_invoice_summary(inv) for inv in invoices]
        if query and query.strip():
            term = query.strip().lower()
            summaries = [
                s
                for s in summaries
                if (
                    term in s.invoice_number.lower()
                    or term in (s.sale_order_number or "").lower()
                    or term in s.supplier.lower()
                    or term in (s.source_filename or "").lower()
                    or any(term in it.sku.lower() or term in (it.item_name or "").lower() for it in s.items)
                )
            ]
        return summaries

    @staticmethod
    def get_invoice_detail(db: Session, invoice_id: int) -> InvoiceSummaryResponse:
        inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
        if not inv:
            raise ValueError(f"Invoice #{invoice_id} not found.")
        return InventoryService._build_invoice_summary(inv)
