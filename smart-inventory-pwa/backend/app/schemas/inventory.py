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
    last_order_date: Optional[datetime] = None
    last_delivery_time: Optional[datetime] = None
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
    order_date: Optional[datetime] = None
    delivery_arrival_time: Optional[datetime] = None
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
    item_name: Optional[str] = None
    drawer_id: Optional[str]
    action_type: str
    change_qty: int
    balance_after: int
    reference_doc: Optional[str]
    notes: Optional[str]
    order_date: Optional[datetime] = None
    delivery_arrival_time: Optional[datetime] = None
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


# ===================== INVOICE PARSING & COMMIT =====================
class ParsedInvoiceItem(BaseModel):
    line_no: int
    sku: str
    name: str
    category: str = "General"
    quantity: int = 1
    raw_quantity: float = 1.0
    unit: str = "pcs"
    unit_price: float = 0.0
    effective_unit_cost: float = 0.0
    tax_rate: float = 0.0
    line_total: float = 0.0
    hsn_code: Optional[str] = None
    is_shipping_or_fee: bool = False
    suggested_drawer_id: Optional[str] = None
    existing_drawers: List[str] = []
    existing_item_name: Optional[str] = None
    confidence: str = "HIGH"


class ParsedInvoiceResponse(BaseModel):
    filename: str
    file_type: str
    supplier: str
    invoice_number: str
    sale_order_number: Optional[str] = None
    order_date: Optional[str] = None  # YYYY-MM-DD
    invoice_date_raw: Optional[str] = None
    delivery_arrival_time: str  # ISO YYYY-MM-DDTHH:MM
    delivery_extracted_from_doc: bool = False
    currency: str = "INR"
    subtotal_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    extracted_total_qty: Optional[float] = None
    already_logged: bool = False
    existing_invoice_id: Optional[int] = None
    warnings: List[str] = []
    items: List[ParsedInvoiceItem] = []
    skipped_fee_rows: List[ParsedInvoiceItem] = []
    raw_text_preview: str = ""


class InvoiceCommitItem(BaseModel):
    sku: str
    name: str
    category: str = "General"
    quantity: int = Field(gt=0)
    unit: str = "pcs"
    unit_price: float = 0.0
    drawer_id: Optional[str] = None
    sub_tray: str = "MAIN"
    hsn_code: Optional[str] = None
    tax_rate: float = 0.0
    line_total: float = 0.0
    notes: Optional[str] = None


class PendingDeliveryItemResponse(BaseModel):
    id: int
    invoice_id: int
    invoice_number: str
    sale_order_number: Optional[str] = None
    supplier: str
    sku: str
    item_name: Optional[str] = None
    category: str = "General"
    quantity: int
    unit_price: float
    order_date: Optional[datetime] = None
    expected_arrival: Optional[datetime] = None
    status: str = "YET_TO_BE_DELIVERED"
    created_at: datetime


class AssignPendingDrawerRequest(BaseModel):
    drawer_id: str
    quantity: Optional[int] = None
    sub_tray: Optional[str] = "MAIN"
    operator_name: Optional[str] = "Operator"
    notes: Optional[str] = None


class InvoiceCommitRequest(BaseModel):
    invoice_number: str
    sale_order_number: Optional[str] = None
    supplier: str
    order_date: Optional[datetime] = None
    delivery_arrival_time: Optional[datetime] = None
    currency: str = "INR"
    subtotal_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    source_filename: Optional[str] = None
    notes: Optional[str] = None
    allow_duplicate_append: bool = False
    items: List[InvoiceCommitItem]


class InvoiceItemDetailResponse(BaseModel):
    id: int
    sku: str
    item_name: Optional[str] = None
    quantity: int
    unit_price: float
    drawer_id: Optional[str] = None
    hsn_code: Optional[str] = None
    tax_rate: float = 0.0
    line_total: float = 0.0
    status: str = "LOGGED"

    class Config:
        from_attributes = True


class InvoiceSummaryResponse(BaseModel):
    id: int
    invoice_number: str
    sale_order_number: Optional[str] = None
    supplier: str
    subtotal_amount: float = 0.0
    tax_amount: float = 0.0
    total_amount: float = 0.0
    currency: str = "INR"
    order_date: Optional[datetime] = None
    delivery_arrival_time: Optional[datetime] = None
    received_date: datetime
    source_filename: Optional[str] = None
    status: str
    items_count: int
    total_units: int
    drawers_used: List[str] = []
    items: List[InvoiceItemDetailResponse] = []

    class Config:
        from_attributes = True
