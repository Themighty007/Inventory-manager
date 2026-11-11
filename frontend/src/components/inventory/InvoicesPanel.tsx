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
    <div className="brutal-card p-6 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center shadow-[2px_2px_0px_#18181B] shrink-0">
            <FileText className="w-5 h-5 text-[#18181B]" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-[#18181B] uppercase">
              Logged Invoices & Component Arrivals
            </h3>
            <p className="text-xs text-[#71717A] font-semibold">
              Order Date, Delivery/Arrival Time & Stanley compartment assignments
            </p>
          </div>
        </div>

        {invoices.length > 0 && (
          <button
            onClick={onOpenInvoiceUpload}
            className="brutal-btn brutal-btn-yellow text-xs py-2 px-4 text-[#713F12]"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" /> Upload Invoice
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-10 px-6 text-center border-2 border-dashed border-[#D4D4D8] rounded-xl bg-[#FAF9F5] space-y-3">
          <FileText className="w-8 h-8 mx-auto text-[#71717A]" />
          <div className="text-xs font-black uppercase text-[#18181B]">
            {invoices.length === 0 ? 'No Invoices Logged Yet' : 'No Matching Invoices Found'}
          </div>
          <p className="text-xs text-[#71717A] font-semibold max-w-md mx-auto">
            Upload a supplier PDF, DOCX, CSV, or text invoice to extract items, order dates, and quantities automatically.
          </p>
          {invoices.length === 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onOpenInvoiceUpload}
                className="brutal-btn brutal-btn-yellow text-xs py-2 px-5 text-[#713F12]"
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
                className="border-2 border-[#18181B] rounded-xl overflow-hidden bg-white"
              >
                <div
                  onClick={() => setExpandedId(isOpen ? null : inv.id)}
                  className="p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-[#FAF9F5] transition-colors"
                >
                  <div className="space-y-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#18181B]">
                        {inv.invoice_number}
                      </span>
                      {inv.sale_order_number && (
                        <span className="px-2 py-0.5 rounded bg-[#E0E7FF] border border-[#18181B] font-mono font-bold text-[10px] text-[#3730A3]">
                          SO: {inv.sale_order_number}
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded bg-[#DCFCE7] border border-[#18181B] font-mono font-bold text-[10px] text-[#166534]">
                        {inv.items_count} SKUs • {inv.total_units} pcs
                      </span>
                    </div>
                    <div className="text-xs font-bold text-[#52525B]">
                      {inv.supplier}
                      {inv.source_filename ? ` • ${inv.source_filename}` : ''}
                    </div>
                  </div>

                  {/* Order Date & Arrival Time */}
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <div className="px-2.5 py-1.5 rounded-lg border border-[#18181B] bg-[#FEF9C3]">
                      <div className="flex items-center gap-1 text-[10px] font-black uppercase text-[#713F12]">
                        <Calendar className="w-3 h-3" /> Order Date
                      </div>
                      <div className="font-mono font-bold text-[#18181B]">
                        {formatDateOnly(inv.order_date)}
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5 rounded-lg border border-[#18181B] bg-[#DCFCE7]">
                      <div className="flex items-center gap-1 text-[10px] font-black uppercase text-[#166534]">
                        <Clock className="w-3 h-3" /> Arrival / Delivery
                      </div>
                      <div className="font-mono font-bold text-[#18181B]">
                        {formatDateTime(inv.delivery_arrival_time || inv.received_date)}
                      </div>
                    </div>

                    <div className="text-right min-w-[90px]">
                      <div className="text-[10px] font-black uppercase text-[#71717A]">Total</div>
                      <div className="font-mono font-black text-sm text-[#18181B]">
                        {inv.currency === 'INR' ? '₹' : `${inv.currency} `}
                        {inv.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    <div className="text-[#18181B]">
                      {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Drawer Pills Strip */}
                <div className="px-4 py-2 bg-[#FAF9F5] border-t border-[#E4E4E7] flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="flex items-center gap-1 font-bold text-[#52525B] mr-1">
                    <Layers className="w-3 h-3" /> Compartments:
                  </span>
                  {inv.drawers_used.length > 0 ? (
                    inv.drawers_used.map((dId) => (
                      <button
                        key={dId}
                        type="button"
                        onClick={() => onOpenDrawerModal(dId)}
                        className="font-mono font-black px-2 py-0.5 rounded border border-[#18181B] bg-[#FEF08A] hover:bg-[#FDE047] text-[10px]"
                      >
                        {dId}
                      </button>
                    ))
                  ) : (
                    <span className="text-[#71717A] italic">None</span>
                  )}
                </div>

                {/* Expanded Line Items */}
                {isOpen && (
                  <div className="border-t-2 border-[#18181B] overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F4F4F5] border-b border-[#18181B] text-[10px] font-black uppercase text-[#18181B]">
                          <th className="py-2 px-3">SKU</th>
                          <th className="py-2 px-3">COMPONENT NAME</th>
                          <th className="py-2 px-3">HSN</th>
                          <th className="py-2 px-3 text-right">QTY</th>
                          <th className="py-2 px-3 text-center">COMPARTMENT</th>
                          <th className="py-2 px-3 text-right">UNIT ₹</th>
                          <th className="py-2 px-3 text-right">LINE TOTAL ₹</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E4E4E7] bg-white">
                        {inv.items.map((it) => (
                          <tr key={it.id} className="hover:bg-[#FAF9F5]">
                            <td className="py-2 px-3 font-mono font-bold text-[#18181B]">
                              {it.sku}
                            </td>
                            <td className="py-2 px-3 font-semibold text-[#18181B]">
                              {it.item_name || it.sku}
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-[#71717A]">
                              {it.hsn_code || '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-black text-[#166534]">
                              {it.quantity}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {it.drawer_id ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenDrawerModal(it.drawer_id!)}
                                  className="font-mono font-bold px-2 py-0.5 rounded border border-[#18181B] bg-[#FEF08A] hover:bg-[#FDE047] text-[10px]"
                                >
                                  {it.drawer_id}
                                </button>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {it.unit_price.toFixed(2)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold">
                              {it.line_total.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
