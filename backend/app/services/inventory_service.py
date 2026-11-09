import io
import uuid
import json
import base64
import qrcode
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

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
    SyncQueue,
)
from backend.app.schemas.inventory import (
    DrawerSummary,
    DrawerDetail,
    DrawerItemSummary,
    ItemResponse,
    ItemLocationInfo,
    StockReceiveRequest,
    StockConsumeRequest,
    StockTransferRequest,
    StockAdjustRequest,
    RequisitionResponse,
    DashboardStats,
    CategoryUsageStat,
    TransactionResponse,
)


class InventoryService:
    @staticmethod
    def get_all_drawers(db: Session) -> List[DrawerSummary]:
        drawers = db.query(Drawer).order_by(Drawer.section.desc(), Drawer.row_idx, Drawer.col_idx).all()
        results = []

        for d in drawers:
            locations = db.query(StockLocation).filter_by(drawer_id=d.id).filter(StockLocation.quantity > 0).all()
            unique_items = len(locations)
            total_units = sum(loc.quantity for loc in locations)

            # Check if any item in this drawer has active reservations
            has_reservation = (
                db.query(Reservation)
                .filter(Reservation.drawer_id == d.id, Reservation.status == "PENDING")
                .first()
                is not None
            )

            # Check if low stock
            is_low_stock = False
            for loc in locations:
                if loc.item and loc.item.min_stock_threshold and loc.quantity <= loc.item.min_stock_threshold:
                    is_low_stock = True
                    break

            # Status color rules
            if total_units == 0:
                status_color = "gray"  # Empty / Available
            elif has_reservation:
                status_color = "blue"  # Active Reservation
            elif is_low_stock:
                status_color = "coral"  # Low stock warning
            elif unique_items > 1:
                status_color = "purple"  # Multi-SKU compartment
            else:
                status_color = "yellow"  # Occupied (Single SKU)

            items_preview = [f"{loc.item.sku} ({loc.quantity})" for loc in locations if loc.item]

            results.append(
                DrawerSummary(
                    id=d.id,
                    section=d.section,
                    drawer_type=d.drawer_type,
                    row_idx=d.row_idx,
                    col_idx=d.col_idx,
                    dimensions=d.dimensions,
                    is_occupied=(total_units > 0),
                    unique_items_count=unique_items,
                    total_units=total_units,
                    status_color=status_color,
                    items_preview=items_preview[:3],
                )
            )

        return results

    @staticmethod
    def get_drawer_detail(db: Session, drawer_id: str) -> Optional[DrawerDetail]:
        d = db.query(Drawer).filter_by(id=drawer_id.upper()).first()
        if not d:
            return None

        locations = db.query(StockLocation).filter_by(drawer_id=d.id).filter(StockLocation.quantity > 0).all()
        items_detail = []
        unique_items = len(locations)
        total_units = 0

        for loc in locations:
            item = loc.item
            lot = loc.lot
            total_units += loc.quantity
            items_detail.append(
                DrawerItemSummary(
                    item_id=item.id,
                    sku=item.sku,
                    name=item.name,
                    category=item.category,
                    quantity=loc.quantity,
                    unit=item.unit,
                    unit_cost=item.unit_cost,
                    lot_number=lot.lot_number if lot else None,
                )
            )

        has_reservation = (
            db.query(Reservation)
            .filter(Reservation.drawer_id == d.id, Reservation.status == "PENDING")
            .first()
            is not None
        )

        is_low_stock = any(
            loc.item and loc.item.min_stock_threshold and loc.quantity <= loc.item.min_stock_threshold
            for loc in locations
        )

        if total_units == 0:
            status_color = "gray"
        elif has_reservation:
            status_color = "blue"
        elif is_low_stock:
            status_color = "coral"
        elif unique_items > 1:
            status_color = "purple"
        else:
            status_color = "yellow"

        items_preview = [f"{it.sku} ({it.quantity})" for it in items_detail]

        return DrawerDetail(
            id=d.id,
            section=d.section,
            drawer_type=d.drawer_type,
            row_idx=d.row_idx,
            col_idx=d.col_idx,
            dimensions=d.dimensions,
            notes=d.notes,
            is_occupied=(total_units > 0),
            unique_items_count=unique_items,
            total_units=total_units,
            status_color=status_color,
            items_preview=items_preview,
            items=items_detail,
        )

    @staticmethod
    def get_items(db: Session, query: Optional[str] = None, category: Optional[str] = None) -> List[ItemResponse]:
        q = db.query(Item).filter(Item.is_archived == False)

        if query:
            pattern = f"%{query}%"
            q = q.filter(or_(Item.sku.ilike(pattern), Item.name.ilike(pattern), Item.description.ilike(pattern)))

        if category and category != "ALL":
            q = q.filter(Item.category == category)

        items = q.order_by(Item.sku).all()
        results = []

        for item in items:
            locations = db.query(StockLocation).filter_by(item_id=item.id).filter(StockLocation.quantity > 0).all()
            total_available = sum(loc.quantity for loc in locations)

            # Reservations
            reservations = db.query(Reservation).filter_by(item_id=item.id, status="PENDING").all()
            total_reserved = sum(r.quantity for r in reservations)

            loc_infos = [
                ItemLocationInfo(
                    drawer_id=loc.drawer_id,
                    quantity=loc.quantity,
                    lot_number=loc.lot.lot_number if loc.lot else None,
                )
                for loc in locations
            ]

            results.append(
                ItemResponse(
                    id=item.id,
                    sku=item.sku,
                    name=item.name,
                    description=item.description,
                    category=item.category,
                    min_stock_threshold=item.min_stock_threshold,
                    unit=item.unit,
                    unit_cost=item.unit_cost,
                    total_available=total_available,
                    total_reserved=total_reserved,
                    locations=loc_infos,
                    is_low_stock=(total_available <= item.min_stock_threshold),
                    created_at=item.created_at,
                )
            )

        return results

    @staticmethod
    def receive_stock(db: Session, req: StockReceiveRequest) -> Dict[str, Any]:
        """Atomically receives incoming parcel/component and registers into a Stanley drawer."""
        drawer_id = req.drawer_id.upper()
        drawer = db.query(Drawer).filter_by(id=drawer_id).first()
        if not drawer:
            raise ValueError(f"Target drawer {drawer_id} does not exist in the 39-drawer Stanley cabinet.")

        # 1. Supplier
        supplier = None
        if req.supplier:
            supplier = db.query(Supplier).filter_by(name=req.supplier).first()
            if not supplier:
                supplier = Supplier(name=req.supplier)
                db.add(supplier)
                db.flush()

        # 2. Master Item (find or create)
        item = db.query(Item).filter_by(sku=req.item_sku).first()
        if not item:
            item = Item(
                sku=req.item_sku,
                name=req.item_name or req.item_sku,
                category=req.category or "General",
                unit_cost=req.unit_price,
            )
            db.add(item)
            db.flush()
        elif req.unit_price > 0:
            item.unit_cost = req.unit_price

        # 3. Parcel (if tracking code provided)
        parcel = None
        if req.tracking_code:
            parcel = db.query(Parcel).filter_by(tracking_code=req.tracking_code).first()
            if not parcel:
                parcel = Parcel(
                    tracking_code=req.tracking_code,
                    supplier_id=supplier.id if supplier else None,
                    raw_barcode_data=req.tracking_code,
                    status="RECEIVED",
                )
                db.add(parcel)
                db.flush()

        # 4. Invoice
        invoice = None
        if req.invoice_number:
            invoice = db.query(Invoice).filter_by(invoice_number=req.invoice_number).first()
            if not invoice:
                invoice = Invoice(
                    invoice_number=req.invoice_number,
                    supplier_id=supplier.id if supplier else None,
                    total_amount=req.quantity * req.unit_price,
                )
                db.add(invoice)
                db.flush()

                # Add invoice item
                inv_item = InvoiceItem(
                    invoice_id=invoice.id,
                    item_id=item.id,
                    quantity=req.quantity,
                    unit_price=req.unit_price,
                )
                db.add(inv_item)
                db.flush()

        # 5. Stock Lot
        lot_number = f"LOT-{item.sku}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        lot = StockLot(
            lot_number=lot_number,
            item_id=item.id,
            parcel_id=parcel.id if parcel else None,
            invoice_id=invoice.id if invoice else None,
            supplier_id=supplier.id if supplier else None,
            quantity_received=req.quantity,
            unit_cost=req.unit_price,
            purchase_date=datetime.utcnow(),
        )
        db.add(lot)
        db.flush()

        # 6. Stock Location
        loc = db.query(StockLocation).filter_by(item_id=item.id, drawer_id=drawer.id).first()
        if loc:
            loc.quantity += req.quantity
            loc.lot_id = lot.id
        else:
            loc = StockLocation(
                item_id=item.id,
                drawer_id=drawer.id,
                lot_id=lot.id,
                quantity=req.quantity,
            )
            db.add(loc)
        db.flush()

        # Calculate current total balance for item across all locations
        total_balance = (
            db.query(func.coalesce(func.sum(StockLocation.quantity), 0))
            .filter_by(item_id=item.id)
            .scalar()
        )

        # 7. Permanent Inventory Transaction
        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer.id,
            lot_id=lot.id,
            change_qty=req.quantity,
            balance_after=total_balance,
            action_type="RECEIVE",
            reference_doc=req.invoice_number or req.tracking_code or "MANUAL_RECEIPT",
            notes=req.notes or f"Received {req.quantity} {item.unit} into drawer {drawer.id}",
        )
        db.add(tx)
        db.commit()

        return {
            "status": "success",
            "message": f"Successfully received {req.quantity} of {item.sku} into drawer {drawer.id}",
            "item_sku": item.sku,
            "drawer_id": drawer.id,
            "total_drawer_qty": loc.quantity,
            "total_inventory_qty": total_balance,
            "lot_number": lot.lot_number,
            "transaction_id": tx.id,
        }

    @staticmethod
    def consume_stock(db: Session, req: StockConsumeRequest) -> Dict[str, Any]:
        drawer_id = req.drawer_id.upper()
        drawer = db.query(Drawer).filter_by(id=drawer_id).first()
        if not drawer:
            raise ValueError(f"Drawer {drawer_id} not found.")

        # Find item
        item = None
        if req.item_id:
            item = db.query(Item).filter_by(id=req.item_id).first()
        elif req.sku:
            item = db.query(Item).filter_by(sku=req.sku).first()

        if not item:
            raise ValueError("Component not found.")

        loc = db.query(StockLocation).filter_by(item_id=item.id, drawer_id=drawer.id).first()
        if not loc or loc.quantity < req.quantity:
            avail = loc.quantity if loc else 0
            raise ValueError(f"Insufficient stock in drawer {drawer.id}. Requested: {req.quantity}, Available: {avail}.")

        loc.quantity -= req.quantity
        db.flush()

        total_balance = (
            db.query(func.coalesce(func.sum(StockLocation.quantity), 0))
            .filter_by(item_id=item.id)
            .scalar()
        )

        ref_doc = req.project_name or "CONSUME"
        notes = f"Consumed {req.quantity} {item.unit} by {req.requester or 'User'}. {req.notes or ''}".strip()

        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer.id,
            lot_id=loc.lot_id,
            change_qty=-req.quantity,
            balance_after=total_balance,
            action_type="CONSUME",
            reference_doc=ref_doc,
            notes=notes,
        )
        db.add(tx)
        db.commit()

        return {
            "status": "success",
            "message": f"Consumed {req.quantity} of {item.sku} from drawer {drawer.id}",
            "remaining_in_drawer": loc.quantity,
            "total_remaining": total_balance,
            "transaction_id": tx.id,
        }

    @staticmethod
    def transfer_stock(db: Session, req: StockTransferRequest) -> Dict[str, Any]:
        from_id = req.from_drawer_id.upper()
        to_id = req.to_drawer_id.upper()

        if from_id == to_id:
            raise ValueError("Source and destination drawers must be different.")

        source_drawer = db.query(Drawer).filter_by(id=from_id).first()
        target_drawer = db.query(Drawer).filter_by(id=to_id).first()

        if not source_drawer or not target_drawer:
            raise ValueError("Both source and destination drawers must exist in the 39-drawer cabinet.")

        item = None
        if req.item_id:
            item = db.query(Item).filter_by(id=req.item_id).first()
        elif req.sku:
            item = db.query(Item).filter_by(sku=req.sku).first()

        if not item:
            raise ValueError("Component not found.")

        # Check source location
        src_loc = db.query(StockLocation).filter_by(item_id=item.id, drawer_id=from_id).first()
        if not src_loc or src_loc.quantity < req.quantity:
            avail = src_loc.quantity if src_loc else 0
            raise ValueError(f"Insufficient stock in source drawer {from_id}. Requested: {req.quantity}, Available: {avail}.")

        # Deduct from source
        src_loc.quantity -= req.quantity

        # Add to target
        tgt_loc = db.query(StockLocation).filter_by(item_id=item.id, drawer_id=to_id).first()
        if tgt_loc:
            tgt_loc.quantity += req.quantity
        else:
            tgt_loc = StockLocation(
                item_id=item.id,
                drawer_id=to_id,
                lot_id=src_loc.lot_id,
                quantity=req.quantity,
            )
            db.add(tgt_loc)

        total_balance = (
            db.query(func.coalesce(func.sum(StockLocation.quantity), 0))
            .filter_by(item_id=item.id)
            .scalar()
        )

        # Record transfer out transaction
        tx_out = InventoryTransaction(
            item_id=item.id,
            drawer_id=from_id,
            lot_id=src_loc.lot_id,
            change_qty=-req.quantity,
            balance_after=total_balance,
            action_type="TRANSFER_OUT",
            reference_doc=f"TRANSFER->{to_id}",
            notes=f"Moved {req.quantity} to {to_id}. {req.notes or ''}".strip(),
        )
        db.add(tx_out)

        # Record transfer in transaction
        tx_in = InventoryTransaction(
            item_id=item.id,
            drawer_id=to_id,
            lot_id=src_loc.lot_id,
            change_qty=req.quantity,
            balance_after=total_balance,
            action_type="TRANSFER_IN",
            reference_doc=f"TRANSFER<-{from_id}",
            notes=f"Moved {req.quantity} from {from_id}. {req.notes or ''}".strip(),
        )
        db.add(tx_in)
        db.commit()

        return {
            "status": "success",
            "message": f"Successfully moved {req.quantity} of {item.sku} from {from_id} to {to_id}",
            "from_drawer_qty": src_loc.quantity,
            "to_drawer_qty": tgt_loc.quantity,
        }

    @staticmethod
    def adjust_stock(db: Session, req: StockAdjustRequest) -> Dict[str, Any]:
        drawer_id = req.drawer_id.upper()
        drawer = db.query(Drawer).filter_by(id=drawer_id).first()
        if not drawer:
            raise ValueError(f"Drawer {drawer_id} not found.")

        item = None
        if req.item_id:
            item = db.query(Item).filter_by(id=req.item_id).first()
        elif req.sku:
            item = db.query(Item).filter_by(sku=req.sku).first()

        if not item:
            raise ValueError("Component not found.")

        loc = db.query(StockLocation).filter_by(item_id=item.id, drawer_id=drawer.id).first()
        current_qty = loc.quantity if loc else 0
        diff = req.new_quantity - current_qty

        if loc:
            loc.quantity = req.new_quantity
        else:
            loc = StockLocation(item_id=item.id, drawer_id=drawer.id, quantity=req.new_quantity)
            db.add(loc)

        total_balance = (
            db.query(func.coalesce(func.sum(StockLocation.quantity), 0))
            .filter_by(item_id=item.id)
            .scalar()
        )

        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer.id,
            change_qty=diff,
            balance_after=total_balance,
            action_type="ADJUST",
            reference_doc="PHYSICAL_AUDIT",
            notes=f"Stock discrepancy audit: {req.reason}. Adjusted by {diff:+d}",
        )
        db.add(tx)
        db.commit()

        return {
            "status": "success",
            "message": f"Adjusted {item.sku} in {drawer.id} from {current_qty} to {req.new_quantity}",
            "new_drawer_qty": req.new_quantity,
            "total_inventory_qty": total_balance,
        }

    @staticmethod
    def approve_requisition(db: Session, req_code: str, approved_by: str = "Stores Manager", notes: Optional[str] = None) -> Dict[str, Any]:
        res = db.query(Reservation).filter_by(requisition_code=req_code).first()
        if not res:
            raise ValueError(f"Requisition {req_code} not found.")

        if res.status == "DISPATCHED":
            raise ValueError(f"Requisition {req_code} is already dispatched.")

        item = res.item
        drawer_id = res.drawer_id or "S04"

        # Check stock location
        loc = db.query(StockLocation).filter_by(item_id=item.id, drawer_id=drawer_id).first()
        if not loc or loc.quantity < res.quantity:
            raise ValueError(f"Insufficient stock in drawer {drawer_id} to dispatch requisition {req_code}.")

        # Deduct
        loc.quantity -= res.quantity
        res.status = "DISPATCHED"

        total_balance = (
            db.query(func.coalesce(func.sum(StockLocation.quantity), 0))
            .filter_by(item_id=item.id)
            .scalar()
        )

        tx = InventoryTransaction(
            item_id=item.id,
            drawer_id=drawer_id,
            lot_id=loc.lot_id,
            change_qty=-res.quantity,
            balance_after=total_balance,
            action_type="CONSUME",
            reference_doc=res.requisition_code,
            notes=f"Dispatched for {res.requester} target: {res.target_location}. Approved by {approved_by}. {notes or ''}".strip(),
        )
        db.add(tx)
        db.commit()

        return {
            "status": "success",
            "message": f"Requisition {res.requisition_code} approved & dispatched!",
            "item_sku": item.sku,
            "quantity_dispatched": res.quantity,
            "remaining_in_drawer": loc.quantity,
            "transaction_id": tx.id,
        }

    @staticmethod
    def get_dashboard_stats(db: Session) -> DashboardStats:
        skus_monitored = db.query(Item).filter_by(is_archived=False).count()

        # Occupied vs empty drawers
        occupied_drawers = (
            db.query(StockLocation.drawer_id)
            .filter(StockLocation.quantity > 0)
            .distinct()
            .count()
        )
        empty_drawers = 39 - occupied_drawers

        # Stock availability: percentage of items above their min stock threshold
        items = db.query(Item).filter_by(is_archived=False).all()
        if items:
            healthy_items = 0
            for item in items:
                tot = sum(loc.quantity for loc in item.stock_locations)
                if tot > item.min_stock_threshold:
                    healthy_items += 1
            availability_pct = round((healthy_items / len(items)) * 100, 1)
        else:
            availability_pct = 100.0

        # Active reservations
        active_reservations = db.query(Reservation).filter_by(status="PENDING").count()

        # Pending requisition models
        pending_reqs = []
        for r in db.query(Reservation).filter_by(status="PENDING").order_by(Reservation.created_at.desc()).all():
            pending_reqs.append(
                RequisitionResponse(
                    id=r.id,
                    requisition_code=r.requisition_code,
                    project_name=r.project.name if r.project else None,
                    item_sku=r.item.sku,
                    item_name=r.item.name,
                    drawer_id=r.drawer_id,
                    quantity=r.quantity,
                    status=r.status,
                    requester=r.requester,
                    target_location=r.target_location,
                    priority=r.priority,
                    created_at=r.created_at,
                )
            )

        # Category usage stats (Electrical, Network, HVAC, Passives, etc.)
        categories = ["Electrical (MCBs, Fuses)", "Network (Cat6, RJ45)", "HVAC (Coolant, Filters)", "Microcontrollers", "Passives"]
        palette = ["#86EFAC", "#93C5FD", "#F472B6", "#FEF08A", "#DDD6FE"]
        cat_stats = [
            CategoryUsageStat(category="Electrical (MCBs, Fuses)", percentage=62.0, color="#86EFAC", item_count=1),
            CategoryUsageStat(category="Network (Cat6, RJ45)", percentage=24.0, color="#93C5FD", item_count=1),
            CategoryUsageStat(category="HVAC (Coolant, Filters)", percentage=14.0, color="#F472B6", item_count=2),
        ]

        return DashboardStats(
            skus_monitored=skus_monitored,
            stock_availability_pct=availability_pct,
            active_reservations=active_reservations,
            procurement_budget_remaining=42500.0,
            currency_symbol="₹",
            total_drawers=39,
            occupied_drawers=occupied_drawers,
            empty_drawers=empty_drawers,
            category_usage=cat_stats,
            pending_requisitions=pending_reqs,
        )

    @staticmethod
    def get_transactions(db: Session, limit: int = 50) -> List[TransactionResponse]:
        txs = db.query(InventoryTransaction).order_by(InventoryTransaction.timestamp.desc()).limit(limit).all()
        return [
            TransactionResponse(
                id=tx.id,
                item_sku=tx.item.sku if tx.item else "UNKNOWN",
                item_name=tx.item.name if tx.item else "Unknown",
                drawer_id=tx.drawer_id,
                change_qty=tx.change_qty,
                balance_after=tx.balance_after,
                action_type=tx.action_type,
                reference_doc=tx.reference_doc,
                notes=tx.notes,
                timestamp=tx.timestamp,
            )
            for tx in txs
        ]

    @staticmethod
    def search(db: Session, query: str) -> Dict[str, Any]:
        term = f"%{query}%"

        items = db.query(Item).filter(
            or_(Item.sku.ilike(term), Item.name.ilike(term), Item.description.ilike(term))
        ).all()

        drawers = db.query(Drawer).filter(Drawer.id.ilike(term)).all()

        invoices = db.query(Invoice).filter(Invoice.invoice_number.ilike(term)).all()

        parcels = db.query(Parcel).filter(Parcel.tracking_code.ilike(term)).all()

        return {
            "query": query,
            "items": [
                {
                    "sku": it.sku,
                    "name": it.name,
                    "category": it.category,
                    "total_available": sum(loc.quantity for loc in it.stock_locations),
                    "drawers": [loc.drawer_id for loc in it.stock_locations if loc.quantity > 0],
                }
                for it in items
            ],
            "drawers": [d.id for d in drawers],
            "invoices": [inv.invoice_number for inv in invoices],
            "parcels": [p.tracking_code for p in parcels],
        }

    @staticmethod
    def generate_qr_svg(code_str: str) -> str:
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(code_str)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        return f"data:image/png;base64,{img_str}"
