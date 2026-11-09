from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    Boolean,
)
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class Drawer(Base):
    """
    Physical Stanley 1-93-981 Storage Cabinet:
    39 total compartments:
    - Upper Section: 30 Small Drawers (S01 - S30) in 5 rows x 6 cols (13.5 x 5.0 x 3.5 cm)
    - Lower Section: 9 Large Drawers (L01 - L09) in 3 rows x 3 cols (13.5 x 11.0 x 6.0 cm)
    """
    __tablename__ = "drawers"

    id = Column(String(10), primary_key=True)  # "S01" - "S30", "L01" - "L09"
    section = Column(String(10), nullable=False)  # "UPPER" or "LOWER"
    drawer_type = Column(String(10), nullable=False)  # "SMALL" or "LARGE"
    row_idx = Column(Integer, nullable=False)  # 1-indexed row position
    col_idx = Column(Integer, nullable=False)  # 1-indexed column position
    dimensions = Column(String(50), nullable=False)  # e.g., "13.5 x 5.0 x 3.5 cm"
    max_sub_trays = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)

    stock_locations = relationship("StockLocation", back_populates="drawer")
    transactions = relationship("InventoryTransaction", back_populates="drawer")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), index=True, nullable=False)
    min_stock_threshold = Column(Integer, default=5)
    unit = Column(String(20), default="pcs")
    unit_cost = Column(Float, default=0.0)
    datasheet_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    stock_locations = relationship("StockLocation", back_populates="item")
    lots = relationship("StockLot", back_populates="item")
    transactions = relationship("InventoryTransaction", back_populates="item")


class StockLocation(Base):
    __tablename__ = "stock_locations"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    drawer_id = Column(String(10), ForeignKey("drawers.id"), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    sub_tray = Column(String(10), default="MAIN")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    item = relationship("Item", back_populates="stock_locations")
    drawer = relationship("Drawer", back_populates="stock_locations")


class StockLot(Base):
    __tablename__ = "stock_lots"

    id = Column(Integer, primary_key=True, index=True)
    lot_number = Column(String(50), unique=True, index=True, nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    supplier = Column(String(100), nullable=True)
    invoice_number = Column(String(50), nullable=True)
    received_quantity = Column(Integer, nullable=False)
    remaining_quantity = Column(Integer, nullable=False)
    unit_cost = Column(Float, nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("Item", back_populates="lots")


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True, index=True)
    tracking_code = Column(String(100), unique=True, index=True, nullable=False)
    supplier = Column(String(100), nullable=False)
    invoice_number = Column(String(50), nullable=True)
    parcel_type = Column(String(50), default="INCOMING")
    status = Column(String(50), default="RECEIVED")
    received_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    drawer_id = Column(String(10), nullable=True)
    item_sku = Column(String(50), nullable=True)
    quantity = Column(Integer, default=1)


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(50), unique=True, index=True, nullable=False)
    supplier = Column(String(100), nullable=False)
    total_amount = Column(Float, default=0.0)
    received_date = Column(DateTime, default=datetime.utcnow)
    status = Column(String(50), default="PAID")

    items = relationship("InvoiceItem", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    sku = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, nullable=False)

    invoice = relationship("Invoice", back_populates="items")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    drawer_id = Column(String(10), ForeignKey("drawers.id"), nullable=True)
    action_type = Column(String(50), nullable=False)  # "RECEIVE", "CONSUME", "TRANSFER", "AUDIT_ADJUST"
    change_qty = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    reference_doc = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    item = relationship("Item", back_populates="transactions")
    drawer = relationship("Drawer", back_populates="transactions")


class SyncQueue(Base):
    """
    Server-side record of processed offline sync operations.
    Primary key client_op_id guarantees strict idempotency:
    re-sent operations are acknowledged without duplicating transactions.
    """
    __tablename__ = "sync_queue"

    client_op_id = Column(String(64), primary_key=True)
    action = Column(String(50), nullable=False)
    payload = Column(Text, nullable=False)
    synced_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="CONFIRMED")
