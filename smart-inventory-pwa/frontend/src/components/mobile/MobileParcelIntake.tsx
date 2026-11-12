import React, { useState, useEffect } from 'react';
import { DrawerSummary } from '../../types/inventory';
import { receiveStock } from '../../api/client';
import { enqueueOperation } from '../../db/offlineDb';
import {
  CheckCircle,
  Barcode,
  Package,
  Layers,
  ArrowLeft,
  AlertCircle,
  Clock,
  FileText,
  Calendar,
} from 'lucide-react';

interface MobileParcelIntakeProps {
  initialCode?: string;
  drawers: DrawerSummary[];
  isOnline: boolean;
  userName: string;
  onCompleted: (message: string) => void;
  onBack: () => void;
  onSwitchToInvoice?: () => void;
}

const getLocalDateTimeString = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
};

export const MobileParcelIntake: React.FC<MobileParcelIntakeProps> = ({
  initialCode = '',
  drawers,
  isOnline,
  userName,
  onCompleted,
  onBack,
  onSwitchToInvoice,
}) => {
  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [unitPrice, setUnitPrice] = useState<number | string>('');
  const [drawerId, setDrawerId] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState(getLocalDateTimeString());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialCode) return;
    const raw = initialCode.trim();

    // 1. JSON payload check
    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const obj = JSON.parse(raw);
        if (obj.sku || obj.item_sku || obj.partNumber) {
          setSku(String(obj.sku || obj.item_sku || obj.partNumber).toUpperCase());
        }
        if (obj.name || obj.item_name || obj.description) {
          setName(String(obj.name || obj.item_name || obj.description));
        }
        if (obj.quantity || obj.qty) {
          setQuantity(Number(obj.quantity || obj.qty) || 1);
        }
        if (obj.price || obj.unit_price) {
          setUnitPrice(Number(obj.price || obj.unit_price) || '');
        }
        if (obj.supplier || obj.vendor) {
          setSupplier(String(obj.supplier || obj.vendor));
        }
        if (obj.invoice || obj.invoice_number) {
          setInvoice(String(obj.invoice || obj.invoice_number));
        }
        if (obj.category) {
          setCategory(String(obj.category));
        }
        if (obj.drawer || obj.drawer_id) {
          const dId = String(obj.drawer || obj.drawer_id).toUpperCase();
          if (drawers.some((d) => d.id === dId)) {
            setDrawerId(dId);
          }
        }
        return;
      } catch {
        // Not JSON
      }
    }

    // 2. Drawer Code or Drawer in URL
    const urlDrawerMatch = raw.match(/(?:drawer[=\/:]|#|\b)([SL]\d{2})\b/i);
    if (urlDrawerMatch) {
      const candidate = urlDrawerMatch[1].toUpperCase();
      if (drawers.some((d) => d.id === candidate)) {
        setDrawerId(candidate);
        if (raw.match(/^(?:DRAWER:)?([SL]\d{2})$/i)) {
          return;
        }
      }
    }

    // 3. SKU prefix
    if (/^(?:ITEM|SKU):/i.test(raw)) {
      const parsedSku = raw.replace(/^(?:ITEM|SKU):/i, '').trim().toUpperCase();
      setSku(parsedSku);
      return;
    }

    // 4. Default fallback: use code as tracking code and default SKU
    setTrackingCode(raw);
    setSku(raw.toUpperCase());
  }, [initialCode, drawers]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      setErrorMsg('Component SKU is required.');
      return;
    }
    if (!drawerId) {
      setErrorMsg('Please tap a compartment below to assign where to store this item.');
      return;
    }

    const finalQty = typeof quantity === 'number' ? quantity : parseInt(quantity) || 1;
    const finalPrice = typeof unitPrice === 'number' ? unitPrice : parseFloat(unitPrice) || 0;

    setSubmitting(true);
    setErrorMsg(null);

    const payload = {
      tracking_code: trackingCode.trim() || undefined,
      item_sku: sku.trim().toUpperCase(),
      item_name: name.trim() || sku.trim().toUpperCase(),
      category,
      unit: 'pcs',
      quantity: finalQty,
      unit_price: finalPrice,
      supplier: supplier.trim() || undefined,
      invoice_number: invoice.trim() || undefined,
      drawer_id: drawerId.toUpperCase(),
      sub_tray: 'MAIN',
      order_date: orderDate ? `${orderDate}T00:00:00` : null,
      delivery_arrival_time: deliveryTime || getLocalDateTimeString(),
      notes: `Registered via mobile PWA by ${userName}. ${notes}`.trim(),
    };

    if (isOnline) {
      try {
        const res = await receiveStock(payload);
        onCompleted(`Confirmed: ${res.message}`);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to register component on master server.');
      } finally {
        setSubmitting(false);
      }
    } else {
      try {
        const queuedOp = await enqueueOperation('RECEIVE', payload);
        onCompleted(
          `Pending Sync: Stored in phone's IndexedDB queue (UUID: ${queuedOp.client_op_id.slice(0, 8)}...). Will commit to master when Wi-Fi connects.`
        );
      } catch (err: any) {
        setErrorMsg(`Failed to save offline: ${err.message}`);
      } finally {
        setSubmitting(false);
      }
    }
  };

  const categories = [
    'General',
    'Microcontrollers',
    'Passives',
    'Electrical',
    'Network',
    'HVAC',
    'Sensors',
    'Semiconductors',
    'Cables & Connectors',
    'Tools & Mechanical',
    'Hardware',
  ];

  const smallDrawers = Array.from({ length: 30 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
  const largeDrawers = Array.from({ length: 9 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`);

  return (
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-4 select-none text-slate-800 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#00B4D8] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Scanner
        </button>
        <span
          className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
            isOnline
              ? 'bg-[#2EC4B6]/10 text-[#2EC4B6] border-[#2EC4B6]/30'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          {isOnline ? 'Live Master Connected' : 'Offline Queue Mode'}
        </span>
      </div>

      {onSwitchToInvoice && (
        <button
          type="button"
          onClick={onSwitchToInvoice}
          className="mb-3 p-2.5 rounded-xl bg-[#00B4D8]/10 border border-[#00B4D8]/30 flex items-center justify-between gap-2 text-left hover:bg-[#00B4D8]/15 transition-colors"
        >
          <span className="text-[11px] font-semibold text-[#00B4D8]">
            Upload a PDF / Doc Invoice instead?
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-[#00B4D8] text-white text-[10px] font-semibold flex items-center gap-1 shrink-0">
            <FileText className="w-3 h-3" /> Auto-Extract →
          </span>
        </button>
      )}

      {/* Scanned Badge Banner */}
      {trackingCode && (
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00B4D8]/10 text-[#00B4D8] flex items-center justify-center font-bold">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono block">
                SCANNED CODE / IDENTIFIER
              </span>
              <span className="text-xs font-mono font-bold text-[#0B132B]">
                {trackingCode}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setTrackingCode('');
              setSku('');
            }}
            className="text-[10px] text-slate-400 hover:text-slate-600 underline"
          >
            Clear
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2 mb-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* COMPONENT INFORMATION */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Component Information
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                Part SKU *
              </label>
              <input
                type="text"
                placeholder="e.g. ESP32-WROOM-32"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                Quantity *
              </label>
              <input
                type="number"
                min="1"
                placeholder="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full p-2 text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
              Item Description
            </label>
            <input
              type="text"
              placeholder="e.g. Dual-Core Wi-Fi & BLE Microcontroller"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 text-xs font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50/50 focus:outline-none focus:border-[#00B4D8]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                Unit Price (₹)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 250"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full p-2 text-xs font-mono font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* STANLEY CABINET COMPARTMENT */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Stanley Cabinet Compartment *
            </span>
            {drawerId ? (
              <span className="font-mono text-[11px] font-bold bg-[#00B4D8]/10 text-[#00B4D8] px-2.5 py-0.5 rounded-full border border-[#00B4D8]/20">
                Selected: {drawerId}
              </span>
            ) : (
              <span className="text-[10px] text-amber-600 font-semibold animate-pulse">
                Select Compartment
              </span>
            )}
          </div>

          <p className="text-[11px] text-slate-500 font-medium">
            Tap any compartment to assign this parcel:
          </p>

          {/* Large Drawers L01-L09 */}
          <div className="grid grid-cols-6 gap-1">
            {largeDrawers.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setDrawerId(id)}
                className={`py-1.5 px-0.5 text-center font-mono text-[11px] font-bold rounded-lg border transition-all ${
                  drawerId === id
                    ? 'bg-[#00B4D8] text-white border-[#00B4D8] shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {id}
              </button>
            ))}
          </div>

          {/* Small Drawers S01-S30 */}
          <div className="grid grid-cols-6 gap-1 pt-1">
            {smallDrawers.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setDrawerId(id)}
                className={`py-1 px-0.5 text-center font-mono text-[10px] font-bold rounded-lg border transition-all ${
                  drawerId === id
                    ? 'bg-[#0B132B] text-[#00B4D8] border-[#0B132B] shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* PROCUREMENT & TRACKING DETAILS */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Procurement & Tracking Details
          </span>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                Supplier
              </label>
              <input
                type="text"
                placeholder="e.g. Mouser, Robu"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full p-2 text-xs font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-600 block mb-1">
                Invoice #
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-001"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                className="w-full p-2 text-xs font-mono font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 mb-1">
                <Calendar className="w-3 h-3 text-[#00B4D8]" /> Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full p-2 text-xs font-mono font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#00B4D8] bg-slate-50/50"
              />
            </div>
            <div>
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-600 mb-1">
                <Clock className="w-3 h-3 text-[#2EC4B6]" /> Delivery Time
              </label>
              <input
                type="datetime-local"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full p-2 text-xs font-mono font-medium rounded-lg border border-slate-300 focus:outline-none focus:border-[#2EC4B6] bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full btn-teal py-3.5 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
        >
          <CheckCircle className="w-4 h-4" />
          <span>
            {submitting
              ? 'Registering Component...'
              : drawerId
              ? `Confirm Intake → Drawer ${drawerId}`
              : 'Select Drawer Compartment'}
          </span>
        </button>
      </form>
    </div>
  );
};
