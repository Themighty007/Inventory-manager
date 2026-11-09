import React, { useState } from 'react';
import { DrawerSummary, DrawerDetail } from '../../types/inventory';
import { fetchDrawerDetail, consumeStock } from '../../api/client';
import { enqueueOperation } from '../../db/offlineDb';
import {
  Layers,
  QrCode,
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
        // Fallback when offline
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
      sku: itemSku,
      drawer_id: selectedDetail.id,
      quantity: qty,
      requester: userName,
      notes: `Deducted via Mobile PWA`,
    };

    if (isOnline) {
      try {
        const res = await consumeStock(payload);
        onNotice(`Removed ${qty} of ${itemSku} from Drawer ${selectedDetail.id}`);
        // Reload detail
        const updated = await fetchDrawerDetail(selectedDetail.id);
        setSelectedDetail(updated);
        onRefresh();
      } catch (err: any) {
        setActionError(err.message || 'Deduction failed.');
      }
    } else {
      // Offline queue
      try {
        await enqueueOperation('CONSUME', payload);
        onNotice(`Offline: Deduct ${qty} of ${itemSku} queued in phone memory.`);
        setIsDetailOpen(false);
      } catch (err: any) {
        setActionError(err.message);
      }
    }
  };

  const occupiedCount = drawers.filter((d) => d.is_occupied).length;

  return (
    <div className="flex flex-col h-full bg-[#F8F6F1] overflow-y-auto p-3.5 select-none text-[#18181B] pb-12">
      {/* Overview Status Ribbon */}
      <div className="p-3 bg-white rounded-xl border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-between mb-3">
        <div>
          <span className="text-[10px] font-black uppercase text-[#71717A] block">
            Stanley 1-93-981 Cabinet
          </span>
          <span className="text-sm font-black text-[#18181B] font-mono">
            39 Compartments
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-black text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-md border border-[#86EFAC] inline-block font-mono">
            {occupiedCount} Occupied • {39 - occupiedCount} Empty
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 mb-3 text-xs font-bold">
        {(['ALL', 'OCCUPIED', 'EMPTY'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilter(mode)}
            className={`px-3 py-1 rounded-lg border-2 border-[#18181B] transition-all ${
              filter === mode
                ? 'bg-[#18181B] text-white shadow-[1px_1px_0px_#18181B]'
                : 'bg-white text-[#18181B] hover:bg-[#F4F4F5]'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* SECTION 1: 30 Small Drawers (5 rows x 6 cols) */}
      <div className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-wider text-[#71717A] mb-1.5 flex items-center justify-between">
          <span>Upper Section • 30 Small Drawers</span>
          <span className="font-mono text-[9px]">S01 – S30 (13.5 × 5.0 × 3.5 cm)</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {smallDrawers.map((d) => {
            const isVisible = matchesFilter(d);
            return (
              <button
                key={d.id}
                onClick={() => handleOpenDrawer(d.id)}
                className={`p-2 rounded-xl border-2 border-[#18181B] text-center flex flex-col items-center justify-center transition-all active:scale-95 shadow-[1.5px_1.5px_0px_#18181B] ${
                  !isVisible
                    ? 'opacity-20 pointer-events-none'
                    : d.is_occupied
                    ? 'bg-[#FEF08A] hover:bg-[#FDE047]'
                    : 'bg-white hover:bg-[#F4F4F5]'
                }`}
              >
                <span className="font-mono font-black text-xs text-[#18181B]">{d.id}</span>
                <span className="text-[9px] font-bold text-[#71717A] mt-0.5 font-mono">
                  {d.is_occupied ? `${d.total_units}u` : '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: 9 Large Drawers (3 rows x 3 cols) */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-wider text-[#71717A] mb-1.5 flex items-center justify-between">
          <span>Lower Section • 9 Large Drawers</span>
          <span className="font-mono text-[9px]">L01 – L09 (13.5 × 11.0 × 6.0 cm)</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {largeDrawers.map((d) => {
            const isVisible = matchesFilter(d);
            return (
              <button
                key={d.id}
                onClick={() => handleOpenDrawer(d.id)}
                className={`p-3 rounded-xl border-2 border-[#18181B] text-center flex flex-col items-center justify-center transition-all active:scale-95 shadow-[2px_2px_0px_#18181B] ${
                  !isVisible
                    ? 'opacity-20 pointer-events-none'
                    : d.is_occupied
                    ? 'bg-[#86EFAC] hover:bg-[#6EE7B7]'
                    : 'bg-white hover:bg-[#F4F4F5]'
                }`}
              >
                <span className="font-mono font-black text-sm text-[#18181B]">{d.id}</span>
                <span className="text-[10px] font-bold text-[#18181B] mt-0.5 font-mono">
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
            className="w-full max-w-md bg-white border-t-4 border-[#18181B] rounded-t-3xl p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B]">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#18181B] text-white flex flex-col items-center justify-center font-mono font-black border-2 border-[#18181B]">
                  <span className="text-base">{selectedDetail.id}</span>
                  <span className="text-[9px] text-[#A1A1AA] uppercase">
                    {selectedDetail.drawer_type === 'SMALL' ? 'Small' : 'Large'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-[#18181B]">
                      Compartment {selectedDetail.id}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#18181B] ${
                        selectedDetail.is_occupied
                          ? 'bg-[#86EFAC] text-[#064E3B]'
                          : 'bg-[#FEF08A] text-[#713F12]'
                      }`}
                    >
                      {selectedDetail.is_occupied ? 'Available' : 'Empty'}
                    </span>
                  </div>
                  <span className="text-[10px] text-[#71717A] font-mono block">
                    {selectedDetail.dimensions}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setIsDetailOpen(false)}
                className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4 text-[#18181B]" />
              </button>
            </div>

            {actionError && (
              <div className="p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#B91C1C] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            {/* QR Label Stamp on Mobile */}
            <div className="p-3 bg-[#FAF9F5] border-2 border-[#18181B] rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 bg-white border-2 border-[#18181B] rounded-lg flex items-center justify-center p-1">
                  <QrCode className="w-full h-full text-[#18181B]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#71717A] block">DRAWER STAMP</span>
                  <span className="text-xs font-mono font-black text-[#18181B]">
                    DRAWER:{selectedDetail.id}
                  </span>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#FEF08A] border border-[#18181B] px-2 py-1 rounded">
                QR Verified
              </span>
            </div>

            {/* Stored Items / Contents */}
            <div>
              <div className="text-[11px] font-black uppercase text-[#71717A] mb-2 flex items-center justify-between">
                <span>Stored Components</span>
                <span className="font-mono text-[10px] font-bold">
                  {selectedDetail.items?.length || 0} unique SKU(s)
                </span>
              </div>

              {selectedDetail.items && selectedDetail.items.length > 0 ? (
                <div className="space-y-3">
                  {selectedDetail.items.map((it) => (
                    <div
                      key={it.sku}
                      className="p-3.5 bg-white border-2 border-[#18181B] rounded-xl shadow-[2px_2px_0px_#18181B] space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-mono font-black text-xs text-[#18181B]">
                            {it.sku}
                          </div>
                          <div className="font-semibold text-xs text-[#18181B] mt-0.5">
                            {it.name}
                          </div>
                          <span className="text-[10px] text-[#71717A] uppercase font-mono">
                            {it.category}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-black uppercase text-[#71717A] block">
                            Available
                          </span>
                          <span className="text-sm font-black font-mono text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#86EFAC] inline-block">
                            {it.quantity} {it.unit}
                          </span>
                        </div>
                      </div>

                      {/* Quantity Stepper & Remove Action */}
                      <div className="pt-2 border-t border-[#E4E4E7] flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setRemoveQty(Math.max(1, removeQty - 1))}
                            className="w-7 h-7 rounded border border-[#18181B] flex items-center justify-center font-bold bg-[#F4F4F5]"
                          >
                            -
                          </button>
                          <span className="w-8 text-center font-mono font-black text-xs">
                            {removeQty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setRemoveQty(Math.min(it.quantity, removeQty + 1))}
                            className="w-7 h-7 rounded border border-[#18181B] flex items-center justify-center font-bold bg-[#F4F4F5]"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveStock(it.sku, it.quantity)}
                          className="flex-1 brutal-btn brutal-btn-coral text-xs py-1.5 px-3 text-[#B91C1C]"
                        >
                          <MinusCircle className="w-3.5 h-3.5" /> Remove {removeQty} units
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[#FAFAFA] border-2 border-dashed border-[#D4D4D8] rounded-xl text-center space-y-2">
                  <span className="text-xs text-[#71717A] font-semibold block">
                    This drawer compartment is empty.
                  </span>
                  <button
                    onClick={() => {
                      setIsDetailOpen(false);
                      onIntakeForDrawer(selectedDetail.id);
                    }}
                    className="brutal-btn brutal-btn-mint text-xs py-1.5 px-3 text-[#064E3B]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Put Item In Drawer {selectedDetail.id}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  setIsDetailOpen(false);
                  onIntakeForDrawer(selectedDetail.id);
                }}
                className="flex-1 brutal-btn brutal-btn-yellow text-xs py-2 text-[#713F12]"
              >
                <Plus className="w-3.5 h-3.5" /> + Add Stock To {selectedDetail.id}
              </button>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="py-2 px-4 rounded-xl border-2 border-[#18181B] bg-[#F4F4F5] text-xs font-bold text-[#18181B]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
