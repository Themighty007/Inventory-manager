import React, { useState, useEffect } from 'react';
import { receiveStock } from '../../api/client';
import { X, CheckCircle, Package, FileText } from 'lucide-react';

interface ParcelIntakeModalProps {
  isOpen: boolean;
  defaultSku?: string;
  defaultDrawer?: string;
  onClose: () => void;
  onRefresh: () => void;
  onSwitchToInvoiceUpload?: () => void;
}

export const ParcelIntakeModal: React.FC<ParcelIntakeModalProps> = ({
  isOpen,
  defaultSku,
  defaultDrawer = 'S01',
  onClose,
  onRefresh,
  onSwitchToInvoiceUpload,
}) => {
  const [sku, setSku] = useState(defaultSku || '');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Microcontrollers');
  const [drawerId, setDrawerId] = useState(defaultDrawer);
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [supplier, setSupplier] = useState('');
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveryTime, setDeliveryTime] = useState(
    new Date().toISOString().slice(0, 16)
  );

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (defaultSku) setSku(defaultSku);
    if (defaultDrawer) setDrawerId(defaultDrawer);
    setErrorMsg(null);
  }, [defaultSku, defaultDrawer, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !drawerId) return;

    setLoading(true);
    setErrorMsg(null);

    try {
      await receiveStock({
        item_sku: sku.trim().toUpperCase(),
        item_name: name.trim() || undefined,
        category: category,
        quantity: quantity,
        unit_price: unitPrice,
        drawer_id: drawerId.toUpperCase().trim(),
        target_drawer_id: drawerId.toUpperCase().trim(),
        supplier: supplier.trim() || undefined,
        invoice_number: invoice.trim() || undefined,
        order_date: orderDate || undefined,
        delivery_arrival_time: deliveryTime || undefined,
        notes: notes.trim() || undefined,
      });

      onRefresh();
      onClose();
      // Reset fields
      setName('');
      setQuantity(1);
      setUnitPrice(0);
      setSupplier('');
      setInvoice('');
      setNotes('');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    'Microcontrollers',
    'Semiconductors',
    'Passives',
    'Electrical',
    'Sensors',
    'Cables & Connectors',
    'Network',
    'HVAC',
    'Tools & Mechanical',
    'Hardware',
    'General',
  ];
  const allDrawers: string[] = [];
  for (let i = 1; i <= 30; i++) allDrawers.push(`S${i.toString().padStart(2, '0')}`);
  for (let i = 1; i <= 9; i++) allDrawers.push(`L${i.toString().padStart(2, '0')}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="skr-card bg-white w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-bold text-[#0B132B]">
                Receive Component / Parcel Intake
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Register stock directly into a Stanley cabinet compartment
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {onSwitchToInvoiceUpload && (
          <div className="mb-4 p-3 rounded-xl bg-[#00B4D8]/10 border border-[#00B4D8]/30 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#0E7490]">
              Have a multi-item supplier invoice (PDF/DOCX/CSV)?
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToInvoiceUpload();
              }}
              className="px-3 py-1 rounded-lg bg-[#0B132B] text-[#00B4D8] text-xs font-bold flex items-center gap-1 hover:bg-slate-900 shrink-0"
            >
              <FileText className="w-3 h-3" /> Auto-Extract →
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">PART SKU *</label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder="e.g. ESP32-DEV-01"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-[#00B4D8]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">QUANTITY *</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-[#00B4D8]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">DESCRIPTION</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. ESP32 Development Board WiFi + BLE"
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:border-[#00B4D8]"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">CATEGORY</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-semibold bg-slate-50 focus:border-[#00B4D8]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">DRAWER *</label>
              <select
                value={drawerId}
                onChange={(e) => setDrawerId(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-slate-50 focus:border-[#00B4D8]"
              >
                {allDrawers.map((d) => (
                  <option key={d} value={d}>Drawer {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">UNIT COST (₹)</label>
              <input
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:border-[#00B4D8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">SUPPLIER</label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="e.g. Robu.in / Mouser"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-medium bg-white focus:border-[#00B4D8]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">INVOICE / TRACKING #</label>
              <input
                type="text"
                value={invoice}
                onChange={(e) => setInvoice(e.target.value)}
                placeholder="e.g. INV-2026-901"
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono bg-white focus:border-[#00B4D8]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">ORDER DATE</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-semibold bg-slate-50 focus:border-[#00B4D8]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">DELIVERY / ARRIVAL TIME</label>
              <input
                type="datetime-local"
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-mono font-semibold bg-slate-50 focus:border-[#00B4D8]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 uppercase">NOTES</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received for IoT prototyping"
              className="w-full p-2.5 rounded-lg border border-slate-300 text-xs bg-white focus:border-[#00B4D8]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-cyan py-2 px-5 text-xs font-semibold rounded-lg flex items-center gap-1.5"
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
