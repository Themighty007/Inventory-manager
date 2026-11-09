import { DrawerSummary, ItemResponse } from '../types/inventory';

export interface PendingOperation {
  client_op_id: string; // Unique UUID
  action: 'RECEIVE' | 'CONSUME' | 'TRANSFER';
  payload: any;
  timestamp: string;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
  error?: string;
}

const DB_NAME = 'StanleyInventoryOfflineDB';
const DB_VERSION = 1;

const STORES = {
  OPERATIONS: 'pending_operations',
  DRAWERS: 'cached_drawers',
  ITEMS: 'cached_items',
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.OPERATIONS)) {
        db.createObjectStore(STORES.OPERATIONS, { keyPath: 'client_op_id' });
      }

      if (!db.objectStoreNames.contains(STORES.DRAWERS)) {
        db.createObjectStore(STORES.DRAWERS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.ITEMS)) {
        db.createObjectStore(STORES.ITEMS, { keyPath: 'sku' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Generate cryptographically secure UUID v4
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Queue a new pending operation in IndexedDB with unique UUID
 */
export async function enqueueOperation(
  action: 'RECEIVE' | 'CONSUME' | 'TRANSFER',
  payload: any
): Promise<PendingOperation> {
  const db = await openDb();
  const op: PendingOperation = {
    client_op_id: generateUUID(),
    action,
    payload,
    timestamp: new Date().toISOString(),
    status: 'PENDING',
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OPERATIONS, 'readwrite');
    const store = tx.objectStore(STORES.OPERATIONS);
    const req = store.put(op);

    req.onsuccess = () => resolve(op);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Retrieve all pending operations from IndexedDB
 */
export async function getPendingOperations(): Promise<PendingOperation[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.OPERATIONS, 'readonly');
      const store = tx.objectStore(STORES.OPERATIONS);
      const req = store.getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Error reading offline queue:', err);
    return [];
  }
}

/**
 * Update an existing operation's status or error in IndexedDB
 */
export async function updateOperationStatus(
  client_op_id: string,
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED',
  error?: string
): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OPERATIONS, 'readwrite');
    const store = tx.objectStore(STORES.OPERATIONS);
    const getReq = store.get(client_op_id);

    getReq.onsuccess = () => {
      const op = getReq.result;
      if (op) {
        op.status = status;
        if (error !== undefined) op.error = error;
        store.put(op);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/**
 * Remove an operation after backend confirmation
 */
export async function removeOperation(client_op_id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.OPERATIONS, 'readwrite');
    const store = tx.objectStore(STORES.OPERATIONS);
    const req = store.delete(client_op_id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Cache drawers for offline browsing
 */
export async function cacheDrawersOffline(drawers: DrawerSummary[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORES.DRAWERS, 'readwrite');
    const store = tx.objectStore(STORES.DRAWERS);
    store.clear();
    for (const d of drawers) {
      store.put(d);
    }
  } catch (err) {
    console.warn('Failed to cache drawers offline:', err);
  }
}

/**
 * Get cached drawers when offline
 */
export async function getCachedDrawersOffline(): Promise<DrawerSummary[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.DRAWERS, 'readonly');
      const store = tx.objectStore(STORES.DRAWERS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Cache items for offline searching
 */
export async function cacheItemsOffline(items: ItemResponse[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(STORES.ITEMS, 'readwrite');
    const store = tx.objectStore(STORES.ITEMS);
    store.clear();
    for (const it of items) {
      store.put(it);
    }
  } catch (err) {
    console.warn('Failed to cache items offline:', err);
  }
}

/**
 * Get cached items when offline
 */
export async function getCachedItemsOffline(): Promise<ItemResponse[]> {
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.ITEMS, 'readonly');
      const store = tx.objectStore(STORES.ITEMS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
