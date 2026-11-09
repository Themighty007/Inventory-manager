import React, { useState, useEffect } from 'react';
import { receiveStock } from '../../api/client';
import { X, CheckCircle, Package } from 'lucide-react';

interface ParcelIntakeModalProps {
  isOpen: boolean;
  defaultSku?: string;
  defaultDrawer?: string;
  onClose: () => void;
  onRefresh: () => void;
}

export const ParcelIntakeModal: React.FC<ParcelIntakeModalProps> = ({
  isOpen,
  defaultSku,
  defaultDrawer = 'S01',
  onClose,
  onRefresh,
}) => {
  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Microcontrollers');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [drawerId, setDrawerId] = useState(defaultDrawer);
  const [trackingCode, setTrackingCode] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (defaultSku) setSku(defaultSku);
      if (defaultDrawer) setDrawerId(defaultDrawer);
      setErrorMsg(null);
    }
  }, [isOpen, defaultSku, defaultDrawer]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim()) {
      setErrorMsg('Component SKU is required.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      await receiveStock({
        item_sku: sku.trim().toUpperCase(),
        item_name: name.trim() || undefined,
        category,
        quantity,
        unit_price: unitPrice,
        supplier: supplier.trim() || undefined,
        invoice_number: invoice.trim() || undefined,
        tracking_code: trackingCode.trim() || undefined,
        drawer_id: drawerId.toUpperCase(),
        notes: notes.trim() || undefined,
      });

      onRefresh();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Intake failed');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['Microcontrollers', 'Passives', 'Electrical', 'Network', 'HVAC', 'Sensors', 'Semiconductors', 'Hardware'];
  const allDrawers: string[] = [];
  for (let i = 1; i <= 30; i++) allDrawers.push(`S${i.toString().padStart(2, '0')}`);
  for (let i = 1; i <= 9; i++) allDrawers.push(`L${i.toString().padStart(2, '0')}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="brutal-card bg-white w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#86EFAC] border-2 border-[#18181B] flex items-center justify-center font-bold">
              <Package className="w-5 h-5 text-[#064E3B]" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-[#18181B]">
                Receive Component / Parcel Intake
              </h3>
              <p className="text-xs text-[#71717A] font-semibold">
                Register stock directly into a Stanley cabinet drawer
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

        {errorMsg && (
          <div className="mb-4 p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#B91C1C]">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">PART SKU *</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. ESP32-DEV-01"
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-bold bg-[#FAFAFA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">QUANTITY *</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-black bg-[#FAFAFA]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-[#18181B] mb-1">DESCRIPTION</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ESP32 Development Board WiFi + BLE"
              className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-semibold bg-[#FAFAFA]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">CATEGORY</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-[#FAFAFA]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">DRAWER *</label>
              <select
                value={drawerId}
                onChange={(e) => setDrawerId(e.target.value)}
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-bold bg-[#FAFAFA]"
              >
                {allDrawers.map((d) => (
                  <option key={d} value={d}>Drawer {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">UNIT COST (₹)</label>
              <input
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono font-bold bg-[#FAFAFA]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">SUPPLIER</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Mouser / DigiKey"
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-semibold bg-[#FAFAFA]"
              />
            </div>
            <div>
              <label className="block text-xs font-black text-[#18181B] mb-1">INVOICE / TRACKING #</label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="e.g. INV-2026-901"
                className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-mono bg-[#FAFAFA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-[#18181B] mb-1">NOTES</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received for R&D prototyping"
              className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs bg-[#FAFAFA]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
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
              <CheckCircle className="w-4 h-4" />
              {loading ? 'Submitting...' : `Register to Drawer ${drawerId}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
