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
      for (const op of queue) {
        await updateOperationStatus(op.client_op_id, 'SYNCING');
      }

      const res = await syncBatchOperations(queue);

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
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-4 select-none text-slate-800 pb-16">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] flex items-center justify-center font-bold border border-[#00B4D8]/20">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-display font-bold text-[#0B132B]">
              Offline Pending Queue
            </h2>
            <span className="text-[10px] text-slate-400 font-mono">
              IndexedDB • Guaranteed Idempotency
            </span>
          </div>
        </div>

        <button
          onClick={loadQueue}
          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors"
          title="Reload queue"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Connectivity Status Card */}
      <div
        className={`p-3.5 rounded-xl border flex items-center justify-between mb-4 ${
          isOnline
            ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/30 text-[#0B132B]'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-[#2EC4B6]" />
          ) : (
            <WifiOff className="w-5 h-5 text-amber-600" />
          )}
          <div>
            <span className="text-xs font-bold block">
              {isOnline ? 'Windows Master Online' : 'Device Working Offline'}
            </span>
            <span className="text-[10px] text-slate-500">
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
            className="btn-cyan text-xs py-1.5 px-3 rounded-lg flex items-center gap-1 font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        )}
      </div>

      {lastSyncResult && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 font-medium">
          {lastSyncResult}
        </div>
      )}

      {/* Queue Items */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
          <span>QUEUED TRANSACTIONS ({queue.length})</span>
          {queue.length > 0 && isOnline && (
            <span className="text-[#2EC4B6] font-mono">Auto-Sync Enabled</span>
          )}
        </div>

        {queue.length === 0 ? (
          <div className="p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-2 bg-white">
            <CheckCircle2 className="w-10 h-10 text-[#2EC4B6] mx-auto" />
            <h3 className="text-xs font-bold text-[#0B132B]">All Transactions Synced</h3>
            <p className="text-[11px] text-slate-400">
              There are no pending offline operations. All phone records match the master database.
            </p>
          </div>
        ) : (
          queue.map((op) => (
            <div
              key={op.client_op_id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      op.status === 'PENDING'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : op.status === 'SYNCING'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    {op.status}
                  </span>
                  <span className="font-mono text-xs font-bold text-[#0B132B]">
                    {op.action || op.op_type}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteOp(op.client_op_id)}
                  className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  title="Remove from queue"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs font-medium text-slate-600">
                {(op.action || op.op_type) === 'RECEIVE' && (
                  <span>
                    SKU: <b>{op.payload.item_sku}</b> • Qty: <b>{op.payload.quantity}</b> → Drawer{' '}
                    <b>{op.payload.drawer_id}</b>
                  </span>
                )}
                {(op.action || op.op_type) === 'CONSUME' && (
                  <span>
                    SKU: <b>{op.payload.item_sku}</b> • Qty: <b>{op.payload.quantity}</b> (from{' '}
                    <b>{op.payload.drawer_id}</b>)
                  </span>
                )}
                {(op.action || op.op_type) === 'INVOICE_COMMIT' && (
                  <span>
                    Invoice #{' '}
                    <b>{op.payload.invoice_number}</b> •{' '}
                    <b>{op.payload.items?.length || 0} component(s)</b>
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(op.timestamp || op.created_at || Date.now()).toLocaleTimeString()}
                </span>
                <span title={op.client_op_id}>UUID: {op.client_op_id.slice(0, 8)}...</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
