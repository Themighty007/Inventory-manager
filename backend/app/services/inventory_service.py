import io
import json
import base64
from datetime import datetime
from typing import List, Optional, Dict, Any
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
                    locations=locations,
                )
            )
        return results

    @staticmethod
    def receive_stock(db: Session, req: StockReceiveRequest) -> Dict[str, Any]:
        drawer = db.query(Drawer).filter(Drawer.id == req.drawer_id.upper()).first()
        if not drawer:
            raise ValueError(f"Target drawer '{req.drawer_id}' does not exist.")

        sku = req.item_sku.strip().upper()
        item = db.query(Item).filter(Item.sku == sku).first()

        if not item:
            item = Item(
                sku=sku,
                name=req.item_name or sku,
                category=req.category,
                unit=req.unit,
                unit_cost=req.unit_price,
            )
            db.add(item)
            db.flush()

        loc = (
            db.query(StockLocation)
            .filter_by(item_id=item.id, drawer_id=drawer.id, sub_tray=req.sub_tray)
            .first()
        )
        if not loc:
            loc = StockLocation(
                item_id=item.id,
                drawer_id=drawer.id,
                quantity=req.quantity,
                sub_tray=req.sub_tray,
            )
            db.add(loc)
        else:
            loc.quantity += req.quantity

        db.flush()

        total_avail = sum(
            l.quantity
            for l in db.query(StockLocation).filter_by(item_id=item.id).all()
        )

        ref_doc = req.invoice_number or req.tracking_code or "RECEIVE-DIRECT"
        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer.id,
            action_type="RECEIVE",
            change_qty=req.quantity,
            balance_after=total_avail,
            reference_doc=ref_doc,
            notes=req.notes or f"Received {req.quantity} units into {drawer.id}",
        )
        db.add(tx)

        if req.tracking_code:
            existing_parcel = (
                db.query(Parcel)
                .filter_by(tracking_code=req.tracking_code)
                .first()
            )
            if not existing_parcel:
                parcel = Parcel(
                    tracking_code=req.tracking_code,
                    supplier=req.supplier or "Standard Vendor",
                    invoice_number=req.invoice_number,
                    item_sku=sku,
                    drawer_id=drawer.id,
                    quantity=req.quantity,
                    notes=req.notes,
                )
                db.add(parcel)

        db.commit()

        return {
            "status": "success",
            "message": f"Successfully received {req.quantity} {item.unit} of {sku} into Drawer {drawer.id}.",
            "item_sku": sku,
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
                    drawer_id=tx.drawer_id,
                    action_type=tx.action_type,
                    change_qty=tx.change_qty,
                    balance_after=tx.balance_after,
                    reference_doc=tx.reference_doc,
                    notes=tx.notes,
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
