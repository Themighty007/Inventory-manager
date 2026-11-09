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
  ShieldCheck,
  Clock,
} from 'lucide-react';

interface MobileParcelIntakeProps {
  initialCode?: string;
  drawers: DrawerSummary[];
  isOnline: boolean;
  userName: string;
  onCompleted: (message: string) => void;
  onBack: () => void;
}

export const MobileParcelIntake: React.FC<MobileParcelIntakeProps> = ({
  initialCode = '',
  drawers,
  isOnline,
  userName,
  onCompleted,
  onBack,
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
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!initialCode) return;
    const clean = initialCode.trim();

    // 1. Drawer QR Code, e.g. "DRAWER:S04" or plain "S04"
    const drawerMatch = clean.match(/^(?:DRAWER:)?([SL]\d{2})$/i);
    if (drawerMatch) {
      const parsedDrawer = drawerMatch[1].toUpperCase();
      if (drawers.some((d) => d.id === parsedDrawer)) {
        setDrawerId(parsedDrawer);
        return;
      }
    }

    // 2. SKU / Item QR Code, e.g. "ITEM:ESP32" or "SKU:RES-10K"
    if (clean.startsWith('ITEM:') || clean.startsWith('SKU:')) {
      const parsedSku = clean.replace(/^(ITEM:|SKU:)/, '').trim().toUpperCase();
      setSku(parsedSku);
      return;
    }

    // 3. Tracking code or raw barcode
    setTrackingCode(clean);
    setSku(clean.toUpperCase());
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
      // Offline mode: Store operation in IndexedDB with UUID
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

  return (
    <div className="flex flex-col h-full bg-[#F8F6F1] overflow-y-auto p-4 select-none text-[#18181B]">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-black text-[#18181B] hover:text-[#15803D]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Scanner
        </button>
        <span
          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-[#18181B] ${
            isOnline ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF08A] text-[#713F12]'
          }`}
        >
          {isOnline ? 'Live Master Connected' : 'Offline Queue Mode'}
        </span>
      </div>

      {/* Scanned Badge Banner */}
      {trackingCode && (
        <div className="p-3 bg-white border-2 border-[#18181B] rounded-xl shadow-[2px_2px_0px_#18181B] flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#FEF08A] text-[#18181B] flex items-center justify-center font-bold border border-[#18181B]">
              <Barcode className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-[#71717A] uppercase font-mono block">
                SCANNED PARCEL / BARCODE
              </span>
              <span className="text-xs font-mono font-black text-[#18181B]">{trackingCode}</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#86EFAC]">
            Scanned
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#B91C1C] flex items-center gap-2 mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-4 pb-12">
        <div className="bg-white p-4 rounded-2xl border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-[#71717A] pb-1 border-b border-[#E4E4E7]">
            Component Information
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-black text-[#18181B] block mb-1">PART SKU *</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="Enter or scan SKU..."
                className="w-full p-2.5 text-xs font-mono font-black rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] placeholder-[#A1A1AA]"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-[#18181B] block mb-1">QUANTITY *</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                placeholder="Qty"
                className="w-full p-2.5 text-xs font-mono font-black rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] placeholder-[#A1A1AA]"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-[#18181B] block mb-1">ITEM DESCRIPTION</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Component description / part name (optional)..."
              className="w-full p-2.5 text-xs font-semibold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] placeholder-[#A1A1AA]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-black text-[#18181B] block mb-1">CATEGORY</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 text-xs font-bold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black text-[#18181B] block mb-1">UNIT PRICE (₹)</label>
              <input
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                placeholder="Optional (₹)"
                className="w-full p-2.5 text-xs font-mono font-bold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] placeholder-[#A1A1AA]"
              />
            </div>
          </div>
        </div>

        {/* Physical Drawer Assignment */}
        <div className="bg-white p-4 rounded-2xl border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-[#E4E4E7]">
            <span className="text-xs font-black uppercase tracking-wider text-[#71717A]">
              Cabinet Compartment *
            </span>
            {drawerId ? (
              <span className="font-mono text-xs font-black bg-[#86EFAC] text-[#064E3B] px-2 py-0.5 rounded border border-[#18181B]">
                ✓ Selected: {drawerId}
              </span>
            ) : (
              <span className="font-mono text-xs font-black bg-[#FEF08A] text-[#713F12] px-2 py-0.5 rounded border border-[#18181B] animate-pulse">
                ⚠️ Tap to Select
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#71717A]">
            {drawerId ? `Item will be stored in Compartment ${drawerId}. Tap any other box to change:` : 'Tap any compartment below to assign this item:'}
          </p>

          <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto p-1.5 bg-[#FAFAFA] border-2 border-[#18181B] rounded-xl">
            {drawers.map((d) => (
              <button
                type="button"
                key={d.id}
                onClick={() => setDrawerId(d.id)}
                className={`py-1.5 rounded-lg border font-mono font-black text-[11px] transition-all ${
                  drawerId === d.id
                    ? 'bg-[#18181B] text-[#86EFAC] border-[#18181B] shadow-[1px_1px_0px_#18181B] scale-105'
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

        {/* Invoice & Supplier */}
        <div className="bg-white p-4 rounded-2xl border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-[#71717A] pb-1 border-b border-[#E4E4E7]">
            Procurement & Tracking Details (Optional)
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-black text-[#18181B] block mb-1">SUPPLIER</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Vendor name..."
                className="w-full p-2.5 text-xs font-semibold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] placeholder-[#A1A1AA]"
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-[#18181B] block mb-1">INVOICE #</label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="Bill / Invoice ref..."
                className="w-full p-2.5 text-xs font-mono rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] placeholder-[#A1A1AA]"
              />
            </div>
          </div>
        </div>

        {/* Submit Confirmation Button */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full brutal-btn brutal-btn-mint py-3.5 text-xs font-black uppercase tracking-wider text-[#064E3B] shadow-[3px_3px_0px_#18181B] flex items-center justify-center gap-2"
        >
          {isOnline ? (
            <>
              <CheckCircle className="w-4 h-4" />
              {submitting ? 'Registering to Master...' : drawerId ? `Confirm Intake → Drawer ${drawerId}` : 'Select a Compartment to Confirm'}
            </>
          ) : (
            <>
              <Clock className="w-4 h-4" />
              {submitting ? 'Storing in IndexedDB...' : drawerId ? `Queue Offline Intake → Drawer ${drawerId}` : 'Select a Compartment to Confirm'}
            </>
          )}
        </button>
      </form>
    </div>
  );
};
