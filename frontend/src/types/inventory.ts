export interface DrawerItemSummary {
  item_id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  lot_number?: string | null;
}

export interface DrawerSummary {
  id: string;
  section: 'UPPER' | 'LOWER';
  drawer_type: 'SMALL' | 'LARGE';
  row_idx: number;
  col_idx: number;
  dimensions: string;
  is_occupied: boolean;
  unique_items_count: number;
  total_units: number;
  status_color: 'gray' | 'yellow' | 'purple' | 'coral' | 'blue';
  items_preview: string[];
}

export interface DrawerDetail extends DrawerSummary {
  notes?: string | null;
  items: DrawerItemSummary[];
}

export interface ItemLocationInfo {
  drawer_id: string;
  quantity: number;
  lot_number?: string | null;
}

export interface ItemResponse {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  category: string;
  min_stock_threshold: number;
  unit: string;
  unit_cost: number;
  total_available: number;
  total_reserved: number;
  locations: ItemLocationInfo[];
  is_low_stock: boolean;
  created_at: string;
}

export interface RequisitionResponse {
  id: number;
  requisition_code: string;
  project_name?: string | null;
  item_sku: string;
  item_name: string;
  drawer_id?: string | null;
  quantity: number;
  status: 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'CANCELLED';
  requester: string;
  target_location?: string | null;
  priority: 'NORMAL' | 'HIGH_EXAM' | 'CRITICAL';
  created_at: string;
}

export interface CategoryUsageStat {
  category: string;
  percentage: number;
  color: string;
  item_count: number;
}

export interface DashboardStats {
  skus_monitored: number;
  stock_availability_pct: number;
  active_reservations: number;
  procurement_budget_remaining: number;
  currency_symbol: string;
  total_drawers: number;
  occupied_drawers: number;
  empty_drawers: number;
  category_usage: CategoryUsageStat[];
  pending_requisitions: RequisitionResponse[];
}

export interface TransactionResponse {
  id: string;
  item_sku: string;
  item_name: string;
  drawer_id?: string | null;
  change_qty: number;
  balance_after: number;
  action_type: string;
  reference_doc?: string | null;
  notes?: string | null;
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
