import React, { useState, useEffect } from 'react';
import { DrawerDetail } from '../../types/inventory';
import { fetchDrawerDetail, consumeStock, transferStock, fetchQrCode } from '../../api/client';
import { X, Plus, Minus, ArrowRightLeft, QrCode, ShieldCheck, AlertCircle } from 'lucide-react';

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
  const [qrDataUri, setQrDataUri] = useState<string | null>(null);

  useEffect(() => {
    if (drawerId) {
      loadDrawer(drawerId);
      setQrDataUri(null);
    }
  }, [drawerId]);

  useEffect(() => {
    if (drawerId && activeTab === 'QR' && !qrDataUri) {
      fetchQrCode(`DRAWER:${drawerId}`)
        .then((res) => setQrDataUri(res.data_uri))
        .catch((err) => console.warn('Failed to load QR:', err));
    }
  }, [drawerId, activeTab, qrDataUri]);

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
                        <span className="font-mono font-black text-sm text-[#18181B]">
                          {it.sku}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#71717A] bg-white px-2 py-0.5 rounded border border-[#E4E4E7]">
                          {it.category}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#18181B] mt-1">
                        {it.name}
                      </div>
                      <div className="text-[11px] text-[#71717A] font-mono mt-0.5">
                        Tray: {it.sub_tray} • Unit Cost: ₹{it.unit_cost.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase text-[#71717A]">
                        Available
                      </div>
                      <div className="text-xl font-black font-mono text-[#15803D]">
                        {it.quantity} <span className="text-xs font-sans text-[#71717A]">{it.unit}</span>
                      </div>
                      <button
                        onClick={() => {
                          setRemoveSku(it.sku);
                          setActiveTab('REMOVE');
                        }}
                        className="mt-2 text-xs font-bold px-2.5 py-1 rounded-lg border border-[#18181B] bg-[#FCA5A5] hover:bg-[#F87171] text-[#7F1D1D] shadow-[1px_1px_0px_#18181B]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-[#71717A] font-semibold border-2 border-dashed border-[#D4D4D8] rounded-xl">
                This compartment is currently empty.
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenReceiveForDrawer(drawerId);
                }}
                className="w-full brutal-btn brutal-btn-mint text-xs py-2.5"
              >
                <Plus className="w-4 h-4" /> + Put Item In Compartment {drawerId}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REMOVE */}
        {activeTab === 'REMOVE' && (
          <form onSubmit={handleRemoveStock} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">
                SELECT COMPONENT TO DEDUCT *
              </label>
              <select
                value={removeSku}
                onChange={(e) => setRemoveSku(e.target.value)}
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-[#FAFAFA]"
                required
              >
                {detail?.items.map((it) => (
                  <option key={it.sku} value={it.sku}>
                    {it.sku} - {it.name} ({it.quantity} available)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#18181B] mb-1">
                  QUANTITY TO REMOVE *
                </label>
                <input
                  type="number"
                  min={1}
                  value={removeQty}
                  onChange={(e) => setRemoveQty(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-black bg-[#FAFAFA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#18181B] mb-1">
                  AUTHORIZED USER
                </label>
                <input
                  type="text"
                  value={userName}
                  disabled
                  className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-[#F4F4F5]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">
                REASON / PROJECT / WORK ORDER
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. IoT Sensor Assembly Lab / Hall Repair"
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-semibold bg-[#FAFAFA]"
              />
            </div>

            <button
              type="submit"
              className="w-full brutal-btn brutal-btn-coral text-xs py-2.5 mt-2"
            >
              <Minus className="w-4 h-4" /> Confirm Stock Removal
            </button>
          </form>
        )}

        {/* TAB 3: TRANSFER */}
        {activeTab === 'TRANSFER' && (
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">
                SELECT COMPONENT TO MOVE *
              </label>
              <select
                value={transferSku}
                onChange={(e) => setTransferSku(e.target.value)}
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-[#FAFAFA]"
                required
              >
                {detail?.items.map((it) => (
                  <option key={it.sku} value={it.sku}>
                    {it.sku} ({it.quantity} available)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-black text-[#18181B] mb-1">
                  TARGET DRAWER *
                </label>
                <input
                  type="text"
                  value={targetDrawer}
                  onChange={(e) => setTargetDrawer(e.target.value.toUpperCase())}
                  placeholder="e.g. S12 or L02"
                  className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-black bg-[#FAFAFA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-[#18181B] mb-1">
                  QUANTITY *
                </label>
                <input
                  type="number"
                  min={1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-black bg-[#FAFAFA]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full brutal-btn brutal-btn-yellow text-xs py-2.5 mt-2"
            >
              <ArrowRightLeft className="w-4 h-4" /> Move Stock to Compartment {targetDrawer}
            </button>
          </form>
        )}

        {/* TAB 4: QR CODE */}
        {activeTab === 'QR' && (
          <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
            <div className="p-4 bg-white border-4 border-[#18181B] rounded-2xl shadow-[4px_4px_0px_#18181B]">
              <div className="w-52 h-52 flex items-center justify-center bg-white border-2 border-[#18181B] rounded-xl p-2">
                {qrDataUri ? (
                  <img
                    src={qrDataUri}
                    alt={`Scannable QR for Compartment ${drawerId}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs font-mono font-bold text-[#71717A] animate-pulse">
                    Generating live QR code...
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-mono font-black text-lg text-[#18181B] tracking-wide">
                DRAWER:{drawerId}
              </div>
              <div className="text-xs text-[#71717A] font-semibold mt-0.5">
                Scan with phone camera to open or stock this compartment
              </div>
            </div>

            <button
              onClick={() => onPrintQrForDrawer(drawerId)}
              className="brutal-btn brutal-btn-yellow text-xs py-2 px-6"
            >
              <QrCode className="w-4 h-4" /> Print Compartment QR Sticker
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
