import {
  DrawerSummary,
  DrawerDetail,
  ItemResponse,
  DashboardStats,
  TransactionResponse,
  DrawerLabelQr,
} from '../types/inventory';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function fetchDrawers(): Promise<DrawerSummary[]> {
  const res = await fetch(`${BASE_URL}/api/drawers`);
  if (!res.ok) throw new Error('Failed to fetch drawers');
  return res.json();
}

export async function fetchDrawerDetail(id: string): Promise<DrawerDetail> {
  const res = await fetch(`${BASE_URL}/api/drawers/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch drawer ${id}`);
  return res.json();
}

export async function fetchItems(q?: string, category?: string): Promise<ItemResponse[]> {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category && category !== 'ALL') params.set('category', category);
  const res = await fetch(`${BASE_URL}/api/items?${params.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch items');
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/api/dashboard/stats`);
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function fetchTransactions(): Promise<TransactionResponse[]> {
  const res = await fetch(`${BASE_URL}/api/transactions`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function receiveStock(payload: {
  tracking_code?: string;
  item_sku: string;
  item_name?: string;
  category: string;
  invoice_number?: string;
  quantity: number;
  supplier?: string;
  drawer_id: string;
  unit_price: number;
  notes?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/stock/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to receive stock');
  }
  return res.json();
}

export async function consumeStock(payload: {
  sku?: string;
  item_id?: number;
  drawer_id: string;
  quantity: number;
  project_name?: string;
  requester?: string;
  notes?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/stock/consume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to consume stock');
  }
  return res.json();
}

export async function transferStock(payload: {
  sku?: string;
  item_id?: number;
  from_drawer_id: string;
  to_drawer_id: string;
  quantity: number;
  notes?: string;
}) {
  const res = await fetch(`${BASE_URL}/api/stock/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to transfer stock');
  }
  return res.json();
}

export async function dispatchRequisition(requisition_code: string) {
  const res = await fetch(`${BASE_URL}/api/requisitions/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requisition_code }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to dispatch requisition');
  }
  return res.json();
}

export async function fetchDrawerLabels(): Promise<DrawerLabelQr[]> {
  const res = await fetch(`${BASE_URL}/api/qr/drawer-labels`);
  if (!res.ok) throw new Error('Failed to fetch drawer labels');
  return res.json();
}

export async function searchGlobal(q: string) {
  const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Failed to execute search');
  return res.json();
}
