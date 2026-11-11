import React, { useState, useEffect } from 'react';
import {
  PendingOperation,
  getPendingOperations,
  removeOperation,
  updateOperationStatus,
} from '../../db/offlineDb';
import { syncBatchOperations } from '../../api/client';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Wifi,
  WifiOff,
  Trash2,
} from 'lucide-react';

interface MobileSyncQueueProps {
  isOnline: boolean;
  onSyncCompleted: () => void;
  onNotice: (msg: string) => void;
}

export const MobileSyncQueue: React.FC<MobileSyncQueueProps> = ({
  isOnline,
  onSyncCompleted,
  onNotice,
}) => {
  const [queue, setQueue] = useState<PendingOperation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    const ops = await getPendingOperations();
    setQueue(ops);
  };

  const handleSyncAll = async () => {
    if (queue.length === 0 || !isOnline) return;

    setSyncing(true);
    setLastSyncResult(null);

    try {
      // Mark as SYNCING in IndexedDB
      for (const op of queue) {
        await updateOperationStatus(op.client_op_id, 'SYNCING');
      }

      const res = await syncBatchOperations(queue);

      // Process results and remove confirmed operations
      for (const r of res.results) {
        if (r.status === 'CONFIRMED' || r.status === 'ALREADY_CONFIRMED') {
          await removeOperation(r.client_op_id);
        } else {
          await updateOperationStatus(r.client_op_id, 'FAILED', r.error || 'Server rejected');
        }
      }

      setLastSyncResult(`Successfully synced ${res.synced_count} operations with Windows master database!`);
      onNotice(`Synced ${res.synced_count} offline transactions.`);
      await loadQueue();
      onSyncCompleted();
    } catch (err: any) {
      setLastSyncResult(`Sync failed: ${err.message}. Retrying when connection stabilizes.`);
      // Reset to PENDING
      for (const op of queue) {
        await updateOperationStatus(op.client_op_id, 'PENDING');
      }
      await loadQueue();
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteOp = async (id: string) => {
    if (window.confirm('Delete this pending operation from local phone memory?')) {
      await removeOperation(id);
      await loadQueue();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F6F1] overflow-y-auto p-4 select-none text-[#18181B] pb-12">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#93C5FD] text-[#1E3A8A] flex items-center justify-center font-bold border-2 border-[#18181B]">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-black text-[#18181B] tracking-tight">
              Offline Pending Queue
            </h2>
            <span className="text-[10px] text-[#71717A] font-mono">
              IndexedDB • Guaranteed Idempotency
            </span>
          </div>
        </div>

        <button
          onClick={loadQueue}
          className="p-1.5 rounded-lg border border-[#18181B] bg-white hover:bg-[#F4F4F5]"
          title="Reload queue"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#18181B]" />
        </button>
      </div>

      {/* Connectivity Status Card */}
      <div
        className={`p-3.5 rounded-xl border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-between mb-4 ${
          isOnline ? 'bg-[#DCFCE7]' : 'bg-[#FEF08A]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-[#15803D]" />
          ) : (
            <WifiOff className="w-5 h-5 text-[#713F12]" />
          )}
          <div>
            <span className="text-xs font-black block">
              {isOnline ? 'Windows Master Online' : 'Device Working Offline'}
            </span>
            <span className="text-[10px] text-[#52525B]">
              {isOnline
                ? 'Ready to sync pending phone transactions.'
                : 'Transactions safely queued in IndexedDB.'}
            </span>
          </div>
        </div>

        {queue.length > 0 && isOnline && (
          <button
            onClick={handleSyncAll}
            disabled={syncing}
            className="brutal-btn brutal-btn-mint text-xs py-1.5 px-3 text-[#064E3B]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {lastSyncResult && (
        <div className="p-3 bg-white border-2 border-[#18181B] rounded-xl text-xs font-bold text-[#15803D] flex items-center gap-2 mb-4 shadow-[2px_2px_0px_#18181B]">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{lastSyncResult}</span>
        </div>
      )}

      {/* Queue Items List */}
      <div className="space-y-3">
        <div className="text-xs font-black uppercase text-[#71717A] flex items-center justify-between">
          <span>PENDING TRANSACTIONS ({queue.length})</span>
          <span className="text-[10px] font-mono">Status: {queue.length > 0 ? 'Action Required' : 'Clean'}</span>
        </div>

        {queue.length > 0 ? (
          queue.map((op) => (
            <div
              key={op.client_op_id}
              className="p-3.5 bg-white rounded-xl border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] space-y-2"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border border-[#18181B] ${
                    op.action === 'RECEIVE'
                      ? 'bg-[#DCFCE7] text-[#166534]'
                      : op.action === 'CONSUME'
                      ? 'bg-[#FEE2E2] text-[#991B1B]'
                      : 'bg-[#FEF08A] text-[#854D0E]'
                  }`}
                >
                  {op.action}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-[#71717A] font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(op.timestamp).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => handleDeleteOp(op.client_op_id)}
                    className="p-1 hover:text-[#B91C1C]"
                    title="Discard from queue"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="text-xs font-mono font-bold text-[#18181B]">
                {op.action === 'INVOICE_COMMIT'
                  ? `Invoice ${op.payload.invoice_number} (${op.payload.items?.length || 0} components)`
                  : `${op.payload.item_sku || op.payload.sku} → Drawer ${op.payload.drawer_id} (${op.payload.quantity} units)`}
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#71717A] font-mono pt-1 border-t border-[#F4F4F5]">
                <span>UUID: {op.client_op_id.slice(0, 12)}...</span>
                <span className="font-bold text-[#D97706] bg-[#FEF3C7] px-1.5 py-0.5 rounded">
                  {op.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-8 bg-white border-2 border-dashed border-[#D4D4D8] rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-[#15803D] mx-auto" />
            <h4 className="text-xs font-black text-[#18181B] uppercase">All Operations Synchronized</h4>
            <p className="text-[11px] text-[#71717A]">
              Your phone cache has no pending transactions. All stock movements have been acknowledged by the Windows master database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
