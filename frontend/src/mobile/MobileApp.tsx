import React, { useState, useEffect } from 'react';
import { DrawerSummary, ItemResponse } from '../types/inventory';
import { fetchDrawers, fetchItems, receiveStock, consumeStock } from '../api/client';
import {
  QrCode,
  Layers,
  MinusCircle,
  RefreshCw,
  Camera,
  CheckCircle,
  Wifi,
  WifiOff,
  Barcode,
  Package,
  ArrowRight,
  Database,
} from 'lucide-react';

interface MobileAppProps {
  onDataChanged?: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onDataChanged }) => {
  const [activeTab, setActiveTab] = useState<'INTAKE' | 'CABINET' | 'DEDUCT' | 'SYNC'>('INTAKE');
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('inventory_mobile_offline_queue');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [drawers, setDrawers] = useState<DrawerSummary[]>([]);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [loading, setLoading] = useState(false);

  // Intake Form State
  const [scannedCode, setScannedCode] = useState('');
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Microcontrollers');
  const [quantity, setQuantity] = useState(5);
  const [drawerId, setDrawerId] = useState('S12');
  const [supplier, setSupplier] = useState('Mouser Electronics');
  const [invoice, setInvoice] = useState('INV-2026-');
  const [unitPrice, setUnitPrice] = useState(250);

  // Status message
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Quick Deduct State
  const [deductDrawer, setDeductDrawer] = useState('S12');
  const [deductSku, setDeductSku] = useState('ESP32-DEV-01');
  const [deductQty, setDeductQty] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem('inventory_mobile_offline_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [d, it] = await Promise.all([fetchDrawers(), fetchItems()]);
      setDrawers(d);
      setItems(it);
      setIsOnline(true);
    } catch (err) {
      setIsOnline(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateScan = () => {
    const samples = [
      { code: 'TRACK-ESP32-901', sku: 'ESP32-WROOM-32D', name: 'ESP32 WiFi+BLE Module', cat: 'Microcontrollers', drawer: 'S12', price: 240 },
      { code: 'DRAWER:S04', sku: 'MCB-63A-3P', name: 'Triple Pole 63A MCB', cat: 'Electrical', drawer: 'S04', price: 1450 },
      { code: 'TRACK-NANO-441', sku: 'ARD-NANO-01', name: 'Arduino Nano V3', cat: 'Microcontrollers', drawer: 'S01', price: 180 },
    ];
    const picked = samples[Math.floor(Math.random() * samples.length)];
    setScannedCode(picked.code);
    setSku(picked.sku);
    setName(picked.name);
    setCategory(picked.cat);
    setDrawerId(picked.drawer);
    setUnitPrice(picked.price);
    setInvoice(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleIntakeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      tracking_code: scannedCode || undefined,
      item_sku: sku.trim().toUpperCase(),
      item_name: name.trim() || undefined,
      category,
      quantity,
      supplier,
      invoice_number: invoice || undefined,
      unit_price: unitPrice,
      drawer_id: drawerId.toUpperCase(),
      notes: 'Registered via Android mobile terminal',
    };

    if (isOnline) {
      try {
        setLoading(true);
        const res = await receiveStock(payload);
        setFeedback({ type: 'success', msg: `Saved! ${res.message}` });
        loadData();
        onDataChanged?.();
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err.message });
      } finally {
        setLoading(false);
      }
    } else {
      // Offline queue
      const op = {
        client_op_id: `mob-op-${Date.now()}`,
        action: 'RECEIVE',
        payload,
        queued_at: new Date().toLocaleTimeString(),
      };
      setOfflineQueue((prev) => [...prev, op]);
      setFeedback({ type: 'success', msg: 'Offline Mode: Stored in phone queue. Will sync when Wi-Fi connects.' });
    }
  };

  const handleQuickDeduct = async () => {
    const payload = {
      sku: deductSku,
      drawer_id: deductDrawer,
      quantity: deductQty,
      requester: 'Mobile Tech',
      notes: 'Quick barcode deduction from Android phone',
    };

    if (isOnline) {
      try {
        setLoading(true);
        const res = await consumeStock(payload);
        setFeedback({ type: 'success', msg: res.message });
        loadData();
        onDataChanged?.();
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err.message });
      } finally {
        setLoading(false);
      }
    } else {
      const op = {
        client_op_id: `mob-op-${Date.now()}`,
        action: 'CONSUME',
        payload,
        queued_at: new Date().toLocaleTimeString(),
      };
      setOfflineQueue((prev) => [...prev, op]);
      setFeedback({ type: 'success', msg: 'Offline Mode: Consumption queued in local cache.' });
    }
  };

  const handleSyncQueue = async () => {
    if (offlineQueue.length === 0) return;
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/api/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations: offlineQueue }),
      });
      const data = await res.json();
      setFeedback({ type: 'success', msg: `Synced ${data.synced_count} queued operations to Windows Master DB!` });
      setOfflineQueue([]);
      loadData();
      onDataChanged?.();
    } catch (err: any) {
      setFeedback({ type: 'error', msg: `Sync failed: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full bg-[#F8F6F1] flex flex-col font-sans select-none text-[#18181B] overflow-hidden">
      {/* Mobile Top Header */}
      <div className="bg-[#121316] text-white p-3 border-b-2 border-[#18181B] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#FEF08A] text-[#18181B] font-bold text-xs flex items-center justify-center">
            A
          </div>
          <div>
            <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
              <span>aegis '26</span>
              <span className="text-[10px] text-[#86EFAC] font-mono">MOBILE INTAKE</span>
            </div>
            <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1 font-mono">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-[#86EFAC]" /> Connected (FastAPI :8000)
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-[#FCA5A5]" /> Offline (Cache Active)
                </>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          className="p-1.5 rounded-lg border border-[#3F3F46] bg-[#27272A] hover:bg-[#3F3F46]"
          title="Refresh from Windows master"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-white ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-2.5 text-[11px] font-bold border-b-2 border-[#18181B] flex items-center justify-between ${
            feedback.type === 'success' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
          }`}
        >
          <span>{feedback.msg}</span>
          <button onClick={() => setFeedback(null)} className="font-mono text-xs px-1">
            ✕
          </button>
        </div>
      )}

      {/* Main Mobile Screen Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* VIEW 1: PARCEL INTAKE WIZARD */}
        {activeTab === 'INTAKE' && (
          <form onSubmit={handleIntakeSubmit} className="space-y-3">
            {/* Viewfinder Camera Simulation */}
            <div className="border-2 border-[#18181B] rounded-xl bg-[#18181B] text-white p-3 relative overflow-hidden text-center shadow-[3px_3px_0px_#18181B]">
              <div className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-mono mb-2 flex items-center justify-center gap-1">
                <Camera className="w-3.5 h-3.5 text-[#86EFAC]" /> CAMERA BARCODE SCANNER
              </div>
              <div className="w-48 h-20 mx-auto border-2 border-dashed border-[#86EFAC] rounded-lg flex flex-col items-center justify-center relative">
                <div className="w-full h-0.5 bg-[#86EFAC] absolute animate-pulse" />
                <Barcode className="w-10 h-10 text-white/50" />
                <span className="text-[10px] font-mono text-[#86EFAC] mt-1">
                  {scannedCode || 'Align Barcode / QR'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSimulateScan}
                className="mt-2.5 brutal-btn brutal-btn-mint text-[11px] py-1 px-3 w-full"
              >
                Scan Parcel Barcode
              </button>
            </div>

            {/* Inputs */}
            <div className="space-y-2.5 bg-white p-3.5 rounded-xl border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-[#18181B]">PART SKU *</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    placeholder="e.g. ESP32-DEV-01"
                    className="w-full p-2 text-xs font-mono font-bold border-2 border-[#18181B] rounded-lg"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#18181B]">QUANTITY *</label>
                  <input
                    type="number"
                    min={1}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="w-full p-2 text-xs font-mono font-black border-2 border-[#18181B] rounded-lg"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-[#18181B]">DESCRIPTION</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. WiFi Dev Board"
                  className="w-full p-2 text-xs font-semibold border-2 border-[#18181B] rounded-lg"
                />
              </div>

              {/* Graphical Stanley Drawer Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-black text-[#18181B]">SELECT STANLEY DRAWER *</label>
                  <span className="text-[10px] font-mono font-bold bg-[#FEF08A] px-1.5 rounded border border-[#18181B]">
                    Assigned: {drawerId}
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1 max-h-28 overflow-y-auto p-1 bg-[#FAFAFA] border-2 border-[#18181B] rounded-lg">
                  {drawers.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => setDrawerId(d.id)}
                      className={`text-[10px] font-mono font-black p-1 rounded border ${
                        drawerId === d.id
                          ? 'bg-[#18181B] text-white border-[#18181B]'
                          : d.is_occupied
                          ? 'bg-[#FEF08A] text-[#18181B] border-[#18181B]'
                          : 'bg-white text-[#71717A] border-[#D4D4D8]'
                      }`}
                    >
                      {d.id}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black text-[#18181B]">INVOICE #</label>
                  <input
                    type="text"
                    value={invoice}
                    onChange={(e) => setInvoice(e.target.value)}
                    className="w-full p-2 text-xs font-mono border-2 border-[#18181B] rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-[#18181B]">UNIT PRICE (₹)</label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full p-2 text-xs font-mono font-bold border-2 border-[#18181B] rounded-lg"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full brutal-btn brutal-btn-yellow py-2.5 text-xs mt-2"
              >
                <CheckCircle className="w-4 h-4" />
                {loading ? 'Submitting...' : `Register to Drawer ${drawerId}`}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 2: STANLEY CABINET MOBILE BROWSE */}
        {activeTab === 'CABINET' && (
          <div className="space-y-3">
            <div className="text-xs font-black uppercase tracking-wider text-[#52525B]">
              39 Compartments Visual Layout
            </div>

            <div className="grid grid-cols-3 gap-2">
              {drawers.map((d) => (
                <div
                  key={d.id}
                  onClick={() => {
                    setDrawerId(d.id);
                    setDeductDrawer(d.id);
                    if (d.items_preview.length > 0) {
                      setDeductSku(d.items_preview[0].split(' ')[0]);
                    }
                    setActiveTab('DEDUCT');
                  }}
                  className={`p-2 rounded-xl border-2 border-[#18181B] bg-white cursor-pointer shadow-[2px_2px_0px_#18181B] flex flex-col justify-between ${
                    d.is_occupied ? 'border-l-4 border-l-[#FEF08A]' : 'border-l-4 border-l-[#A1A1AA]'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono font-bold text-xs">
                    <span>{d.id}</span>
                    <span className="text-[9px] uppercase text-[#71717A]">{d.drawer_type}</span>
                  </div>
                  <div className="text-[11px] font-semibold text-[#18181B] truncate mt-1">
                    {d.is_occupied ? `${d.total_units} units` : 'Empty'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VIEW 3: QUICK DEDUCT */}
        {activeTab === 'DEDUCT' && (
          <div className="p-4 bg-white rounded-xl border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] space-y-3">
            <h3 className="text-xs font-black uppercase text-[#18181B] flex items-center gap-1.5">
              <MinusCircle className="w-4 h-4 text-[#B91C1C]" /> Quick Stock Deduction
            </h3>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-black text-[#18181B]">DRAWER</label>
                <input
                  type="text"
                  value={deductDrawer}
                  onChange={(e) => setDeductDrawer(e.target.value.toUpperCase())}
                  className="w-full p-2 text-xs font-mono font-bold border-2 border-[#18181B] rounded-lg"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-[#18181B]">QTY TO CONSUME</label>
                <input
                  type="number"
                  min={1}
                  value={deductQty}
                  onChange={(e) => setDeductQty(parseInt(e.target.value) || 1)}
                  className="w-full p-2 text-xs font-mono font-black border-2 border-[#18181B] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-[#18181B]">PART SKU</label>
              <input
                type="text"
                value={deductSku}
                onChange={(e) => setDeductSku(e.target.value.toUpperCase())}
                className="w-full p-2 text-xs font-mono font-bold border-2 border-[#18181B] rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={handleQuickDeduct}
              disabled={loading}
              className="w-full brutal-btn brutal-btn-mint py-2.5 text-xs"
            >
              Confirm Deduction
            </button>
          </div>
        )}

        {/* VIEW 4: SYNC QUEUE */}
        {activeTab === 'SYNC' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-black">
              <span>OFFLINE QUEUE ({offlineQueue.length} PENDING)</span>
              {offlineQueue.length > 0 && (
                <button
                  onClick={handleSyncQueue}
                  disabled={loading || !isOnline}
                  className="brutal-btn brutal-btn-mint text-[11px] py-1 px-3"
                >
                  Sync to Master DB
                </button>
              )}
            </div>

            {offlineQueue.length > 0 ? (
              <div className="space-y-2">
                {offlineQueue.map((op, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border-2 border-[#18181B] text-xs font-mono space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-[#B91C1C]">{op.action}</span>
                      <span className="text-[#71717A] text-[10px]">{op.queued_at}</span>
                    </div>
                    <div className="text-[11px] text-[#18181B]">
                      {op.payload.item_sku || op.payload.sku} → Drawer {op.payload.drawer_id} ({op.payload.quantity} units)
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border-2 border-dashed border-[#A1A1AA] rounded-xl text-xs text-[#71717A] font-semibold">
                All phone transactions synchronized. Local cache is clean.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="bg-white border-t-2 border-[#18181B] p-2 flex items-center justify-around text-[10px] font-bold">
        <button
          onClick={() => setActiveTab('INTAKE')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg ${
            activeTab === 'INTAKE' ? 'text-[#064E3B] bg-[#86EFAC]' : 'text-[#71717A]'
          }`}
        >
          <Camera className="w-4 h-4" /> Intake
        </button>
        <button
          onClick={() => setActiveTab('CABINET')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg ${
            activeTab === 'CABINET' ? 'text-[#713F12] bg-[#FEF08A]' : 'text-[#71717A]'
          }`}
        >
          <Layers className="w-4 h-4" /> Cabinet
        </button>
        <button
          onClick={() => setActiveTab('DEDUCT')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg ${
            activeTab === 'DEDUCT' ? 'text-[#7F1D1D] bg-[#FCA5A5]' : 'text-[#71717A]'
          }`}
        >
          <MinusCircle className="w-4 h-4" /> Deduct
        </button>
        <button
          onClick={() => setActiveTab('SYNC')}
          className={`flex flex-col items-center gap-1 p-1.5 rounded-lg relative ${
            activeTab === 'SYNC' ? 'text-[#1E3A8A] bg-[#93C5FD]' : 'text-[#71717A]'
          }`}
        >
          <Database className="w-4 h-4" /> Queue
          {offlineQueue.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-[#B91C1C] absolute top-1 right-1" />
          )}
        </button>
      </div>
    </div>
  );
};
