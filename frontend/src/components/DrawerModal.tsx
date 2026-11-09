import React, { useState, useEffect } from 'react';
import { DrawerDetail } from '../types/inventory';
import { fetchDrawerDetail, consumeStock, transferStock } from '../api/client';
import { X, Plus, Minus, ArrowRightLeft, QrCode, Box, ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';

interface DrawerModalProps {
  drawerId: string | null;
  userName: string;
  onClose: () => void;
  onRefresh: () => void;
  onOpenReceiveForDrawer: (drawerId: string) => void;
  onPrintQrForDrawer: (drawerId: string) => void;
}

export const DrawerModal: React.FC<DrawerModalProps> = ({
  drawerId,
  userName,
  onClose,
  onRefresh,
  onOpenReceiveForDrawer,
  onPrintQrForDrawer,
}) => {
  const [detail, setDetail] = useState<DrawerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'CONTENTS' | 'REMOVE' | 'TRANSFER' | 'QR'>('CONTENTS');

  // Quick Remove state
  const [removeSku, setRemoveSku] = useState('');
  const [removeQty, setRemoveQty] = useState(1);
  const [reason, setReason] = useState('');

  // Transfer state
  const [transferSku, setTransferSku] = useState('');
  const [targetDrawer, setTargetDrawer] = useState('S01');
  const [transferQty, setTransferQty] = useState(1);

  // Status/Error
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (drawerId) {
      loadDrawer(drawerId);
    }
  }, [drawerId]);

  const loadDrawer = async (id: string) => {
    try {
      setLoading(true);
      setActionError(null);
      setActionSuccess(null);
      const res = await fetchDrawerDetail(id);
      setDetail(res);
      if (res.items.length > 0) {
        setRemoveSku(res.items[0].sku);
        setTransferSku(res.items[0].sku);
      }
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerId || !removeSku) return;
    try {
      setActionError(null);
      const res = await consumeStock({
        drawer_id: drawerId,
        sku: removeSku,
        quantity: removeQty,
        requester: userName || 'User',
        project_name: reason || 'Part Consumed / Used',
      });
      setActionSuccess(res.message);
      loadDrawer(drawerId);
      onRefresh();
      setTimeout(() => setActiveTab('CONTENTS'), 1200);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerId || !transferSku) return;
    try {
      setActionError(null);
      const res = await transferStock({
        from_drawer_id: drawerId,
        to_drawer_id: targetDrawer,
        sku: transferSku,
        quantity: transferQty,
      });
      setActionSuccess(res.message);
      loadDrawer(drawerId);
      onRefresh();
      setTimeout(() => setActiveTab('CONTENTS'), 1200);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  if (!drawerId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="brutal-card bg-white w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#18181B] mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#18181B] text-white flex flex-col items-center justify-center font-mono font-black border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
              <span className="text-base">{drawerId}</span>
              <span className="text-[9px] text-[#A1A1AA] uppercase">
                {detail?.drawer_type === 'SMALL' ? 'Small' : 'Large'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-[#18181B]">Compartment {drawerId}</h2>
                <span className={`brutal-pill ${detail?.is_occupied ? 'pill-mint' : 'pill-yellow'}`}>
                  {detail?.is_occupied ? 'Available' : 'Empty'}
                </span>
              </div>
              <p className="text-xs text-[#71717A] font-mono mt-0.5">
                {detail?.section === 'UPPER' ? 'Upper Section (Row ' + detail?.row_idx + ', Col ' + detail?.col_idx + ')' : 'Lower Section (Row ' + detail?.row_idx + ', Col ' + detail?.col_idx + ')'} • {detail?.dimensions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintQrForDrawer(drawerId)}
              className="p-1.5 rounded-lg border-2 border-[#18181B] hover:bg-[#F4F4F5] text-[#18181B]"
              title="Print QR Sticker"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
            >
              <X className="w-4 h-4 text-[#18181B]" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-4 border-b border-[#E4E4E7] pb-2 text-xs">
          {(['CONTENTS', 'REMOVE', 'TRANSFER', 'QR'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setActionError(null);
                setActionSuccess(null);
              }}
              className={`px-3 py-1.5 font-bold rounded-lg border-2 border-[#18181B] transition-all ${
                activeTab === tab
                  ? 'bg-[#18181B] text-white shadow-[2px_2px_0px_#18181B]'
                  : 'bg-white text-[#18181B] hover:bg-[#F4F4F5]'
              }`}
            >
              {tab === 'CONTENTS' && 'Contents & Available'}
              {tab === 'REMOVE' && 'Remove'}
              {tab === 'TRANSFER' && 'Move'}
              {tab === 'QR' && 'Compartment QR'}
            </button>
          ))}
        </div>

        {/* Alerts */}
        {actionError && (
          <div className="mb-4 p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#B91C1C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="mb-4 p-3 bg-[#DCFCE7] border-2 border-[#15803D] rounded-xl text-xs font-bold text-[#15803D] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> {actionSuccess}
          </div>
        )}

        {/* TAB 1: CONTENTS */}
        {activeTab === 'CONTENTS' && (
          <div className="space-y-4">
            {detail?.items && detail.items.length > 0 ? (
              <div className="space-y-3">
                {detail.items.map((it) => (
                  <div
                    key={it.sku}
                    className="p-4 rounded-xl border-2 border-[#18181B] bg-[#FAFAFA] flex items-center justify-between shadow-[2px_2px_0px_#18181B]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-[#18181B]">{it.sku}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#FEF08A] border border-[#18181B] font-bold">
                          {it.category}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#52525B] mt-1">{it.name}</div>
                      <div className="text-[11px] text-[#15803D] font-bold font-mono mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Available: {it.quantity} {it.unit}
                      </div>
                    </div>
                    
                    {/* Quick Remove Button right on item card */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setRemoveSku(it.sku);
                          setActiveTab('REMOVE');
                        }}
                        className="brutal-btn brutal-btn-yellow text-xs py-1.5 px-3"
                      >
                        <Minus className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-[#A1A1AA] rounded-xl">
                <Box className="w-8 h-8 text-[#A1A1AA] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#52525B]">This compartment is empty.</p>
                <p className="text-xs text-[#71717A] mt-1">
                  Ready to store components.
                </p>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-[#E4E4E7]">
              <button
                onClick={() => {
                  onClose();
                  onOpenReceiveForDrawer(drawerId);
                }}
                className="brutal-btn brutal-btn-mint text-xs py-2 px-4"
              >
                <Plus className="w-4 h-4" /> Add Component into {drawerId}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REMOVE */}
        {activeTab === 'REMOVE' && (
          <form onSubmit={handleRemoveStock} className="space-y-4">
            {detail?.items && detail.items.length > 0 ? (
              <>
                <div>
                  <label className="block text-xs font-black text-[#18181B] mb-1">SELECT COMPONENT TO REMOVE</label>
                  <select
                    value={removeSku}
                    onChange={(e) => setRemoveSku(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-[#18181B] font-mono font-bold text-xs bg-white focus:outline-none"
                  >
                    {detail.items.map((it) => (
                      <option key={it.sku} value={it.sku}>
                        {it.sku} (Available: {it.quantity} {it.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-[#18181B] mb-1">QUANTITY TO REMOVE</label>
                    <input
                      type="number"
                      min={1}
                      max={detail.items.find((i) => i.sku === removeSku)?.quantity || 1}
                      value={removeQty}
                      onChange={(e) => setRemoveQty(parseInt(e.target.value) || 1)}
                      className="w-full p-2.5 rounded-lg border-2 border-[#18181B] font-mono font-bold text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-[#18181B] mb-1">REMOVED BY</label>
                    <input
                      type="text"
                      value={userName}
                      disabled
                      className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-[#F4F4F5]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-[#18181B] mb-1">REASON / PROJECT (OPTIONAL)</label>
                  <input
                    type="text"
                    placeholder="e.g. Lab testing or circuit build"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-semibold"
                  />
                </div>

                <button type="submit" className="w-full brutal-btn brutal-btn-yellow py-2.5 text-xs">
                  <Minus className="w-4 h-4" /> Confirm & Remove
                </button>
              </>
            ) : (
              <p className="text-xs text-[#71717A] italic">No items inside this compartment to remove.</p>
            )}
          </form>
        )}

        {/* TAB 3: TRANSFER */}
        {activeTab === 'TRANSFER' && (
          <form onSubmit={handleTransfer} className="space-y-4">
            {detail?.items && detail.items.length > 0 ? (
              <>
                <div>
                  <label className="block text-xs font-black text-[#18181B] mb-1">SELECT COMPONENT TO MOVE</label>
                  <select
                    value={transferSku}
                    onChange={(e) => setTransferSku(e.target.value)}
                    className="w-full p-2.5 rounded-lg border-2 border-[#18181B] font-mono font-bold text-xs bg-white focus:outline-none"
                  >
                    {detail.items.map((it) => (
                      <option key={it.sku} value={it.sku}>
                        {it.sku} (Available: {it.quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-[#18181B] mb-1">QUANTITY TO MOVE</label>
                    <input
                      type="number"
                      min={1}
                      max={detail.items.find((i) => i.sku === transferSku)?.quantity || 1}
                      value={transferQty}
                      onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                      className="w-full p-2.5 rounded-lg border-2 border-[#18181B] font-mono font-bold text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-[#18181B] mb-1">DESTINATION DRAWER</label>
                    <input
                      type="text"
                      placeholder="e.g. S15 or L04"
                      value={targetDrawer}
                      onChange={(e) => setTargetDrawer(e.target.value.toUpperCase())}
                      className="w-full p-2.5 rounded-lg border-2 border-[#18181B] font-mono font-bold text-xs uppercase"
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="w-full brutal-btn brutal-btn-mint py-2.5 text-xs">
                  <ArrowRightLeft className="w-4 h-4" /> Move to Drawer {targetDrawer}
                </button>
              </>
            ) : (
              <p className="text-xs text-[#71717A] italic">No items inside this compartment to move.</p>
            )}
          </form>
        )}

        {/* TAB 4: QR CODE */}
        {activeTab === 'QR' && (
          <div className="p-6 text-center border-2 border-[#18181B] rounded-xl bg-[#FAFAFA] space-y-3">
            <h4 className="font-mono font-black text-sm text-[#18181B]">DRAWER:{drawerId}</h4>
            <div className="p-3 bg-white inline-block border-2 border-[#18181B] rounded-xl shadow-[3px_3px_0px_#18181B]">
              <img
                src={`http://localhost:8000/api/qr/code?code=DRAWER:${drawerId}`}
                alt={`QR code for Drawer ${drawerId}`}
                className="w-36 h-36 mx-auto object-contain"
              />
            </div>
            <p className="text-xs text-[#52525B] font-semibold">
              Stick this QR code on the Stanley compartment handle. Scanning it from your phone immediately opens this drawer.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
