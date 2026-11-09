import {
  DrawerSummary,
  DrawerDetail,
  ItemResponse,
  DashboardStats,
  TransactionResponse,
  DrawerLabelQr,
  StockReceivePayload,
  StockConsumePayload,
  StockTransferPayload,
  SyncBatchResult,
} from '../types/inventory';

// Dynamic Base URL resolving to the host that served the PWA (HTTP or HTTPS)
const getBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.origin && window.location.origin !== 'null') {
    return window.location.origin;
  }
  return 'http://localhost:8000';
};

const BASE_URL = getBaseUrl();

export async function checkServerHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/dashboard/stats`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(3500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchDrawers(): Promise<DrawerSummary[]> {
  const res = await fetch(`${BASE_URL}/api/drawers`);
  if (!res.ok) throw new Error('Failed to fetch drawers');
  return res.json();
}

export async function fetchDrawerDetail(id: string): Promise<DrawerDetail> {
  const res = await fetch(`${BASE_URL}/api/drawers/${id.toUpperCase()}`);
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

export async function createItem(payload: any): Promise<ItemResponse> {
  const res = await fetch(`${BASE_URL}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to create item');
  }
  return res.json();
}

export async function receiveStock(payload: StockReceivePayload) {
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

export async function consumeStock(payload: StockConsumePayload) {
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

export async function transferStock(payload: StockTransferPayload) {
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

export async function adjustStock(payload: { sku: string; drawer_id: string; physical_count: number; reason: string }) {
  const res = await fetch(`${BASE_URL}/api/stock/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to adjust stock');
  }
  return res.json();
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch(`${BASE_URL}/api/dashboard/stats`);
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

export async function fetchTransactions(limit: number = 50): Promise<TransactionResponse[]> {
  const res = await fetch(`${BASE_URL}/api/transactions?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch transactions');
  return res.json();
}

export async function searchGlobal(q: string) {
  const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error('Failed to execute search');
  return res.json();
}

export async function fetchDrawerLabels(): Promise<DrawerLabelQr[]> {
  const res = await fetch(`${BASE_URL}/api/qr/drawer-labels`);
  if (!res.ok) throw new Error('Failed to fetch drawer labels');
  return res.json();
}

export async function syncBatchOperations(operations: any[]): Promise<SyncBatchResult> {
  const res = await fetch(`${BASE_URL}/api/sync/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operations }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to synchronize batch');
  }
  return res.json();
}

export async function clearDemoData() {
  const res = await fetch(`${BASE_URL}/api/admin/clear-demo-data`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to clear demo data');
  return res.json();
}

export async function resetDemoData() {
  const res = await fetch(`${BASE_URL}/api/admin/reset-demo-data`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demo data');
  return res.json();
}
