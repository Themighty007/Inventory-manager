export interface DrawerSummary {
  id: string; // "S01" - "S30", "L01" - "L09"
  section: 'UPPER' | 'LOWER';
  drawer_type: 'SMALL' | 'LARGE';
  row_idx: number;
  col_idx: number;
  dimensions: string;
  is_occupied: boolean;
  unique_items_count: number;
  total_units: number;
  status_color: 'coral' | 'yellow' | 'blue' | 'gray';
  items_preview: string[];
}

export interface DrawerStockItem {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  sub_tray: string;
}

export interface DrawerDetail {
  id: string;
  section: 'UPPER' | 'LOWER';
  drawer_type: 'SMALL' | 'LARGE';
  row_idx: number;
  col_idx: number;
  dimensions: string;
  is_occupied: boolean;
  total_units: number;
  items: DrawerStockItem[];
}

export interface ItemLocation {
  drawer_id: string;
  quantity: number;
  sub_tray: string;
}

export interface ItemResponse {
  id: number;
  sku: string;
  name: string;
  description?: string;
  category: string;
  min_stock_threshold: number;
  unit: string;
  unit_cost: number;
  datasheet_url?: string;
  total_available: number;
  total_quantity?: number;
  reorder_point?: number;
  unit_price?: number;
  is_low_stock: boolean;
  last_order_date?: string | null;
  last_delivery_time?: string | null;
  locations: ItemLocation[];
}

export interface StockReceivePayload {
  client_op_id?: string;
  tracking_code?: string;
  item_sku: string;
  item_name?: string;
  category: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  supplier?: string;
  invoice_number?: string;
  drawer_id: string;
  target_drawer_id?: string;
  sub_tray?: string;
  order_date?: string | null;
  delivery_arrival_time?: string | null;
  notes?: string;
}

export interface StockConsumePayload {
  client_op_id?: string;
  sku?: string;
  item_sku?: string;
  item_id?: number;
  drawer_id: string;
  quantity: number;
  project_name?: string;
  requester?: string;
  user_name?: string;
  reason?: string;
  notes?: string;
}

export interface StockTransferPayload {
  client_op_id?: string;
  sku?: string;
  item_sku?: string;
  item_id?: number;
  from_drawer_id: string;
  to_drawer_id: string;
  source_drawer_id?: string;
  target_drawer_id?: string;
  user_name?: string;
  reason?: string;
  quantity: number;
  notes?: string;
}

export interface DashboardStats {
  total_skus: number;
  total_units: number;
  total_drawers: number;
  occupied_drawers: number;
  empty_drawers: number;
  low_stock_count: number;
  total_valuation: number;
}

export interface TransactionResponse {
  id: number;
  item_sku: string;
  item_name?: string | null;
  drawer_id?: string;
  action_type: 'RECEIVE' | 'CONSUME' | 'TRANSFER' | 'AUDIT_ADJUST';
  change_qty: number;
  quantity_change?: number;
  balance_after: number;
  reference_doc?: string;
  notes?: string;
  order_date?: string | null;
  delivery_arrival_time?: string | null;
  timestamp: string;
}

export interface DrawerLabelQr {
  drawer_id: string;
  section: string;
  type: string;
  dimensions: string;
  code: string;
  qr_data_uri: string;
}

export interface SyncOperationItem {
  client_op_id: string;
  action: 'RECEIVE' | 'CONSUME' | 'TRANSFER' | 'INVOICE_COMMIT';
  payload: any;
  timestamp?: string;
}

export interface SyncBatchResult {
  synced_count: number;
  failed_count: number;
  results: {
    client_op_id: string;
    status: 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'FAILED';
    action: string;
    message?: string;
    error?: string;
  }[];
}

export interface ParsedInvoiceItem {
  line_no: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  raw_quantity: number;
  unit: string;
  unit_price: number;
  effective_unit_cost: number;
  tax_rate: number;
  line_total: number;
  hsn_code?: string | null;
  is_shipping_or_fee: boolean;
  suggested_drawer_id?: string | null;
  existing_drawers: string[];
  existing_item_name?: string | null;
  confidence: string;
}

export interface ParsedInvoiceResponse {
  filename: string;
  file_type: string;
  supplier: string;
  invoice_number: string;
  sale_order_number?: string | null;
  order_date?: string | null;
  invoice_date_raw?: string | null;
  delivery_arrival_time: string;
  delivery_extracted_from_doc: boolean;
  currency: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  extracted_total_qty?: number | null;
  already_logged: boolean;
  existing_invoice_id?: number | null;
  warnings: string[];
  items: ParsedInvoiceItem[];
  skipped_fee_rows: ParsedInvoiceItem[];
  raw_text_preview: string;
}

export interface InvoiceCommitItemPayload {
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  drawer_id?: string | null;
  sub_tray?: string;
  hsn_code?: string | null;
  tax_rate?: number;
  line_total?: number;
  notes?: string;
}

export interface InvoiceCommitPayload {
  invoice_number: string;
  sale_order_number?: string | null;
  supplier: string;
  order_date?: string | null;
  delivery_arrival_time?: string | null;
  currency?: string;
  subtotal_amount?: number;
  tax_amount?: number;
  total_amount?: number;
  source_filename?: string | null;
  notes?: string;
  allow_duplicate_append?: boolean;
  items: InvoiceCommitItemPayload[];
}

export interface InvoiceCommitResult {
  status: string;
  message: string;
  invoice_id: number;
  invoice_number: string;
  sale_order_number?: string | null;
  supplier: string;
  order_date?: string | null;
  delivery_arrival_time?: string | null;
  items_logged: number;
  total_units: number;
  drawers_used: string[];
  results: {
    sku: string;
    name: string;
    quantity: number;
    drawer_id: string;
    new_balance: number;
  }[];
}

export interface InvoiceItemDetail {
  id: number;
  sku: string;
  item_name?: string | null;
  quantity: number;
  unit_price: number;
  drawer_id?: string | null;
  hsn_code?: string | null;
  tax_rate: number;
  line_total: number;
  status: string;
}

export interface InvoiceSummaryResponse {
  id: number;
  invoice_number: string;
  sale_order_number?: string | null;
  supplier: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  order_date?: string | null;
  delivery_arrival_time?: string | null;
  received_date: string;
  source_filename?: string | null;
  status: string;
  items_count: number;
  total_units: number;
  drawers_used: string[];
  items: InvoiceItemDetail[];
}

export interface NetworkInterface {
  name: string;
  ip: string;
  is_primary: boolean;
}

export interface NetworkInfo {
  primary_ip: string;
  primary_interface_name: string;
  interfaces: NetworkInterface[];
  http_port: number;
  https_port: number;
  primary_https_url: string;
  primary_http_url: string;
  localhost_http_url: string;
  localhost_https_url: string;
}

export interface PendingDeliveryItem {
  id: number;
  invoice_id: number;
  invoice_number: string;
  sale_order_number?: string | null;
  supplier: string;
  sku: string;
  item_name?: string | null;
  category: string;
  quantity: number;
  unit_price: number;
  order_date?: string | null;
  expected_arrival?: string | null;
  status: string;
  created_at: string;
}

export interface AssignPendingDrawerPayload {
  drawer_id: string;
  quantity?: number;
  sub_tray?: string;
  operator_name?: string;
  notes?: string;
}
