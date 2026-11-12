import React, { useState } from 'react';
import { PendingDeliveryItem, DrawerSummary } from '../../types/inventory';
import { assignPendingDeliveryDrawer } from '../../api/client';
import {
  Package,
  Clock,
  Layers,
  Search,
  CheckCircle,
  AlertTriangle,
  Calendar,
  X,
  Plus,
  Minus,
  Sparkles,
  Truck,
  ArrowRight,
} from 'lucide-react';

interface YetToBeDeliveredPanelProps {
  pendingItems: PendingDeliveryItem[];
  drawers: DrawerSummary[];
  searchQuery?: string;
  onRefresh: () => void;
  onNotice: (msg: string) => void;
  onOpenDrawerModal?: (drawerId: string) => void;
}

export const YetToBeDeliveredPanel: React.FC<YetToBeDeliveredPanelProps> = ({
  pendingItems,
  drawers,
  searchQuery = '',
  onRefresh,
  onNotice,
}) => {
  const [filterTerm, setFilterTerm] = useState('');
  const [selectedItemForSlotting, setSelectedItemForSlotting] = useState<PendingDeliveryItem | null>(null);
  const [targetDrawer, setTargetDrawer] = useState<string>('S01');
  const [slotQuantity, setSlotQuantity] = useState<number>(1);
  const [subTray, setSubTray] = useState<string>('MAIN');
  const [operatorNotes, setOperatorNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [slotError, setSlotError] = useState<string | null>(null);

  const term = (filterTerm || searchQuery).trim().toLowerCase();
  const filtered = pendingItems.filter((it) => {
    if (!term) return true;
    return (
      it.sku.toLowerCase().includes(term) ||
      (it.item_name && it.item_name.toLowerCase().includes(term)) ||
      it.invoice_number.toLowerCase().includes(term) ||
      it.supplier.toLowerCase().includes(term) ||
      (it.sale_order_number && it.sale_order_number.toLowerCase().includes(term))
    );
  });

  const totalPendingUnits = pendingItems.reduce((acc, it) => acc + it.quantity, 0);
  const totalPendingValuation = pendingItems.reduce(
    (acc, it) => acc + (it.unit_price || 0) * it.quantity,
    0
  );
  const distinctInvoices = new Set(pendingItems.map((it) => it.invoice_number)).size;

  const smallDrawers = Array.from({ length: 30 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
  const largeDrawers = Array.from({ length: 9 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`);
  const drawerMap = new Map(drawers.map((d) => [d.id, d]));

  const handleOpenSlotModal = (item: PendingDeliveryItem) => {
    setSelectedItemForSlotting(item);
    setSlotQuantity(item.quantity);
    setTargetDrawer('S01');
    setSubTray('MAIN');
    setOperatorNotes('');
    setSlotError(null);
  };

  const handleConfirmSlotting = async () => {
    if (!selectedItemForSlotting) return;
    if (!targetDrawer) {
      setSlotError('Please choose a physical Stanley drawer (S01–S30 or L01–L09).');
      return;
    }
    if (slotQuantity <= 0) {
      setSlotError('Quantity to slot must be at least 1.');
      return;
    }

    setIsSubmitting(true);
    setSlotError(null);
    try {
      const res = await assignPendingDeliveryDrawer(selectedItemForSlotting.id, {
        drawer_id: targetDrawer,
        quantity: slotQuantity,
        sub_tray: subTray,
        notes: operatorNotes.trim() || undefined,
      });

      onNotice(`✓ Received & slotted ${res.sku} (${res.quantity} pcs) into Drawer ${res.drawer_id}!`);
      setSelectedItemForSlotting(null);
      onRefresh();
    } catch (err: any) {
      setSlotError(err?.message || 'Failed to assign physical drawer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  return (
    <div className="space-y-5">
      {/* Top Banner Card */}
      <div className="skr-card p-5 bg-white border border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-bold tracking-tight text-[#0B132B] flex items-center gap-2">
                Yet to be Delivered
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20">
                  {pendingItems.length} items in transit
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Hardware ordered online and awaiting physical arrival. Scan the package QR/barcode or manually assign a Stanley drawer upon unboxing.
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[80px]">
              <div className="text-[9px] font-bold uppercase text-slate-400">Total Units</div>
              <div className="font-mono font-bold text-sm text-[#0B132B]">{totalPendingUnits}</div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[100px]">
              <div className="text-[9px] font-bold uppercase text-slate-400">In-Transit Value</div>
              <div className="font-mono font-bold text-sm text-[#2EC4B6]">
                ₹{totalPendingValuation.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-center min-w-[75px]">
              <div className="text-[9px] font-bold uppercase text-slate-400">Invoices</div>
              <div className="font-mono font-bold text-sm text-slate-700">{distinctInvoices}</div>
            </div>
          </div>
        </div>

        {/* Filter Input */}
        <div className="pt-3 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={filterTerm}
              onChange={(e) => setFilterTerm(e.target.value)}
              placeholder="Search by SKU, component name, supplier, or invoice #..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-[#00B4D8]"
            />
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            Showing {filtered.length} of {pendingItems.length} pending items
          </span>
        </div>
      </div>

      {/* Main Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="skr-card p-12 bg-white text-center border border-dashed border-slate-300 rounded-2xl space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Package className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-display font-bold text-[#0B132B]">
            No Components Awaiting Delivery
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {pendingItems.length === 0
              ? 'All ordered parts have been received and allocated into your physical Stanley cabinet drawers. Upload a new invoice to stage incoming shipments.'
              : 'No pending items match your search filter.'}
          </p>
        </div>
      ) : (
        <div className="skr-card bg-white border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase text-slate-500">
                  <th className="py-3 px-4">INVOICE & SUPPLIER</th>
                  <th className="py-3 px-4">PART SKU</th>
                  <th className="py-3 px-4">COMPONENT DESCRIPTION</th>
                  <th className="py-3 px-4 text-center">ORDER DATE</th>
                  <th className="py-3 px-4 text-right">QUANTITY</th>
                  <th className="py-3 px-4 text-right">UNIT PRICE</th>
                  <th className="py-3 px-4 text-right">EST. VALUE</th>
                  <th className="py-3 px-4 text-center">STATUS</th>
                  <th className="py-3 px-4 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((item) => {
                  const lineTotal = (item.unit_price || 0) * item.quantity;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-xs text-[#0B132B]">
                          {item.invoice_number}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">{item.supplier}</div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-xs text-[#00B4D8] bg-[#00B4D8]/10 px-2 py-0.5 rounded border border-[#00B4D8]/20">
                          {item.sku}
                        </span>
                      </td>

                      <td className="py-3 px-4 max-w-[240px]">
                        <div className="font-semibold text-slate-800 line-clamp-1">
                          {item.item_name || item.sku}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          Category: {item.category || 'General'}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        {formatDate(item.order_date || item.created_at)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#0B132B]">
                        {item.quantity} pcs
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-600">
                        ₹{(item.unit_price || 0).toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{lineTotal.toFixed(2)}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock className="w-3 h-3 text-amber-500" /> In Transit
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleOpenSlotModal(item)}
                          className="btn-cyan py-1.5 px-3 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 shadow-xs"
                          title="Physically slot component into Stanley cabinet drawer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Assign Drawer</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Physical Drawer Slotting Modal */}
      {selectedItemForSlotting && (
        <div className="modal-overlay" onClick={() => !isSubmitting && setSelectedItemForSlotting(null)}>
          <div
            className="skr-card bg-white w-full max-w-3xl p-6 relative shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-display font-bold text-[#0B132B]">
                    Slot Hardware into Stanley Cabinet
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Assigning arrived physical component to a compartment
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isSubmitting && setSelectedItemForSlotting(null)}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {slotError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <span>{slotError}</span>
              </div>
            )}

            {/* Component Summary Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <span className="font-mono font-bold text-xs text-[#00B4D8] bg-[#00B4D8]/10 px-2 py-0.5 rounded border border-[#00B4D8]/20 mr-2">
                  {selectedItemForSlotting.sku}
                </span>
                <span className="font-bold text-[#0B132B]">
                  {selectedItemForSlotting.item_name || selectedItemForSlotting.sku}
                </span>
                <div className="text-[10px] text-slate-500 font-medium mt-1">
                  Invoice: {selectedItemForSlotting.invoice_number} • Supplier: {selectedItemForSlotting.supplier}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Quantity to slot:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={slotQuantity <= 1}
                    onClick={() => setSlotQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 text-slate-700 disabled:opacity-40"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={selectedItemForSlotting.quantity}
                    value={slotQuantity}
                    onChange={(e) =>
                      setSlotQuantity(
                        Math.max(1, Math.min(selectedItemForSlotting.quantity, parseInt(e.target.value) || 1))
                      )
                    }
                    className="w-16 text-center py-1 rounded border border-slate-300 font-mono font-bold text-xs bg-white"
                  />
                  <button
                    type="button"
                    disabled={slotQuantity >= selectedItemForSlotting.quantity}
                    onClick={() => setSlotQuantity((q) => Math.min(selectedItemForSlotting.quantity, q + 1))}
                    className="w-7 h-7 rounded border border-slate-300 bg-white flex items-center justify-center hover:bg-slate-100 text-slate-700 disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* 39-Compartment Matrix Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#0B132B] flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#00B4D8]" />
                  Select Target Compartment:
                  <span className="font-mono font-bold text-[#00B4D8] bg-[#00B4D8]/10 px-2 py-0.5 rounded border border-[#00B4D8]/20 ml-1">
                    {targetDrawer}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Green = Occupied • White = Empty
                </span>
              </div>

              {/* Large Drawers (L01 - L09) */}
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Large Lower Drawers (L01 – L09)
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                  {largeDrawers.map((dId) => {
                    const info = drawerMap.get(dId);
                    const isSelected = targetDrawer === dId;
                    const hasItems = (info?.total_units || 0) > 0;
                    return (
                      <button
                        key={dId}
                        type="button"
                        onClick={() => setTargetDrawer(dId)}
                        className={`py-2 px-1 rounded-lg border text-center font-mono text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#00B4D8] text-white border-[#00B4D8] shadow-sm'
                            : hasItems
                            ? 'bg-[#2EC4B6]/10 text-[#2EC4B6] border-[#2EC4B6]/30 hover:bg-[#2EC4B6]/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {dId}
                        {hasItems ? ` (${info?.total_units})` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Small Drawers (S01 - S30) */}
              <div>
                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Small Upper Drawers (S01 – S30)
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                  {smallDrawers.map((dId) => {
                    const info = drawerMap.get(dId);
                    const isSelected = targetDrawer === dId;
                    const hasItems = (info?.total_units || 0) > 0;
                    return (
                      <button
                        key={dId}
                        type="button"
                        onClick={() => setTargetDrawer(dId)}
                        className={`py-1.5 px-1 rounded-lg border text-center font-mono text-[11px] font-semibold transition-all ${
                          isSelected
                            ? 'bg-[#00B4D8] text-white border-[#00B4D8] shadow-sm'
                            : hasItems
                            ? 'bg-[#2EC4B6]/10 text-[#2EC4B6] border-[#2EC4B6]/30 hover:bg-[#2EC4B6]/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {dId}
                        {hasItems ? `·${info?.total_units}` : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sub-tray & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Sub-Tray / Partition
                </label>
                <select
                  value={subTray}
                  onChange={(e) => setSubTray(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold"
                >
                  <option value="MAIN">MAIN (Default Compartment)</option>
                  <option value="TRAY-FRONT">TRAY-FRONT</option>
                  <option value="TRAY-REAR">TRAY-REAR</option>
                  <option value="DIVIDER-LEFT">DIVIDER-LEFT</option>
                  <option value="DIVIDER-RIGHT">DIVIDER-RIGHT</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Intake Notes
                </label>
                <input
                  type="text"
                  value={operatorNotes}
                  onChange={(e) => setOperatorNotes(e.target.value)}
                  placeholder="e.g. Verified physically from package"
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                Slotting into drawer <strong className="text-[#0B132B]">{targetDrawer}</strong> will mark delivery complete.
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setSelectedItemForSlotting(null)}
                  className="py-2 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmSlotting}
                  className="btn-cyan py-2 px-5 text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-xs"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{isSubmitting ? 'Slotting...' : `Confirm Slotting → ${targetDrawer}`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
