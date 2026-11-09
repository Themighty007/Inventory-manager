from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ===================== DRAWERS =====================
class DrawerItemSummary(BaseModel):
    item_id: int
    sku: str
    name: str
    category: str
    quantity: int
    unit: str
    unit_cost: float
    lot_number: Optional[str] = None


class DrawerSummary(BaseModel):
    id: str
    section: str
    drawer_type: str
    row_idx: int
    col_idx: int
    dimensions: str
    is_occupied: bool
    unique_items_count: int
    total_units: int
    status_color: str  # green, yellow, purple, coral, blue
    items_preview: List[str] = []


class DrawerDetail(DrawerSummary):
    notes: Optional[str] = None
    items: List[DrawerItemSummary] = []


# ===================== ITEMS =====================
class ItemLocationInfo(BaseModel):
    drawer_id: str
    quantity: int
    lot_number: Optional[str] = None


class ItemCreate(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str = "General"
    min_stock_threshold: int = 5
    unit: str = "pcs"
    unit_cost: float = 0.0
    datasheet_url: Optional[str] = None


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    min_stock_threshold: Optional[int] = None
    unit: Optional[str] = None
    unit_cost: Optional[float] = None
    datasheet_url: Optional[str] = None


class ItemResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    min_stock_threshold: int
    unit: str
    unit_cost: float
    total_available: int
    total_reserved: int
    locations: List[ItemLocationInfo] = []
    is_low_stock: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ===================== STOCK OPERATIONS =====================
class StockReceiveRequest(BaseModel):
    tracking_code: Optional[str] = None
    item_sku: str
    item_name: Optional[str] = None
    category: str = "General"
    invoice_number: Optional[str] = None
    quantity: int = Field(gt=0)
    supplier: Optional[str] = None
    drawer_id: str
    unit_price: float = 0.0
    notes: Optional[str] = None


class StockConsumeRequest(BaseModel):
    sku: Optional[str] = None
    item_id: Optional[int] = None
    drawer_id: str
    quantity: int = Field(gt=0)
    project_name: Optional[str] = None
    requester: Optional[str] = None
    notes: Optional[str] = None


class StockTransferRequest(BaseModel):
    sku: Optional[str] = None
    item_id: Optional[int] = None
    from_drawer_id: str
    to_drawer_id: str
    quantity: int = Field(gt=0)
    notes: Optional[str] = None


class StockAdjustRequest(BaseModel):
    sku: Optional[str] = None
    item_id: Optional[int] = None
    drawer_id: str
    new_quantity: int = Field(ge=0)
    reason: str


# ===================== REQUISITIONS & RESERVATIONS =====================
class RequisitionResponse(BaseModel):
    id: int
    requisition_code: str
    project_name: Optional[str] = None
    item_sku: str
    item_name: str
    drawer_id: Optional[str] = None
    quantity: int
    status: str
    requester: str
    target_location: Optional[str] = None
    priority: str
    created_at: datetime


class RequisitionDispatchAction(BaseModel):
    requisition_code: str
    approved_by: str = "Stores Manager"
    notes: Optional[str] = None


# ===================== TRANSACTIONS =====================
class TransactionResponse(BaseModel):
    id: str
    item_sku: str
    item_name: str
    drawer_id: Optional[str] = None
    change_qty: int
    balance_after: int
    action_type: str
    reference_doc: Optional[str] = None
    notes: Optional[str] = None
    timestamp: datetime


# ===================== DASHBOARD STATS =====================
class CategoryUsageStat(BaseModel):
    category: str
    percentage: float
    color: str
    item_count: int


class DashboardStats(BaseModel):
    skus_monitored: int
    stock_availability_pct: float
    active_reservations: int
    procurement_budget_remaining: float
    currency_symbol: str = "₹"
    total_drawers: int = 39
    occupied_drawers: int
    empty_drawers: int
    category_usage: List[CategoryUsageStat] = []
    pending_requisitions: List[RequisitionResponse] = []


# ===================== SYNC =====================
class SyncOperation(BaseModel):
    client_op_id: str
    action: str  # "RECEIVE", "CONSUME", "TRANSFER"
    payload: Dict[str, Any]
    timestamp: Optional[datetime] = None


class SyncBatchRequest(BaseModel):
    operations: List[SyncOperation]


class SyncBatchResponse(BaseModel):
    synced_count: int
    failed_count: int
    results: List[Dict[str, Any]]
