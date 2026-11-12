import React, { useState } from 'react';
import { DrawerSummary, DrawerDetail } from '../../types/inventory';
import { fetchDrawerDetail, consumeStock } from '../../api/client';
import { enqueueOperation } from '../../db/offlineDb';
import {
  Layers,
  CheckCircle,
  Plus,
  Minus,
  MinusCircle,
  X,
  AlertCircle,
  Box,
} from 'lucide-react';

interface MobileCabinetViewProps {
  drawers: DrawerSummary[];
  isOnline: boolean;
  userName: string;
  onRefresh: () => void;
  onIntakeForDrawer: (drawerId: string) => void;
  onNotice: (msg: string) => void;
}

export const MobileCabinetView: React.FC<MobileCabinetViewProps> = ({
  drawers,
  isOnline,
  userName,
  onRefresh,
  onIntakeForDrawer,
  onNotice,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OCCUPIED' | 'EMPTY'>('ALL');
  const [selectedDetail, setSelectedDetail] = useState<DrawerDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [removeQty, setRemoveQty] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const smallDrawers = drawers.filter((d) => d.drawer_type === 'SMALL');
  const largeDrawers = drawers.filter((d) => d.drawer_type === 'LARGE');

  const matchesFilter = (d: DrawerSummary) => {
    if (filter === 'OCCUPIED') return d.is_occupied;
    if (filter === 'EMPTY') return !d.is_occupied;
    return true;
  };

  const handleOpenDrawer = async (id: string) => {
    try {
      setLoadingDetail(true);
      setActionError(null);
      setIsDetailOpen(true);
      setRemoveQty(1);

      if (isOnline) {
        const detail = await fetchDrawerDetail(id);
        setSelectedDetail(detail);
      } else {
        const local = drawers.find((d) => d.id === id);
        if (local) {
          setSelectedDetail({
            id: local.id,
            section: local.section,
            drawer_type: local.drawer_type,
            row_idx: local.row_idx,
            col_idx: local.col_idx,
            dimensions: local.dimensions,
            is_occupied: local.is_occupied,
            total_units: local.total_units,
            items: local.items_preview.map((p) => {
              const [sku, rest] = p.split(' ');
              const qty = parseInt(rest?.replace(/[()]/g, '') || '1');
              return {
                sku,
                name: sku,
                category: 'General',
                quantity: qty,
                unit: 'pcs',
                unit_cost: 0,
                sub_tray: 'MAIN',
              };
            }),
          });
        }
      }
    } catch (err: any) {
      setActionError(`Could not load drawer details: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleRemoveStock = async (itemSku: string, maxQty: number) => {
    if (!selectedDetail) return;
    const qty = Math.min(removeQty, maxQty);

    const payload = {
      drawer_id: selectedDetail.id,
      item_sku: itemSku,
      quantity: qty,
      sub_tray: 'MAIN',
      reason: 'CONSUMED',
      operator_name: userName,
      notes: `Removed via Mobile PWA by ${userName}`,
    };

    if (isOnline) {
      try {
        const res = await consumeStock(payload);
        onNotice(`Stock removed: ${res.message}`);
        handleOpenDrawer(selectedDetail.id);
        onRefresh();
      } catch (err: any) {
        setActionError(err.message || 'Failed to remove stock.');
      }
    } else {
      try {
        const queuedOp = await enqueueOperation('CONSUME', payload);
        onNotice(
          `Pending Sync: Consume queued in IndexedDB (UUID: ${queuedOp.client_op_id.slice(0, 8)}...).`
        );
        setIsDetailOpen(false);
      } catch (err: any) {
        setActionError(`Failed to save offline: ${err.message}`);
      }
    }
  };

  const occupiedCount = drawers.filter((d) => d.is_occupied).length;

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-3.5 select-none text-slate-800 pb-12">
      {/* Overview Status Ribbon */}
      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
            Stanley 1-93-981 Cabinet
          </span>
          <span className="text-sm font-display font-bold text-[#0B132B]">
            39 Physical Compartments
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-semibold text-[#2EC4B6] bg-[#2EC4B6]/10 px-2.5 py-0.5 rounded-full border border-[#2EC4B6]/20 inline-block font-mono">
            {occupiedCount} Occupied • {39 - occupiedCount} Empty
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-3 text-xs font-semibold">
        {(['ALL', 'OCCUPIED', 'EMPTY'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1 rounded-lg border transition-all ${
              filter === mode
                ? 'bg-[#0B132B] text-white border-[#0B132B] shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* SECTION 1: 30 Small Drawers (5 rows x 6 cols) */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Upper Section • 30 Small Drawers</span>
          <span className="font-mono text-[9px]">S01 – S30</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {smallDrawers.map((d) => {
            const isVisible = matchesFilter(d);
            return (
              <button
                key={d.id}
                onClick={() => handleOpenDrawer(d.id)}
                className={`p-2 rounded-xl border text-center flex flex-col items-center justify-center transition-all active:scale-95 shadow-xs ${
                  !isVisible
                    ? 'opacity-20 pointer-events-none'
                    : d.is_occupied
                    ? 'bg-[#00B4D8]/10 border-[#00B4D8]/30 hover:bg-[#00B4D8]/20 text-[#00B4D8]'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-mono font-bold text-xs">{d.id}</span>
                <span className="text-[9px] font-medium mt-0.5 font-mono opacity-80">
                  {d.is_occupied ? `${d.total_units}u` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: 9 Large Drawers (3 rows x 3 cols) */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Lower Section • 9 Large Drawers</span>
          <span className="font-mono text-[9px]">L01 – L09</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {largeDrawers.map((d) => {
            const isVisible = matchesFilter(d);
            return (
              <button
                key={d.id}
                onClick={() => handleOpenDrawer(d.id)}
                className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center transition-all active:scale-95 shadow-xs ${
                  !isVisible
                    ? 'opacity-20 pointer-events-none'
                    : d.is_occupied
                    ? 'bg-[#2EC4B6]/10 border-[#2EC4B6]/30 hover:bg-[#2EC4B6]/20 text-[#2EC4B6]'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <span className="font-mono font-bold text-sm">{d.id}</span>
                <span className="text-[10px] font-semibold mt-0.5 font-mono">
                  {d.is_occupied ? `${d.total_units} units` : 'Empty'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DRAWER DETAILS BOTTOM SHEET MODAL */}
      {isDetailOpen && selectedDetail && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0 backdrop-blur-xs"
          onClick={() => setIsDetailOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white border-t border-slate-200 rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#0B132B] text-white flex flex-col items-center justify-center font-mono font-bold">
                  <span className="text-base">{selectedDetail.id}</span>
                  <span className="text-[9px] text-[#00B4D8] uppercase">
                    {selectedDetail.drawer_type === 'SMALL' ? 'Small' : 'Large'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-display font-bold text-[#0B132B]">
                      Compartment {selectedDetail.id}
                    </h3>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        selectedDetail.is_occupied
                          ? 'bg-[#2EC4B6]/10 text-[#2EC4B6] border-[#2EC4B6]/30'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}
                    >
                      {selectedDetail.is_occupied ? 'Occupied' : 'Empty'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedDetail.total_units} units in compartment
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsDetailOpen(false)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* Quick Intake Button */}
            <button
              onClick={() => {
                setIsDetailOpen(false);
                onIntakeForDrawer(selectedDetail.id);
              }}
              className="w-full btn-cyan py-2.5 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add / Receive Component into {selectedDetail.id}
            </button>

            {/* Stored Items List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                Stored Items ({selectedDetail.items.length})
              </span>

              {selectedDetail.items.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                  This drawer is currently empty.
                </div>
              ) : (
                selectedDetail.items.map((it) => (
                  <div
                    key={it.sku}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-xs text-[#0B132B]">
                          {it.sku}
                        </span>
                        <div className="text-xs font-medium text-slate-600 line-clamp-1">
                          {it.name}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {it.category}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-bold text-[#00B4D8] bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                        {it.quantity} {it.unit}
                      </span>
                    </div>

                    {/* Stock Removal Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setRemoveQty((q) => Math.max(1, q - 1))}
                          className="w-6 h-6 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-600 text-xs font-bold"
                        >
                          -
                        </button>
                        <span className="font-mono text-xs font-bold w-6 text-center">
                          {removeQty}
                        </span>
                        <button
                          onClick={() => setRemoveQty((q) => Math.min(it.quantity, q + 1))}
                          className="w-6 h-6 rounded border border-slate-200 bg-white flex items-center justify-center text-slate-600 text-xs font-bold"
                        >
                          +
                        </button>
                      </div>

                      <button
                        onClick={() => handleRemoveStock(it.sku, it.quantity)}
                        className="py-1 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1"
                      >
                        <MinusCircle className="w-3.5 h-3.5 text-red-500" />
                        <span>Take {removeQty}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
