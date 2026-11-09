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
  is_low_stock: boolean;
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
  sub_tray?: string;
  notes?: string;
}

export interface StockConsumePayload {
  client_op_id?: string;
  sku?: string;
  item_id?: number;
  drawer_id: string;
  quantity: number;
  project_name?: string;
  requester?: string;
  notes?: string;
}

export interface StockTransferPayload {
  client_op_id?: string;
  sku?: string;
  item_id?: number;
  from_drawer_id: string;
  to_drawer_id: string;
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
  drawer_id?: string;
  action_type: 'RECEIVE' | 'CONSUME' | 'TRANSFER' | 'AUDIT_ADJUST';
  change_qty: number;
  balance_after: number;
  reference_doc?: string;
  notes?: string;
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
  action: 'RECEIVE' | 'CONSUME' | 'TRANSFER';
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
