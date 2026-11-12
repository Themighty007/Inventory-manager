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
  Package,
  Plus,
  Minus,
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
}

const getLocalDateTimeString = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
};

export const MobileInvoiceIntake: React.FC<MobileInvoiceIntakeProps> = ({
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

  const resetAll = () => {
    setStep('UPLOAD');
    setParsedDoc(null);
    setRows([]);
    setErrorMsg(null);
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
      }));
      setRows(mapped);
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
  const totalUnits = selectedRows.reduce((acc, r) => acc + Math.max(0, r.quantity), 0);

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
        drawer_id: null as any,
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
        onCompleted(`Saved to Yet to be Delivered: ${res.message}`);
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
    <div className="flex flex-col h-full bg-[#F8FAFC] overflow-y-auto p-4 select-none text-slate-800 pb-16">
      {/* Top Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center">
            <FileText className="w-4 h-4" />
          </div>
          <span className="text-xs font-display font-bold text-[#0B132B]">Invoice Auto-Logger</span>
        </div>

        <button
          type="button"
          onClick={onSwitchToManual}
          className="text-[11px] font-semibold text-[#00B4D8] hover:underline"
        >
          Manual Intake →
        </button>
      </div>

      {errorMsg && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-600 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
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

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center">
              <Upload className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-sm font-display font-bold text-[#0B132B]">
                Upload Component Invoice (PDF / Doc)
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Extracts component Name, SKU, Quantity, Order Date & Delivery Time directly from Robu.in, Mouser, DigiKey PDFs, DOCX, or CSV.
              </p>
            </div>

            {!isOnline && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] font-medium text-amber-700">
                Note: Parsing a PDF document requires connection to your Windows laptop server.
              </div>
            )}

            <button
              type="button"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="w-full btn-cyan py-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {parsing ? 'Extracting Components...' : 'Choose PDF / Document from Phone'}
            </button>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="font-bold text-[#0B132B] text-[11px] uppercase tracking-wider">How It Works</div>
            <div className="text-slate-500 font-medium">1. Pick your downloaded invoice PDF/DOCX/CSV file.</div>
            <div className="text-slate-500 font-medium">2. Review extracted Name, SKU, Quantity & Order Date.</div>
            <div className="text-slate-500 font-medium">
              3. Items are saved into <strong>"Yet to be Delivered"</strong>. You will scan and assign Stanley drawers when physical hardware arrives!
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: MOBILE REVIEW CARDS */}
      {step === 'REVIEW' && parsedDoc && (
        <div className="space-y-4 pb-8">
          {/* Header Metadata Card */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-200">
              <div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20">
                  {parsedDoc.file_type} • {rows.length} ITEMS
                </span>
                {parsedDoc.skipped_fee_rows.length > 0 && (
                  <span className="ml-1.5 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                    {parsedDoc.skipped_fee_rows.length} shipping skipped
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={resetAll}
                className="flex items-center gap-1 text-[11px] font-semibold text-[#00B4D8] hover:underline"
              >
                <RotateCcw className="w-3 h-3" /> Change File
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Supplier
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-semibold bg-white focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase text-slate-500 mb-0.5">
                  Invoice # *
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-bold bg-white focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-600 mb-0.5">
                  <Calendar className="w-2.5 h-2.5 text-[#00B4D8]" /> Order Date
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-semibold bg-white focus:outline-none focus:border-[#00B4D8]"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[9px] font-bold uppercase text-slate-600 mb-0.5">
                  <Clock className="w-2.5 h-2.5 text-[#2EC4B6]" /> Delivery / Arrival
                </label>
                <input
                  type="datetime-local"
                  value={deliveryTime}
                  onChange={(e) => setDeliveryTime(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-300 text-xs font-mono font-semibold bg-white focus:outline-none focus:border-[#2EC4B6]"
                />
              </div>
            </div>
          </div>

          {/* Staging Notice */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-[#00B4D8]" />
              <span className="font-semibold text-[#0B132B]">
                {selectedRows.length} Items • {totalUnits} Units
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Box: Yet to be Delivered
            </span>
          </div>

          {/* Item Cards List */}
          <div className="space-y-2.5">
            {rows.map((row, idx) => (
              <div
                key={`${row.line_no}-${row.sku}`}
                className={`bg-white rounded-2xl border transition-all p-3.5 space-y-2.5 ${
                  !row.selected ? 'opacity-40 border-slate-200' : 'border-slate-200 shadow-xs'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                      className="w-4 h-4 accent-[#00B4D8] cursor-pointer"
                    />
                    <div>
                      <span className="font-mono font-bold text-xs text-[#0B132B]">
                        {row.sku}
                      </span>
                      <div className="text-xs font-medium text-slate-600 line-clamp-1">
                        {row.name}
                      </div>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-[#00B4D8]/10 text-[#00B4D8] border-[#00B4D8]/20">
                    ₹{(row.effective_unit_cost || row.unit_price || 0).toFixed(2)}
                  </span>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-medium text-slate-500">Intake Quantity:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!row.selected || row.quantity <= 1}
                      onClick={() => updateRow(idx, { quantity: Math.max(1, row.quantity - 1) })}
                      className="w-7 h-7 rounded border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-600 disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      disabled={!row.selected}
                      value={row.quantity}
                      onChange={(e) =>
                        updateRow(idx, { quantity: Math.max(1, parseInt(e.target.value) || 1) })
                      }
                      className="w-14 text-center py-1 rounded border border-slate-300 font-mono font-bold text-xs"
                    />
                    <button
                      type="button"
                      disabled={!row.selected}
                      onClick={() => updateRow(idx, { quantity: row.quantity + 1 })}
                      className="w-7 h-7 rounded border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-600"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Commit Button */}
          <button
            type="button"
            disabled={committing || selectedRows.length === 0}
            onClick={handleCommit}
            className="w-full btn-cyan py-3.5 px-4 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-40"
          >
            <Package className="w-4 h-4" />
            <span>
              {committing
                ? 'Staging in Yet to be Delivered...'
                : `Save to Yet to be Delivered (${selectedRows.length} Items)`}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
