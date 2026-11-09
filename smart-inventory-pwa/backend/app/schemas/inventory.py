from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ===================== DRAWERS =====================
class DrawerBase(BaseModel):
    id: str
    section: str
    drawer_type: str
    row_idx: int
    col_idx: int
    dimensions: str


class DrawerSummary(DrawerBase):
    is_occupied: bool
    unique_items_count: int
    total_units: int
    status_color: str
    items_preview: List[str] = []

    class Config:
        from_attributes = True


class DrawerStockItem(BaseModel):
    sku: str
    name: str
    category: str
    quantity: int
    unit: str
    unit_cost: float
    sub_tray: str = "MAIN"


class DrawerDetail(DrawerBase):
    is_occupied: bool
    total_units: int
    items: List[DrawerStockItem] = []

    class Config:
        from_attributes = True


# ===================== ITEMS =====================
class ItemLocation(BaseModel):
    drawer_id: str
    quantity: int
    sub_tray: str = "MAIN"


class ItemBase(BaseModel):
    sku: str
    name: str
    description: Optional[str] = None
    category: str
    min_stock_threshold: int = 5
    unit: str = "pcs"
    unit_cost: float = 0.0
    datasheet_url: Optional[str] = None


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    min_stock_threshold: Optional[int] = None
    unit: Optional[str] = None
    unit_cost: Optional[float] = None
    datasheet_url: Optional[str] = None


class ItemResponse(ItemBase):
    id: int
    total_available: int
    is_low_stock: bool
    locations: List[ItemLocation] = []

    class Config:
        from_attributes = True


# ===================== STOCK MOVEMENTS =====================
class StockReceiveRequest(BaseModel):
    client_op_id: Optional[str] = None
    tracking_code: Optional[str] = None
    item_sku: str
    item_name: Optional[str] = None
    category: str = "PASSIVES"
    unit: str = "pcs"
    quantity: int = Field(gt=0, description="Quantity to receive")
    unit_price: float = 0.0
    supplier: Optional[str] = None
    invoice_number: Optional[str] = None
    drawer_id: str = Field(description="Target Stanley drawer, e.g. 'S01' or 'L02'")
    sub_tray: str = "MAIN"
    notes: Optional[str] = None


class StockConsumeRequest(BaseModel):
    client_op_id: Optional[str] = None
    sku: Optional[str] = None
    item_id: Optional[int] = None
    drawer_id: str
    quantity: int = Field(gt=0, description="Quantity to deduct")
    project_name: Optional[str] = None
    requester: Optional[str] = "Technician"
    notes: Optional[str] = None


class StockTransferRequest(BaseModel):
    client_op_id: Optional[str] = None
    sku: Optional[str] = None
    item_id: Optional[int] = None
    from_drawer_id: str
    to_drawer_id: str
    quantity: int = Field(gt=0)
    notes: Optional[str] = None


class StockAdjustRequest(BaseModel):
    sku: str
    drawer_id: str
    physical_count: int = Field(ge=0)
    reason: str


# ===================== STATS & TRANSACTIONS =====================
class DashboardStats(BaseModel):
    total_skus: int
    total_units: int
    total_drawers: int
    occupied_drawers: int
    empty_drawers: int
    low_stock_count: int
    total_valuation: float


class TransactionResponse(BaseModel):
    id: int
    item_sku: str
    drawer_id: Optional[str]
    action_type: str
    change_qty: int
    balance_after: int
    reference_doc: Optional[str]
    notes: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True


# ===================== OFFLINE SYNC BATCH =====================
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


# ===================== QR CODE LABELS =====================
class DrawerLabelQr(BaseModel):
    drawer_id: str
    section: str
    type: str
    dimensions: str
    code: str
    qr_data_uri: str
