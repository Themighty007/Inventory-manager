import React, { useEffect, useState } from 'react';
import { DrawerDetail } from '../../types/inventory';
import {
  fetchDrawerDetail,
  consumeStock,
  transferStock,
  fetchQrCode,
} from '../../api/client';
import {
  X,
  Plus,
  Minus,
  ArrowRightLeft,
  QrCode,
  ShieldCheck,
  AlertCircle,
  Package,
} from 'lucide-react';

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
  const [activeTab, setActiveTab] = useState<'CONTENTS' | 'REMOVE' | 'TRANSFER' | 'QR'>('CONTENTS');

  // Action Form States
  const [removeSku, setRemoveSku] = useState('');
  const [removeQty, setRemoveQty] = useState(1);
  const [reason, setReason] = useState('');

  const [transferSku, setTransferSku] = useState('');
  const [transferQty, setTransferQty] = useState(1);
  const [targetDrawer, setTargetDrawer] = useState('');

  const [qrDataUri, setQrDataUri] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (drawerId) {
      loadDrawerDetail(drawerId);
      loadDrawerQr(drawerId);
      setActiveTab('CONTENTS');
      setActionError(null);
      setActionSuccess(null);
    }
  }, [drawerId]);

  const loadDrawerDetail = async (id: string) => {
    try {
      const data = await fetchDrawerDetail(id);
      setDetail(data);
      if (data.items.length > 0) {
        setRemoveSku(data.items[0].sku);
        setTransferSku(data.items[0].sku);
      }
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const loadDrawerQr = async (id: string) => {
    try {
      const res = await fetchQrCode(`DRAWER:${id}`);
      setQrDataUri(res.data_uri);
    } catch (err) {
      console.warn('Failed to load QR code for drawer:', err);
    }
  };

  const handleRemoveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerId || !removeSku) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await consumeStock({
        sku: removeSku,
        item_sku: removeSku,
        quantity: removeQty,
        drawer_id: drawerId,
        requester: userName,
        user_name: userName,
        notes: reason || 'Lab Consumption',
      });
      setActionSuccess(`Successfully deducted ${removeQty} units from ${drawerId}`);
      onRefresh();
      loadDrawerDetail(drawerId);
      setTimeout(() => setActiveTab('CONTENTS'), 1200);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drawerId || !transferSku || !targetDrawer) return;
    setActionError(null);
    setActionSuccess(null);

    try {
      await transferStock({
        sku: transferSku,
        item_sku: transferSku,
        quantity: transferQty,
        from_drawer_id: drawerId,
        source_drawer_id: drawerId,
        to_drawer_id: targetDrawer.toUpperCase().trim(),
        target_drawer_id: targetDrawer.toUpperCase().trim(),
        notes: 'Compartment Reallocation',
      });
      setActionSuccess(`Successfully moved ${transferQty} units from ${drawerId} to ${targetDrawer}`);
      onRefresh();
      loadDrawerDetail(drawerId);
      setTimeout(() => setActiveTab('CONTENTS'), 1200);
    } catch (err: any) {
      setActionError(err.message);
    }
  };

  if (!drawerId) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="skr-card bg-white w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0B132B] text-white flex flex-col items-center justify-center font-mono font-bold border border-slate-800 shadow-sm">
              <span className="text-base text-[#00B4D8]">{drawerId}</span>
              <span className="text-[9px] text-slate-400 uppercase font-sans">
                {detail?.drawer_type === 'SMALL' ? 'Small' : 'Large'}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-display font-bold text-[#0B132B]">Compartment {drawerId}</h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${detail?.is_occupied ? 'bg-[#2EC4B6]/15 text-[#0E7490]' : 'bg-slate-100 text-slate-600'}`}>
                  {detail?.is_occupied ? 'Available' : 'Empty'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {detail?.section === 'UPPER' ? 'Upper Section (Row ' + detail?.row_idx + ', Col ' + detail?.col_idx + ')' : 'Lower Section (Row ' + detail?.row_idx + ', Col ' + detail?.col_idx + ')'} • {detail?.dimensions}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrintQrForDrawer(drawerId)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition-all"
              title="Print QR Sticker"
            >
              <QrCode className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2 text-xs">
          {(['CONTENTS', 'REMOVE', 'TRANSFER', 'QR'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setActionError(null);
                setActionSuccess(null);
              }}
              className={`px-3 py-1.5 font-semibold rounded-lg transition-all ${
                activeTab === tab
                  ? 'bg-[#0B132B] text-[#00B4D8] border border-[#00B4D8]/30 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
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
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="mb-4 p-3 bg-[#2EC4B6]/15 border border-[#2EC4B6]/30 rounded-xl text-xs font-semibold text-[#0E7490] flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" /> {actionSuccess}
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
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-[#0B132B]">
                          {it.sku}
                        </span>
                        <span className="text-[10px] uppercase font-bold text-[#00B4D8] bg-white px-2 py-0.5 rounded border border-slate-200">
                          {it.category}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[#1E293B] mt-1">
                        {it.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Tray: {it.sub_tray} • Unit Cost: ₹{it.unit_cost.toLocaleString('en-IN')}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-bold uppercase text-slate-400">
                        Available
                      </div>
                      <div className="text-xl font-bold font-mono text-[#2EC4B6]">
                        {it.quantity} <span className="text-xs font-sans text-slate-500">{it.unit}</span>
                      </div>
                      <button
                        onClick={() => {
                          setRemoveSku(it.sku);
                          setActiveTab('REMOVE');
                        }}
                        className="mt-2 text-xs font-semibold px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500 font-medium border border-dashed border-slate-300 rounded-xl">
                This compartment is currently empty.
              </div>
            )}

            <div className="pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenReceiveForDrawer(drawerId);
                }}
                className="w-full btn-cyan text-xs py-2.5 font-semibold rounded-xl flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Item To Compartment {drawerId}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: REMOVE */}
        {activeTab === 'REMOVE' && (
          <form onSubmit={handleRemoveStock} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                Select Component To Deduct *
              </label>
              <select
                value={removeSku}
                onChange={(e) => setRemoveSku(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50 focus:border-[#00B4D8]"
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
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Quantity To Remove *
                </label>
                <input
                  type="number"
                  min={1}
                  value={removeQty}
                  onChange={(e) => setRemoveQty(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-[#00B4D8]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Authorized Signature
                </label>
                <input
                  type="text"
                  value={userName}
                  disabled
                  className="w-full p-2.5 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-100 text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                Reason / Project / Work Order
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. PCB Prototype Assembly"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:border-[#00B4D8]"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-all flex items-center justify-center gap-2 mt-2"
            >
              <Minus className="w-4 h-4" /> Confirm Stock Removal
            </button>
          </form>
        )}

        {/* TAB 3: TRANSFER */}
        {activeTab === 'TRANSFER' && (
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                Select Component To Move *
              </label>
              <select
                value={transferSku}
                onChange={(e) => setTransferSku(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50 focus:border-[#00B4D8]"
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
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Target Drawer *
                </label>
                <input
                  type="text"
                  value={targetDrawer}
                  onChange={(e) => setTargetDrawer(e.target.value.toUpperCase())}
                  placeholder="e.g. S12 or L02"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-[#00B4D8]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">
                  Quantity *
                </label>
                <input
                  type="number"
                  min={1}
                  value={transferQty}
                  onChange={(e) => setTransferQty(parseInt(e.target.value) || 1)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-[#00B4D8]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn-teal text-xs py-2.5 font-semibold rounded-xl flex items-center justify-center gap-2 mt-2"
            >
              <ArrowRightLeft className="w-4 h-4" /> Move Stock to Compartment {targetDrawer}
            </button>
          </form>
        )}

        {/* TAB 4: QR CODE */}
        {activeTab === 'QR' && (
          <div className="flex flex-col items-center justify-center p-6 space-y-4 text-center">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
              <div className="w-52 h-52 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl p-2">
                {qrDataUri ? (
                  <img
                    src={qrDataUri}
                    alt={`Scannable QR for Compartment ${drawerId}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs font-mono font-bold text-slate-400 animate-pulse">
                    Generating live QR code...
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="font-mono font-bold text-lg text-[#0B132B] tracking-wide">
                DRAWER:{drawerId}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                Scan with phone camera to open or stock this compartment
              </div>
            </div>

            <button
              onClick={() => onPrintQrForDrawer(drawerId)}
              className="btn-cyan text-xs py-2 px-6 font-semibold rounded-lg flex items-center gap-2"
            >
              <QrCode className="w-4 h-4" /> Print Compartment QR Sticker
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
