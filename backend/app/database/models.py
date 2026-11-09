import uuid
from datetime import datetime
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import relationship
from backend.app.database.connection import Base


class Drawer(Base):
    __tablename__ = "drawers"

    id = Column(String(10), primary_key=True)  # S01-S30, L01-L09
    section = Column(String(10), nullable=False)  # UPPER, LOWER
    drawer_type = Column(String(10), nullable=False)  # SMALL, LARGE
    row_idx = Column(Integer, nullable=False)  # 1-5 for small, 1-3 for large
    col_idx = Column(Integer, nullable=False)  # 1-6 for small, 1-3 for large
    dimensions = Column(String(50), nullable=False)  # e.g. "13.5 x 5.0 x 3.5 cm"
    notes = Column(Text, nullable=True)

    stock_locations = relationship("StockLocation", back_populates="drawer", cascade="all, delete-orphan")
    transactions = relationship("InventoryTransaction", back_populates="drawer")

    __table_args__ = (
        Index("idx_drawer_type_pos", "drawer_type", "row_idx", "col_idx"),
    )


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    contact_email = Column(String(200), nullable=True)
    phone = Column(String(50), nullable=True)
    website = Column(String(255), nullable=True)

    parcels = relationship("Parcel", back_populates="supplier")
    invoices = relationship("Invoice", back_populates="supplier")
    stock_lots = relationship("StockLot", back_populates="supplier")


class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sku = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default="General")
    min_stock_threshold = Column(Integer, default=5)
    unit = Column(String(20), default="pcs")
    unit_cost = Column(Float, default=0.0)
    datasheet_url = Column(String(500), nullable=True)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    stock_lots = relationship("StockLot", back_populates="item")
    stock_locations = relationship("StockLocation", back_populates="item")
    transactions = relationship("InventoryTransaction", back_populates="item")
    invoice_items = relationship("InvoiceItem", back_populates="item")
    reservations = relationship("Reservation", back_populates="item")


class Parcel(Base):
    __tablename__ = "parcels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tracking_code = Column(String(100), unique=True, nullable=False, index=True)
    carrier = Column(String(100), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    received_date = Column(DateTime, default=datetime.utcnow)
    raw_barcode_data = Column(Text, nullable=True)
    status = Column(String(50), default="RECEIVED")

    supplier = relationship("Supplier", back_populates="parcels")
    stock_lots = relationship("StockLot", back_populates="parcel")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_number = Column(String(100), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    invoice_date = Column(DateTime, default=datetime.utcnow)
    total_amount = Column(Float, default=0.0)
    currency = Column(String(10), default="INR")

    supplier = relationship("Supplier", back_populates="invoices")
    invoice_items = relationship("InvoiceItem", back_populates="invoice")
    stock_lots = relationship("StockLot", back_populates="invoice")


class InvoiceItem(Base):
    __tablename__ = "invoice_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Float, default=0.0)

    invoice = relationship("Invoice", back_populates="invoice_items")
    item = relationship("Item", back_populates="invoice_items")


class StockLot(Base):
    __tablename__ = "stock_lots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    lot_number = Column(String(100), unique=True, nullable=False, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    parcel_id = Column(Integer, ForeignKey("parcels.id"), nullable=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id"), nullable=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    quantity_received = Column(Integer, nullable=False)
    unit_cost = Column(Float, default=0.0)
    purchase_date = Column(DateTime, default=datetime.utcnow)

    item = relationship("Item", back_populates="stock_lots")
    parcel = relationship("Parcel", back_populates="stock_lots")
    invoice = relationship("Invoice", back_populates="stock_lots")
    supplier = relationship("Supplier", back_populates="stock_lots")
    stock_locations = relationship("StockLocation", back_populates="lot")


class StockLocation(Base):
    __tablename__ = "stock_locations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    drawer_id = Column(String(10), ForeignKey("drawers.id"), nullable=False)
    lot_id = Column(Integer, ForeignKey("stock_lots.id"), nullable=True)
    quantity = Column(Integer, nullable=False, default=0)

    item = relationship("Item", back_populates="stock_locations")
    drawer = relationship("Drawer", back_populates="stock_locations")
    lot = relationship("StockLot", back_populates="stock_locations")

    __table_args__ = (
        Index("idx_stock_loc_item_drawer", "item_id", "drawer_id"),
    )


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    drawer_id = Column(String(10), ForeignKey("drawers.id"), nullable=True)
    lot_id = Column(Integer, ForeignKey("stock_lots.id"), nullable=True)
    change_qty = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)
    action_type = Column(String(50), nullable=False)  # RECEIVE, CONSUME, TRANSFER_IN, TRANSFER_OUT, ADJUST, RESERVE
    reference_doc = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    item = relationship("Item", back_populates="transactions")
    drawer = relationship("Drawer", back_populates="transactions")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    lead_name = Column(String(100), nullable=True)
    status = Column(String(50), default="ACTIVE")

    reservations = relationship("Reservation", back_populates="project")


class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    requisition_code = Column(String(50), unique=True, nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    drawer_id = Column(String(10), ForeignKey("drawers.id"), nullable=True)
    quantity = Column(Integer, nullable=False)
    status = Column(String(50), default="PENDING")  # PENDING, APPROVED, DISPATCHED, CANCELLED
    requester = Column(String(100), nullable=False)  # e.g., "Rajesh Kumar (Lead Tech)"
    target_location = Column(String(200), nullable=True)  # e.g., "Hall B-204 Main Power Outage"
    priority = Column(String(50), default="NORMAL")  # NORMAL, HIGH_EXAM, CRITICAL
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="reservations")
    item = relationship("Item", back_populates="reservations")


class SyncQueue(Base):
    __tablename__ = "sync_queue"

    client_op_id = Column(String(64), primary_key=True)
    action = Column(String(50), nullable=False)
    payload = Column(Text, nullable=False)
    synced_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String(20), default="CONFIRMED")
