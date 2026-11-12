import React, { useState } from 'react';
import { InvoiceSummaryResponse } from '../../types/inventory';
import {
  FileText,
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  Upload,
  Layers,
} from 'lucide-react';

interface InvoicesPanelProps {
  invoices: InvoiceSummaryResponse[];
  searchQuery?: string;
  onOpenInvoiceUpload: () => void;
  onOpenDrawerModal: (drawerId: string) => void;
}

export const InvoicesPanel: React.FC<InvoicesPanelProps> = ({
  invoices,
  searchQuery = '',
  onOpenInvoiceUpload,
  onOpenDrawerModal,
}) => {
  const [expandedId, setExpandedId] = useState<number | null>(
    invoices.length > 0 ? invoices[0].id : null
  );

  const term = searchQuery.trim().toLowerCase();
  const filtered = invoices.filter((inv) => {
    if (!term) return true;
    return (
      inv.invoice_number.toLowerCase().includes(term) ||
      (inv.sale_order_number && inv.sale_order_number.toLowerCase().includes(term)) ||
      inv.supplier.toLowerCase().includes(term) ||
      (inv.source_filename && inv.source_filename.toLowerCase().includes(term)) ||
      inv.drawers_used.some((d) => d.toLowerCase().includes(term)) ||
      inv.items.some(
        (it) =>
          it.sku.toLowerCase().includes(term) ||
          (it.item_name && it.item_name.toLowerCase().includes(term))
      )
    );
  });

  const formatDateOnly = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  };

  const formatDateTime = (iso?: string | null) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.replace('T', ' ');
    return d.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="skr-card p-6 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold tracking-tight text-[#0B132B]">
              Logged Invoices & Component Arrivals
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Order Date, Delivery/Arrival Time & Stanley compartment assignments
            </p>
          </div>
        </div>

        {invoices.length > 0 && (
          <button
            onClick={onOpenInvoiceUpload}
            className="btn-cyan text-xs py-1.5 px-3.5 font-semibold rounded-lg flex items-center gap-1.5"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" /> Upload Invoice
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 px-6 text-center border border-dashed border-slate-300 rounded-xl bg-slate-50/60 space-y-3">
          <FileText className="w-8 h-8 mx-auto text-slate-400" />
          <div className="text-xs font-bold uppercase text-slate-700">
            {invoices.length === 0 ? 'No Invoices Logged Yet' : 'No Matching Invoices Found'}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload a supplier PDF, DOCX, CSV, or text invoice to extract items, order dates, and quantities automatically.
          </p>
          {invoices.length === 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenInvoiceUpload}
                className="btn-cyan text-xs py-2 px-4 font-semibold rounded-lg inline-flex items-center gap-2"
              >
                <Upload className="w-4 h-4 shrink-0" /> Upload Invoice Document
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const isOpen = expandedId === inv.id;
            return (
              <div
                key={inv.id}
                className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm"
              >
                <div
                  onClick={() => setExpandedId(isOpen ? null : inv.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <div className="space-y-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm text-[#0B132B]">
                        {inv.invoice_number}
                      </span>
                      {inv.sale_order_number && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 font-mono font-semibold text-[10px] text-slate-700">
                          SO: {inv.sale_order_number}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md bg-[#2EC4B6]/10 text-[#0E7490] font-mono font-semibold text-[10px]">
                        {inv.items_count} SKUs • {inv.total_units} pcs
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-500">
                      {inv.supplier}
                      {inv.source_filename ? ` • ${inv.source_filename}` : ''}
                    </div>
                  </div>

                  {/* Order Date & Arrival Time */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
                        <Calendar className="w-3 h-3 text-[#00B4D8]" /> Order Date
                      </div>
                      <div className="font-mono font-semibold text-[#0B132B]">
                        {formatDateOnly(inv.order_date)}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500">
                        <Clock className="w-3 h-3 text-[#2EC4B6]" /> Arrival / Delivery
                      </div>
                      <div className="font-mono font-semibold text-[#0B132B]">
                        {formatDateTime(inv.delivery_arrival_time || inv.received_date)}
                      </div>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="text-[10px] font-bold uppercase text-slate-400">Total</div>
                      <div className="font-mono font-bold text-sm text-[#0B132B]">
                        {inv.currency === 'INR' ? '₹' : `${inv.currency} `}
                        {inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-slate-400">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Line Items Detail */}
                {isOpen && (
                  <div className="border-t border-slate-200 p-4 bg-slate-50/50">
                    <div className="text-[11px] font-bold uppercase text-slate-500 mb-2 flex items-center justify-between">
                      <span>Logged Line Items & Compartment Mapping</span>
                      <span className="font-mono text-[10px]">
                        Target Compartments: {inv.drawers_used.join(', ') || 'None'}
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 bg-slate-50 text-[10px] uppercase font-bold">
                            <th className="py-2 px-3">SKU</th>
                            <th className="py-2 px-3">Component Name</th>
                            <th className="py-2 px-3 text-center">Drawer</th>
                            <th className="py-2 px-3 text-right">Quantity</th>
                            <th className="py-2 px-3 text-right">Unit Price</th>
                            <th className="py-2 px-3 text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inv.items.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-[#0B132B]">
                                {row.sku}
                              </td>
                              <td className="py-2 px-3 text-slate-700">
                                {row.item_name || '—'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                {row.drawer_id ? (
                                  <button
                                    onClick={() => onOpenDrawerModal(row.drawer_id!)}
                                    className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 hover:bg-[#00B4D8]/20"
                                  >
                                    <Layers className="w-2.5 h-2.5 inline mr-1" />
                                    {row.drawer_id}
                                  </button>
                                ) : (
                                  <span className="px-2 py-0.5 rounded font-mono font-semibold text-[10px] bg-amber-50 text-amber-700 border border-amber-200">
                                    ⏳ Yet to be Delivered
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[#2EC4B6]">
                                {row.quantity}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600">
                                ₹{row.unit_price.toFixed(2)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                                ₹{row.line_total.toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
