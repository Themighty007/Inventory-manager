import React, { useState } from 'react';
import { receiveStock } from '../api/client';
import { X, PackagePlus, Barcode, CheckCircle, AlertCircle } from 'lucide-react';

interface ParcelIntakeModalProps {
  isOpen: boolean;
  defaultSku?: string;
  defaultDrawer?: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const ParcelIntakeModal: React.FC<ParcelIntakeModalProps> = ({
  isOpen,
  defaultSku = '',
  defaultDrawer = 'S01',
  onClose,
  onRefresh,
}) => {
  const [trackingCode, setTrackingCode] = useState('');
  const [sku, setSku] = useState(defaultSku);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Microcontrollers');
  const [supplier, setSupplier] = useState('Mouser Electronics Tech');
  const [invoice, setInvoice] = useState('INV-2026-');
  const [quantity, setQuantity] = useState(10);
  const [unitPrice, setUnitPrice] = useState(150);
  const [drawerId, setDrawerId] = useState(defaultDrawer);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSimulateScan = () => {
    const demoCodes = [
      { track: 'TRACK-ESP-8821', sku: 'ESP32-S3-WROOM', name: 'ESP32-S3 Dual Core AI Dev Board', cat: 'Microcontrollers', price: 340 },
      { track: 'TRACK-CABLE-331', sku: 'CAT6-50M-SHLD', name: 'Cat6 Shielded Network Cable', cat: 'Network', price: 3200 },
      { track: 'TRACK-OLED-552', sku: 'OLED-0.96-I2C', name: '0.96 I2C OLED Display', cat: 'Displays', price: 210 },
      { track: 'TRACK-RELAY-12V', sku: 'RELAY-4CH-5V', name: '4-Channel Optocoupler Relay Module', cat: 'Electrical', price: 180 },
    ];
    const picked = demoCodes[Math.floor(Math.random() * demoCodes.length)];
    setTrackingCode(picked.track);
    setSku(picked.sku);
    setName(picked.name);
    setCategory(picked.cat);
    setUnitPrice(picked.price);
    setInvoice(`INV-2026-${Math.floor(1000 + Math.random() * 9000)}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      const res = await receiveStock({
        tracking_code: trackingCode || undefined,
        item_sku: sku.trim().toUpperCase(),
        item_name: name.trim() || undefined,
        category,
        supplier,
        invoice_number: invoice.trim() || undefined,
        quantity,
        unit_price: unitPrice,
        drawer_id: drawerId.toUpperCase(),
        notes: notes || undefined,
      });

      setSuccess(res.message);
      setTimeout(() => {
        onRefresh();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="brutal-card bg-white w-full max-w-xl p-6 relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center">
              <PackagePlus className="w-5 h-5 text-[#18181B]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] uppercase">Receive Incoming Parcel / SKU</h2>
              <p className="text-xs text-[#71717A] font-semibold">
                Register components and assign directly to a physical Stanley drawer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
          >
            <X className="w-4 h-4 text-[#18181B]" />
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#B91C1C] flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}
        {success && (
          <div className="mb-3 p-3 bg-[#DCFCE7] border-2 border-[#15803D] rounded-xl text-xs font-bold text-[#15803D] flex items-center gap-2">
            <CheckCircle className="w-4 h-4" /> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Quick Barcode Scan Bar */}
          <div className="p-3 bg-[#FAFAFA] border-2 border-dashed border-[#18181B] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-[#18181B]">
              <Barcode className="w-4 h-4 text-[#71717A]" />
              <span>Camera Barcode / Tracking Number:</span>
            </div>
            <button
              type="button"
              onClick={handleSimulateScan}
              className="px-2.5 py-1 text-[11px] font-bold rounded bg-[#86EFAC] border border-[#18181B] hover:bg-[#6EE7B7]"
            >
              Simulate Barcode Scan
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">TRACKING NUMBER</label>
              <input
                type="text"
                placeholder="e.g. TRACK123456"
                value={trackingCode}
                onChange={(e) => setTrackingCode(e.target.value)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] font-mono text-xs font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">INVOICE NUMBER</label>
              <input
                type="text"
                placeholder="e.g. INV-2026-00125"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] font-mono text-xs font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-black text-[#18181B] mb-1">PART SKU *</label>
              <input
                type="text"
                placeholder="e.g. ESP32-DEV-01"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] font-mono text-xs font-black uppercase"
                required
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-black text-[#18181B] mb-1">COMPONENT NAME</label>
              <input
                type="text"
                placeholder="e.g. ESP32 WiFi + BLE Development Board"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">CATEGORY</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-white"
              >
                <option value="Electrical">Electrical</option>
                <option value="Network">Network</option>
                <option value="HVAC">HVAC</option>
                <option value="Microcontrollers">Microcontrollers</option>
                <option value="Passives">Passives</option>
                <option value="Sensors">Sensors</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">QTY RECEIVED *</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] font-mono text-xs font-black"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">UNIT COST (₹)</label>
              <input
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] font-mono text-xs font-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">TARGET STANLEY DRAWER *</label>
              <input
                type="text"
                placeholder="S01..S30 or L01..L09"
                value={drawerId}
                onChange={(e) => setDrawerId(e.target.value.toUpperCase())}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] font-mono text-xs font-black uppercase bg-[#FEF08A]/40"
                required
              />
              <span className="text-[10px] text-[#71717A]">
                Small (S01–S30) or Large (L01–L09)
              </span>
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">SUPPLIER</label>
              <input
                type="text"
                placeholder="e.g. Mouser Electronics"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-semibold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-[#18181B] mb-1">NOTES / AUDIT REFERENCE</label>
            <input
              type="text"
              placeholder="e.g. Batch received via BlueDart courier"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-semibold"
            />
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="brutal-btn brutal-btn-white text-xs py-2 px-4"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="brutal-btn brutal-btn-mint text-xs py-2 px-5"
            >
              {loading ? 'Committing...' : 'Confirm & Assign to Drawer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
