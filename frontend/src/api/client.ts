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
  ParsedInvoiceResponse,
  InvoiceCommitPayload,
  InvoiceCommitResult,
  InvoiceSummaryResponse,
  PendingDeliveryItem,
  AssignPendingDrawerPayload,
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

export async function fetchQrCode(code: string): Promise<{ code: string; data_uri: string }> {
  const res = await fetch(`${BASE_URL}/api/qr/code?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error('Failed to fetch QR code');
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

export async function parseInvoiceFile(file: File): Promise<ParsedInvoiceResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${BASE_URL}/api/invoices/parse`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    let detail = 'Failed to parse uploaded invoice document';
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function commitInvoice(payload: InvoiceCommitPayload): Promise<InvoiceCommitResult> {
  const res = await fetch(`${BASE_URL}/api/invoices/commit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = 'Failed to commit invoice items';
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // keep fallback detail
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function fetchInvoices(query?: string): Promise<InvoiceSummaryResponse[]> {
  const params = new URLSearchParams();
  if (query && query.trim()) params.append('q', query.trim());
  const url = `${BASE_URL}/api/invoices${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch logged invoices');
  return res.json();
}

export async function fetchInvoiceDetail(invoiceId: number): Promise<InvoiceSummaryResponse> {
  const res = await fetch(`${BASE_URL}/api/invoices/${invoiceId}`);
  if (!res.ok) throw new Error('Failed to load invoice detail');
  return res.json();
}

export async function fetchNetworkInfo(): Promise<import('../types/inventory').NetworkInfo> {
  const res = await fetch(`${BASE_URL}/api/network-info`);
  if (!res.ok) throw new Error('Failed to fetch network information');
  return res.json();
}

export async function fetchPendingDeliveries(sku?: string, invoiceNumber?: string): Promise<PendingDeliveryItem[]> {
  const params = new URLSearchParams();
  if (sku && sku.trim()) params.append('sku', sku.trim());
  if (invoiceNumber && invoiceNumber.trim()) params.append('invoice_number', invoiceNumber.trim());
  const url = `${BASE_URL}/api/pending-deliveries${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch pending deliveries');
  return res.json();
}

export async function assignPendingDeliveryDrawer(
  itemId: number,
  payload: AssignPendingDrawerPayload,
): Promise<{ status: string; message: string; sku: string; drawer_id: string; quantity: number }> {
  const res = await fetch(`${BASE_URL}/api/pending-deliveries/${itemId}/assign-drawer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let detail = 'Failed to assign drawer';
    try {
      const err = await res.json();
      detail = err.detail || detail;
    } catch {
      // keep fallback
    }
    throw new Error(detail);
  }
  return res.json();
}
