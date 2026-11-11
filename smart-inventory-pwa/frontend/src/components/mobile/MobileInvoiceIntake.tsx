import React, { useState, useRef } from 'react';
import {
  DrawerSummary,
  ParsedInvoiceResponse,
  ParsedInvoiceItem,
  InvoiceCommitPayload,
} from '../../types/inventory';
import { parseInvoiceFile, commitInvoice } from '../../api/client';
import { enqueueOperation } from '../../db/offlineDb';
import {
  FileText,
  Upload,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Layers,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from 'lucide-react';

interface MobileInvoiceIntakeProps {
  drawers: DrawerSummary[];
  isOnline: boolean;
  userName: string;
  onCompleted: (message: string) => void;
  onSwitchToManual: () => void;
}

interface MobileReviewRow extends ParsedInvoiceItem {
  selected: boolean;
  assignedDrawer: string;
}

const getLocalDateTimeString = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
};

export const MobileInvoiceIntake: React.FC<MobileInvoiceIntakeProps> = ({
  drawers,
  isOnline,
  userName,
  onCompleted,
  onSwitchToManual,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [parsedDoc, setParsedDoc] = useState<ParsedInvoiceResponse | null>(null);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saleOrderNumber, setSaleOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState(getLocalDateTimeString());
  const [allowDuplicateAppend, setAllowDuplicateAppend] = useState(false);

  const [rows, setRows] = useState<MobileReviewRow[]>([]);
  const [expandedGridRow, setExpandedGridRow] = useState<number | null>(0);
  const [bulkDrawer, setBulkDrawer] = useState('S01');

  const drawerMap = new Map(drawers.map((d) => [d.id, d]));

  const resetAll = () => {
    setStep('UPLOAD');
    setParsedDoc(null);
    setRows([]);
    setErrorMsg(null);
    setExpandedGridRow(0);
    setAllowDuplicateAppend(false);
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setErrorMsg(null);
    setParsing(true);
    try {
      const data = await parseInvoiceFile(file);
      setParsedDoc(data);
      setSupplier(data.supplier || '');
      setInvoiceNumber(data.invoice_number || '');
      setSaleOrderNumber(data.sale_order_number || '');
      setOrderDate(data.order_date || '');
      setDeliveryTime(data.delivery_arrival_time || getLocalDateTimeString());
      setAllowDuplicateAppend(false);

      const mapped: MobileReviewRow[] = data.items.map((it) => ({
        ...it,
        selected: true,
        assignedDrawer: it.suggested_drawer_id || '',
      }));
      setRows(mapped);
      const firstUnassigned = mapped.findIndex((r) => !r.assignedDrawer);
      setExpandedGridRow(firstUnassigned >= 0 ? firstUnassigned : 0);
      setStep('REVIEW');
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'Could not extract components from this document. Ensure laptop server is reachable.'
      );
    } finally {
      setParsing(false);
    }
  };

  const updateRow = (idx: number, patch: Partial<MobileReviewRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const selectedRows = rows.filter((r) => r.selected);
  const assignedCount = selectedRows.filter((r) => r.assignedDrawer.trim().length > 0).length;
  const unassignedCount = selectedRows.length - assignedCount;
  const totalUnits = selectedRows.reduce((acc, r) => acc + Math.max(0, r.quantity), 0);

  const handleApplyUnassigned = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected && !r.assignedDrawer ? { ...r, assignedDrawer: bulkDrawer } : r))
    );
    setExpandedGridRow(null);
  };

  const handleCommit = async () => {
    setErrorMsg(null);
    if (!invoiceNumber.trim()) {
      setErrorMsg('Invoice number is required.');
      return;
    }
    if (selectedRows.length === 0) {
      setErrorMsg('Select at least one component to log.');
      return;
    }
    if (unassignedCount > 0) {
      const firstIdx = rows.findIndex((r) => r.selected && !r.assignedDrawer);
      if (firstIdx >= 0) setExpandedGridRow(firstIdx);
      setErrorMsg(`Please select a compartment for the remaining ${unassignedCount} item(s).`);
      return;
    }

    const payload: InvoiceCommitPayload = {
      invoice_number: invoiceNumber.trim(),
      sale_order_number: saleOrderNumber.trim() || null,
      supplier: supplier.trim() || 'Unknown Vendor',
      order_date: orderDate ? `${orderDate}T00:00:00` : null,
      delivery_arrival_time: deliveryTime || getLocalDateTimeString(),
      currency: parsedDoc?.currency || 'INR',
      subtotal_amount: parsedDoc?.subtotal_amount || 0,
      tax_amount: parsedDoc?.tax_amount || 0,
      total_amount: parsedDoc?.total_amount || 0,
      source_filename: parsedDoc?.filename || null,
      notes: `Uploaded via mobile PWA by ${userName}`,
      allow_duplicate_append: allowDuplicateAppend,
      items: selectedRows.map((r) => ({
        sku: r.sku.trim().toUpperCase(),
        name: r.name.trim() || r.sku,
        category: r.category || 'General',
        quantity: Math.max(1, Math.round(r.quantity)),
        unit: r.unit || 'pcs',
        unit_price: r.effective_unit_cost || r.unit_price || 0,
        drawer_id: r.assignedDrawer.trim().toUpperCase(),
        sub_tray: 'MAIN',
        hsn_code: r.hsn_code || null,
        tax_rate: r.tax_rate || 0,
        line_total: r.line_total || 0,
      })),
    };

    setCommitting(true);
    if (isOnline) {
      try {
        const res = await commitInvoice(payload);
        resetAll();
        onCompleted(`Confirmed: ${res.message}`);
      } catch (err: any) {
        setErrorMsg(err?.message || 'Failed to commit invoice to master server.');
      } finally {
        setCommitting(false);
      }
    } else {
      try {
        const queuedOp = await enqueueOperation('INVOICE_COMMIT', payload);
        resetAll();
        onCompleted(
          `Pending Sync: Invoice queued in IndexedDB (${queuedOp.client_op_id.slice(
            0,
            8
          )}...). Will commit when server connects.`
        );
      } catch (err: any) {
        setErrorMsg(`Offline queue failed: ${err?.message}`);
      } finally {
        setCommitting(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F6F1] overflow-y-auto p-4 select-none text-[#18181B]">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center">
            <FileText className="w-4 h-4 text-[#18181B]" />
          </div>
          <span className="text-xs font-black uppercase tracking-tight">Invoice Auto-Logger</span>
        </div>

        <button
          type="button"
          onClick={onSwitchToManual}
          className="text-[11px] font-black underline text-[#4C1D95]"
        >
          Manual Intake →
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#991B1B] flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: MOBILE FILE PICKER */}
      {step === 'UPLOAD' && (
        <div className="space-y-4 pb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.csv,.tsv,.txt,.json"
            onChange={handleFileSelected}
            className="hidden"
          />

          <div className="bg-white p-5 rounded-2xl border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#86EFAC] border-2 border-[#18181B] flex items-center justify-center shadow-[2px_2px_0px_#18181B]">
              <Upload className="w-7 h-7 text-[#064E3B]" />
            </div>

            <div>
              <h2 className="text-sm font-black uppercase text-[#18181B]">
                Upload Component Invoice (PDF / Doc)
              </h2>
              <p className="text-xs text-[#52525B] font-medium mt-1">
                Extracts component Name, SKU, Quantity, Order Date & Delivery Time directly from Robu.in, Mouser, DigiKey PDFs, DOCX, or CSV.
              </p>
            </div>

            {!isOnline && (
              <div className="p-2.5 rounded-xl bg-[#FEF3C7] border border-[#D97706] text-[11px] font-bold text-[#92400E]">
                Note: Parsing a PDF document requires connection to your Windows laptop server.
              </div>
            )}

            <button
              type="button"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full brutal-btn brutal-btn-mint py-3 text-xs font-black uppercase text-[#064E3B] shadow-[2px_2px_0px_#18181B] flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {parsing ? 'Extracting Components...' : 'Choose PDF / Document from Phone'}
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl border-2 border-[#18181B] space-y-2 text-xs">
            <div className="font-black uppercase text-[#18181B] text-[11px]">How It Works</div>
            <div className="text-[#52525B] font-medium">1. Pick your downloaded invoice PDF/DOCX/CSV file.</div>
            <div className="text-[#52525B] font-medium">2. Review extracted Name, SKU & Order Date.</div>
            <div className="text-[#52525B] font-medium">
              3. Confirm <strong>Quantity</strong> & tap the <strong>Stanley Compartment (S01–L09)</strong> for each part!
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MOBILE REVIEW CARDS */}
      {step === 'REVIEW' && parsedDoc && (
        <div className="space-y-4 pb-8">
          {/* Header Metadata Card */}
          <div className="bg-white p-3.5 rounded-2xl border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[#E4E4E7]">
              <div>
                <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-[#DDD6FE] border border-[#18181B]">
                  {parsedDoc.file_type} • {rows.length} ITEMS
                </span>
                {parsedDoc.skipped_fee_rows.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#FEF08A] border border-[#18181B]">
                    {parsedDoc.skipped_fee_rows.length} shipping skipped
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="flex items-center gap-1 text-[11px] font-bold underline"
              >
                <RotateCcw className="w-3 h-3" /> Change File
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-black uppercase text-[#52525B] mb-0.5">
                  Supplier
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-bold bg-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase text-[#52525B] mb-0.5">
                  Invoice # *
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-mono font-bold bg-[#FAFAFA]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[9px] font-black uppercase text-[#713F12] mb-0.5">
                  <Calendar className="w-2.5 h-2.5" /> Order Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-[#18181B] text-xs font-mono font-bold bg-[#FEF9C3]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[9px] font-black uppercase text-[#166534] mb-0.5">
                  <Clock className="w-2.5 h-2.5" /> Delivery / Arrival
                </label>
                <input
                  type="datetime-local"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full p-2 rounded-lg border-2 border-[#18181B] text-[11px] font-mono font-bold bg-[#DCFCE7]"
                />
              </div>
            </div>
          </div>

          {parsedDoc.already_logged && (
            <div className="p-3 rounded-xl bg-[#FEF3C7] border-2 border-[#D97706] text-xs text-[#92400E] space-y-1">
              <div className="font-bold">Invoice {invoiceNumber} was already logged previously.</div>
              <label className="flex items-center gap-2 font-black">
                <input
                  type="checkbox"
                  checked={allowDuplicateAppend}
                  onChange={(e) => setAllowDuplicateAppend(e.target.checked)}
                />
                <span>Append another batch anyway</span>
              </label>
            </div>
          )}

          {/* Quick Fill Unassigned Bar */}
          {unassignedCount > 0 && (
            <div className="bg-white p-3 rounded-xl border-2 border-[#18181B] flex items-center justify-between gap-2 text-xs">
              <span className="font-black text-[#18181B] flex items-center gap-1">
                <Layers className="w-3.5 h-3.5" /> {unassignedCount} unassigned
              </span>
              <div className="flex items-center gap-1.5">
                <select
                  value={bulkDrawer}
                  onChange={(e) => setBulkDrawer(e.target.value)}
                  className="px-2 py-1 rounded border-2 border-[#18181B] font-mono font-bold text-xs bg-[#FAFAFA]"
                >
                  {drawers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.id}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleApplyUnassigned}
                  className="px-2.5 py-1 rounded-lg border-2 border-[#18181B] bg-[#FEF08A] font-black text-[11px]"
                >
                  Fill All
                </button>
              </div>
            </div>
          )}

          {/* Component Cards: Prompt Qty + Compartment */}
          {rows.map((row, idx) => {
            const isGridOpen = expandedGridRow === idx;
            const missingDrawer = row.selected && !row.assignedDrawer;
            return (
              <div
                key={`${row.line_no}-${row.sku}`}
                className={`bg-white p-3.5 rounded-2xl border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] space-y-2.5 ${
                  !row.selected ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                      className="mt-1 w-4 h-4 accent-[#18181B] shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-black text-xs px-1.5 py-0.5 rounded bg-[#FAF9F5] border border-[#18181B]">
                          {row.sku}
                        </span>
                        <span className="text-[10px] font-bold text-[#71717A] uppercase">
                          {row.category}
                        </span>
                        {row.existing_drawers.length > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DBEAFE] text-[#1E40AF]">
                            In {row.existing_drawers.join(',')}
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-bold text-[#18181B] mt-1 leading-snug">
                        {row.name}
                      </div>
                    </div>
                  </div>
                </div>

                {row.selected && (
                  <>
                    {/* Quantity Stepper + Compartment Button */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-xl bg-[#FEF9C3] border-2 border-[#18181B]">
                        <div className="text-[9px] font-black uppercase text-[#713F12] mb-1">
                          Quantity *
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateRow(idx, { quantity: Math.max(1, row.quantity - 1) })
                            }
                            className="w-7 h-7 rounded-lg border-2 border-[#18181B] bg-white flex items-center justify-center"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={row.quantity}
                            onChange={(e) =>
                              updateRow(idx, {
                                quantity: Math.max(1, parseInt(e.target.value) || 1),
                              })
                            }
                            className="w-12 text-center py-0.5 rounded border border-[#18181B] bg-white font-mono font-black text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => updateRow(idx, { quantity: row.quantity + 1 })}
                            className="w-7 h-7 rounded-lg border-2 border-[#18181B] bg-white flex items-center justify-center"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedGridRow(isGridOpen ? null : idx)}
                        className={`p-2 rounded-xl border-2 border-[#18181B] text-left flex flex-col justify-between ${
                          missingDrawer ? 'bg-[#FEE2E2]' : 'bg-[#DCFCE7]'
                        }`}
                      >
                        <div className="text-[9px] font-black uppercase text-[#18181B] flex items-center justify-between w-full">
                          <span>Compartment *</span>
                          {isGridOpen ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="font-mono font-black text-sm mt-1">
                          {row.assignedDrawer ? `→ ${row.assignedDrawer}` : 'Tap to Pick'}
                        </div>
                      </button>
                    </div>

                    {/* Expandable 39-Drawer Tap Grid */}
                    {isGridOpen && (
                      <div className="grid grid-cols-6 gap-1 max-h-36 overflow-y-auto p-1.5 bg-[#FAFAFA] border-2 border-[#18181B] rounded-xl">
                        {drawers.map((d) => {
                          const info = drawerMap.get(d.id);
                          const isSelected = row.assignedDrawer === d.id;
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                updateRow(idx, { assignedDrawer: d.id });
                                const nextUnassigned = rows.findIndex(
                                  (r, rIdx) => rIdx > idx && r.selected && !r.assignedDrawer
                                );
                                setExpandedGridRow(nextUnassigned >= 0 ? nextUnassigned : null);
                              }}
                              className={`py-1.5 rounded-lg border font-mono font-black text-[11px] transition-all ${
                                isSelected
                                  ? 'bg-[#18181B] text-[#86EFAC] border-[#18181B]'
                                  : info?.is_occupied
                                  ? 'bg-[#FEF08A] text-[#18181B] border-[#18181B]'
                                  : 'bg-white text-[#52525B] border-[#D4D4D8]'
                              }`}
                            >
                              {d.id}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* Final Confirm Button */}
          <button
            type="button"
            disabled={committing || selectedRows.length === 0 || unassignedCount > 0}
            onClick={handleCommit}
            className="w-full brutal-btn brutal-btn-mint py-3.5 text-xs font-black uppercase text-[#064E3B] shadow-[3px_3px_0px_#18181B] disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" />
            {committing
              ? 'Logging Components...'
              : unassignedCount > 0
              ? `Assign ${unassignedCount} Compartment(s) to Continue`
              : `Confirm & Log ${selectedRows.length} Items (${totalUnits} pcs)`}
          </button>
        </div>
      )}
    </div>
  );
};
