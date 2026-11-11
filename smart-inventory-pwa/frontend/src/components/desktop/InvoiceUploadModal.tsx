import React, { useState, useRef } from 'react';
import {
  DrawerSummary,
  ParsedInvoiceResponse,
  ParsedInvoiceItem,
  InvoiceCommitItemPayload,
} from '../../types/inventory';
import { parseInvoiceFile, commitInvoice } from '../../api/client';
import {
  X,
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Layers,
  Grid,
  Plus,
  Minus,
} from 'lucide-react';

interface InvoiceUploadModalProps {
  isOpen: boolean;
  drawers: DrawerSummary[];
  onClose: () => void;
  onRefresh: () => void;
  onNotice: (msg: string) => void;
}

interface ReviewRow extends ParsedInvoiceItem {
  selected: boolean;
  assignedDrawer: string;
}

const CATEGORIES = [
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

const getLocalDateTimeString = () => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}`;
};

export const InvoiceUploadModal: React.FC<InvoiceUploadModalProps> = ({
  isOpen,
  drawers,
  onClose,
  onRefresh,
  onNotice,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<'UPLOAD' | 'REVIEW'>('UPLOAD');
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Parsed metadata (editable before commit)
  const [parsedDoc, setParsedDoc] = useState<ParsedInvoiceResponse | null>(null);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [saleOrderNumber, setSaleOrderNumber] = useState('');
  const [orderDate, setOrderDate] = useState('');
  const [deliveryTime, setDeliveryTime] = useState(getLocalDateTimeString());
  const [allowDuplicateAppend, setAllowDuplicateAppend] = useState(false);
  const [notes, setNotes] = useState('');

  // Editable review rows
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [bulkDrawer, setBulkDrawer] = useState('S01');
  const [pickerRowIdx, setPickerRowIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const allDrawerIds =
    drawers.length > 0
      ? drawers.map((d) => d.id)
      : [
          ...Array.from({ length: 30 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`),
          ...Array.from({ length: 9 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`),
        ];

  const drawerMap = new Map(drawers.map((d) => [d.id, d]));

  const resetModal = () => {
    setStep('UPLOAD');
    setParsedDoc(null);
    setRows([]);
    setErrorMsg(null);
    setAllowDuplicateAppend(false);
    setPickerRowIdx(null);
    setNotes('');
  };

  const handleClose = () => {
    if (parsing || committing) return;
    resetModal();
    onClose();
  };

  const processSelectedFile = async (file: File) => {
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

      const initialRows: ReviewRow[] = data.items.map((it) => ({
        ...it,
        selected: true,
        assignedDrawer: it.suggested_drawer_id || '',
      }));
      setRows(initialRows);
      setStep('REVIEW');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to parse document.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processSelectedFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processSelectedFile(file);
  };

  const updateRow = (index: number, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r, idx) => (idx === index ? { ...r, ...patch } : r)));
  };

  const applyDrawerToAllUnassigned = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected && !r.assignedDrawer ? { ...r, assignedDrawer: bulkDrawer } : r))
    );
  };

  const applyDrawerToAllSelected = () => {
    setRows((prev) =>
      prev.map((r) => (r.selected ? { ...r, assignedDrawer: bulkDrawer } : r))
    );
  };

  const selectedRows = rows.filter((r) => r.selected);
  const assignedCount = selectedRows.filter((r) => r.assignedDrawer.trim().length > 0).length;
  const unassignedCount = selectedRows.length - assignedCount;
  const totalUnitsToCommit = selectedRows.reduce((acc, r) => acc + Math.max(0, r.quantity), 0);

  const handleCommit = async () => {
    setErrorMsg(null);
    if (!invoiceNumber.trim()) {
      setErrorMsg('Invoice number is required.');
      return;
    }
    if (selectedRows.length === 0) {
      setErrorMsg('Select at least one component to log into inventory.');
      return;
    }
    if (unassignedCount > 0) {
      setErrorMsg(
        `${unassignedCount} selected component(s) do not have a cabinet compartment assigned yet. Choose a drawer (S01-S30 or L01-L09) for every selected item.`
      );
      return;
    }
    const badQty = selectedRows.find((r) => !Number.isFinite(r.quantity) || r.quantity <= 0);
    if (badQty) {
      setErrorMsg(`Quantity must be at least 1 for SKU ${badQty.sku}.`);
      return;
    }

    const commitItems: InvoiceCommitItemPayload[] = selectedRows.map((r) => ({
      sku: r.sku.trim().toUpperCase(),
      name: r.name.trim() || r.sku,
      category: r.category || 'General',
      quantity: Math.round(r.quantity),
      unit: r.unit || 'pcs',
      unit_price: r.effective_unit_cost || r.unit_price || 0,
      drawer_id: r.assignedDrawer.trim().toUpperCase(),
      sub_tray: 'MAIN',
      hsn_code: r.hsn_code || null,
      tax_rate: r.tax_rate || 0,
      line_total: r.line_total || round2((r.effective_unit_cost || r.unit_price) * r.quantity),
    }));

    setCommitting(true);
    try {
      const res = await commitInvoice({
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
        notes: notes.trim() || undefined,
        allow_duplicate_append: allowDuplicateAppend,
        items: commitItems,
      });

      onNotice(res.message);
      onRefresh();
      resetModal();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to log invoice into database.');
    } finally {
      setCommitting(false);
    }
  };

  const smallDrawers = Array.from({ length: 30 }, (_, i) => `S${String(i + 1).padStart(2, '0')}`);
  const largeDrawers = Array.from({ length: 9 }, (_, i) => `L${String(i + 1).padStart(2, '0')}`);

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="brutal-card bg-white w-full max-w-6xl p-6 relative max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#18181B]" />
            </div>
            <div>
              <h3 className="text-base font-black uppercase text-[#18181B] tracking-tight">
                Upload Invoice / Packing Document
              </h3>
              <p className="text-xs text-[#71717A] font-semibold">
                Auto-extracts component Name, SKU, Quantity, Order Date & Delivery Time from PDF, DOCX, CSV, TXT, or JSON
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
          >
            <X className="w-4 h-4 text-[#18181B]" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-[#FEE2E2] border-2 border-[#B91C1C] rounded-xl text-xs font-bold text-[#991B1B] flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* STEP 1: UPLOAD */}
        {step === 'UPLOAD' && (
          <div className="flex-1 flex flex-col justify-center py-6">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.csv,.tsv,.txt,.json"
              onChange={handleFileChange}
              className="hidden"
            />
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => !parsing && fileInputRef.current?.click()}
              className={`border-3 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                dragActive
                  ? 'border-[#18181B] bg-[#DCFCE7]'
                  : 'border-[#18181B] bg-[#FAF9F5] hover:bg-[#FEF9C3]'
              }`}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#86EFAC] border-2 border-[#18181B] shadow-[3px_3px_0px_#18181B] flex items-center justify-center">
                <Upload className="w-8 h-8 text-[#064E3B]" />
              </div>

              {parsing ? (
                <div className="space-y-2">
                  <div className="text-base font-black text-[#18181B] uppercase">
                    Extracting Component Table & Invoice Dates...
                  </div>
                  <p className="text-xs text-[#52525B] font-semibold">
                    Analyzing spatial columns, part SKUs, HSN boundaries, tax totals, and order date
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-base font-black text-[#18181B] uppercase">
                    Drop Invoice PDF / Document Here or Click to Browse
                  </div>
                  <p className="text-xs text-[#52525B] font-semibold max-w-xl mx-auto">
                    Supports Robu.in, Mouser, DigiKey, LCSC, Amazon Business & custom component invoices in{' '}
                    <span className="font-mono font-bold text-[#18181B]">.PDF, .DOCX, .CSV, .TXT, .JSON</span>
                  </p>
                  <div className="pt-3">
                    <span className="inline-flex items-center gap-2 brutal-btn brutal-btn-mint text-xs py-2 px-5">
                      <Upload className="w-4 h-4" /> Choose Invoice File
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl border-2 border-[#18181B] bg-white">
                <div className="font-black text-[#18181B] uppercase mb-1">1. Auto-Extract</div>
                <p className="text-[#52525B] font-medium">
                  Reads Name, SKU, Quantity, Unit Cost & Order Date straight from multi-page invoices, skipping shipping fees.
                </p>
              </div>
              <div className="p-3 rounded-xl border-2 border-[#18181B] bg-white">
                <div className="font-black text-[#18181B] uppercase mb-1">2. Confirm Qty & Compartment</div>
                <p className="text-[#52525B] font-medium">
                  Prompts only for final physical Quantity check and which Stanley drawer (S01–S30, L01–L09) each item enters.
                </p>
              </div>
              <div className="p-3 rounded-xl border-2 border-[#18181B] bg-white">
                <div className="font-black text-[#18181B] uppercase mb-1">3. Atomic Audit Log</div>
                <p className="text-[#52525B] font-medium">
                  Logs all items, stock lots, invoice record, Order Date & Delivery/Arrival Time in one database commit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: REVIEW & ASSIGN */}
        {step === 'REVIEW' && parsedDoc && (
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Extracted Document Metadata */}
            <div className="p-4 rounded-xl border-2 border-[#18181B] bg-[#FAF9F5]">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-[#DDD6FE] border border-[#18181B] font-mono font-black text-[10px] text-[#4C1D95]">
                    {parsedDoc.file_type} • {parsedDoc.filename}
                  </span>
                  {parsedDoc.total_amount > 0 && (
                    <span className="px-2 py-0.5 rounded bg-[#DCFCE7] border border-[#18181B] font-mono font-bold text-[10px] text-[#166534]">
                      Subtotal {parsedDoc.currency} {parsedDoc.subtotal_amount.toFixed(2)} + Tax{' '}
                      {parsedDoc.tax_amount.toFixed(2)} = Total {parsedDoc.total_amount.toFixed(2)}
                    </span>
                  )}
                  {parsedDoc.skipped_fee_rows.length > 0 && (
                    <span
                      className="px-2 py-0.5 rounded bg-[#FEF08A] border border-[#18181B] font-mono font-bold text-[10px] text-[#713F12]"
                      title={parsedDoc.skipped_fee_rows.map((f) => f.name).join(', ')}
                    >
                      {parsedDoc.skipped_fee_rows.length} fee/shipping row skipped
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => resetModal()}
                  className="text-xs font-bold underline text-[#18181B] hover:text-[#065F46]"
                >
                  Upload a different file
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#52525B] mb-1">
                    Supplier
                  </label>
                  <input
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-[#18181B] bg-white text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#52525B] mb-1">
                    Invoice # *
                  </label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-[#18181B] bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-[#52525B] mb-1">
                    Sale Order #
                  </label>
                  <input
                    type="text"
                    value={saleOrderNumber}
                    onChange={(e) => setSaleOrderNumber(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-[#18181B] bg-white text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-black uppercase text-[#18181B] mb-1">
                    <Calendar className="w-3 h-3" /> Order Date
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-[#18181B] bg-[#FEF9C3] text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-[10px] font-black uppercase text-[#18181B] mb-1">
                    <Clock className="w-3 h-3" /> Delivery / Arrival Time
                  </label>
                  <input
                    type="datetime-local"
                    value={deliveryTime}
                    onChange={(e) => setDeliveryTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border-2 border-[#18181B] bg-[#DCFCE7] text-xs font-mono font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Warnings & Duplicate Check */}
            {(parsedDoc.warnings.length > 0 || parsedDoc.already_logged) && (
              <div className="p-3 rounded-xl border-2 border-[#D97706] bg-[#FEF3C7] text-xs text-[#92400E] space-y-1.5">
                {parsedDoc.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </div>
                ))}
                {parsedDoc.already_logged && (
                  <label className="flex items-center gap-2 pt-1 font-black cursor-pointer text-[#78350F]">
                    <input
                      type="checkbox"
                      checked={allowDuplicateAppend}
                      onChange={(e) => setAllowDuplicateAppend(e.target.checked)}
                      className="w-4 h-4 accent-[#18181B]"
                    />
                    <span>
                      Append another batch to existing invoice {invoiceNumber} anyway
                    </span>
                  </label>
                )}
              </div>
            )}

            {/* Quick Bulk Assignment Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl border-2 border-[#18181B] bg-white">
              <div className="flex items-center gap-2 text-xs font-black text-[#18181B]">
                <Layers className="w-4 h-4 text-[#065F46]" />
                <span>
                  {assignedCount} / {selectedRows.length} Compartments Assigned • {totalUnitsToCommit} Total Units
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold text-[#52525B]">Quick Compartment Fill:</span>
                <select
                  value={bulkDrawer}
                  onChange={(e) => setBulkDrawer(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] text-xs font-mono font-bold"
                >
                  {allDrawerIds.map((id) => (
                    <option key={id} value={id}>
                      {id} ({id.startsWith('L') ? 'Large' : 'Small'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={applyDrawerToAllUnassigned}
                  className="px-2.5 py-1 rounded-lg border-2 border-[#18181B] bg-[#FEF08A] hover:bg-[#FDE047] text-[11px] font-black"
                >
                  Fill Unassigned ({unassignedCount})
                </button>
                <button
                  type="button"
                  onClick={applyDrawerToAllSelected}
                  className="px-2.5 py-1 rounded-lg border-2 border-[#18181B] bg-[#F4F4F5] hover:bg-[#E4E4E7] text-[11px] font-bold"
                >
                  Set All ({selectedRows.length})
                </button>
              </div>
            </div>

            {/* Extracted Component Table */}
            <div className="overflow-x-auto border-2 border-[#18181B] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b-2 border-[#18181B] text-[10px] font-black uppercase text-[#18181B]">
                    <th className="py-2.5 px-3 w-8 text-center">LOG</th>
                    <th className="py-2.5 px-3 min-w-[110px]">SKU</th>
                    <th className="py-2.5 px-3 min-w-[260px]">COMPONENT NAME & CATEGORY</th>
                    <th className="py-2.5 px-3 min-w-[135px] bg-[#FEF9C3] border-x border-[#18181B]">
                      QUANTITY *
                    </th>
                    <th className="py-2.5 px-3 min-w-[205px] bg-[#DCFCE7] border-r border-[#18181B]">
                      COMPARTMENT (DRAWER) *
                    </th>
                    <th className="py-2.5 px-3 text-right min-w-[85px]">UNIT ₹</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#18181B] bg-white">
                  {rows.map((row, idx) => {
                    const missingDrawer = row.selected && !row.assignedDrawer;
                    return (
                      <tr
                        key={`${row.line_no}-${row.sku}`}
                        className={!row.selected ? 'opacity-45 bg-[#F4F4F5]' : 'hover:bg-[#FBF9F5]'}
                      >
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => updateRow(idx, { selected: e.target.checked })}
                            className="w-4 h-4 accent-[#18181B] cursor-pointer"
                          />
                        </td>

                        <td className="py-2.5 px-3">
                          <input
                            type="text"
                            value={row.sku}
                            disabled={!row.selected}
                            onChange={(e) =>
                              updateRow(idx, { sku: e.target.value.toUpperCase() })
                            }
                            className="w-full px-2 py-1 rounded border border-[#18181B] font-mono font-bold text-xs bg-[#FAFAFA]"
                          />
                          {row.hsn_code && (
                            <div className="text-[10px] font-mono text-[#71717A] mt-0.5">
                              HSN {row.hsn_code}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 space-y-1.5">
                          <input
                            type="text"
                            value={row.name}
                            disabled={!row.selected}
                            onChange={(e) => updateRow(idx, { name: e.target.value })}
                            className="w-full px-2 py-1 rounded border border-[#18181B] font-semibold text-xs bg-white"
                          />
                          <div className="flex items-center gap-2">
                            <select
                              value={row.category}
                              disabled={!row.selected}
                              onChange={(e) => updateRow(idx, { category: e.target.value })}
                              className="px-2 py-0.5 rounded border border-[#18181B] bg-[#FAF9F5] text-[10px] font-bold"
                            >
                              {CATEGORIES.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                            {row.existing_drawers.length > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-[#DBEAFE] border border-[#3B82F6] text-[#1E40AF] text-[10px] font-bold">
                                In stock: {row.existing_drawers.join(', ')}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Prompted Quantity */}
                        <td className="py-2.5 px-3 bg-[#FEFCE8] border-x border-[#18181B]">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!row.selected || row.quantity <= 1}
                              onClick={() =>
                                updateRow(idx, { quantity: Math.max(1, row.quantity - 1) })
                              }
                              className="w-7 h-7 rounded border-2 border-[#18181B] bg-white flex items-center justify-center hover:bg-[#FEF08A] disabled:opacity-40"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              disabled={!row.selected}
                              value={row.quantity}
                              onChange={(e) =>
                                updateRow(idx, {
                                  quantity: Math.max(1, parseInt(e.target.value) || 1),
                                })
                              }
                              className="w-16 text-center py-1 rounded border-2 border-[#18181B] bg-white font-mono font-black text-sm"
                            />
                            <button
                              type="button"
                              disabled={!row.selected}
                              onClick={() => updateRow(idx, { quantity: row.quantity + 1 })}
                              className="w-7 h-7 rounded border-2 border-[#18181B] bg-white flex items-center justify-center hover:bg-[#FEF08A]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>

                        {/* Prompted Compartment / Drawer */}
                        <td
                          className={`py-2.5 px-3 border-r border-[#18181B] ${
                            missingDrawer ? 'bg-[#FEE2E2]' : 'bg-[#F0FDF4]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <select
                              disabled={!row.selected}
                              value={row.assignedDrawer}
                              onChange={(e) =>
                                updateRow(idx, { assignedDrawer: e.target.value })
                              }
                              className={`flex-1 px-2 py-1.5 rounded-lg border-2 font-mono font-black text-xs ${
                                missingDrawer
                                  ? 'border-[#B91C1C] bg-white text-[#991B1B]'
                                  : 'border-[#18181B] bg-white text-[#18181B]'
                              }`}
                            >
                              <option value="">-- Select Drawer --</option>
                              {allDrawerIds.map((dId) => {
                                const info = drawerMap.get(dId);
                                const tag = info
                                  ? `${dId} (${info.drawer_type === 'LARGE' ? 'L' : 'S'}, ${
                                      info.total_units
                                    }u)`
                                  : dId;
                                return (
                                  <option key={dId} value={dId}>
                                    {tag}
                                  </option>
                                );
                              })}
                            </select>

                            <button
                              type="button"
                              disabled={!row.selected}
                              onClick={() => setPickerRowIdx(pickerRowIdx === idx ? null : idx)}
                              className="p-1.5 rounded-lg border-2 border-[#18181B] bg-[#FEF08A] hover:bg-[#FDE047]"
                              title="Pick from 39-compartment visual cabinet grid"
                            >
                              <Grid className="w-3.5 h-3.5 text-[#18181B]" />
                            </button>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            disabled={!row.selected}
                            value={row.effective_unit_cost}
                            onChange={(e) =>
                              updateRow(idx, {
                                effective_unit_cost: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-20 text-right px-1.5 py-1 rounded border border-[#18181B] bg-[#FAFAFA] font-mono text-xs"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Interactive 39-Compartment Mini Cabinet Popover for Active Row */}
            {pickerRowIdx !== null && rows[pickerRowIdx] && (
              <div className="p-4 rounded-xl border-2 border-[#18181B] bg-[#FFFBEB] shadow-[4px_4px_0px_#18181B]">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-black uppercase text-[#18181B]">
                    Select Stanley Compartment for{' '}
                    <span className="font-mono bg-[#FEF08A] px-2 py-0.5 rounded border border-[#18181B]">
                      {rows[pickerRowIdx].sku}
                    </span>{' '}
                    <span className="font-semibold text-[#52525B] normal-case">
                      ({rows[pickerRowIdx].name.slice(0, 50)})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerRowIdx(null)}
                    className="text-xs font-black underline"
                  >
                    Close Grid
                  </button>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="text-[10px] font-black uppercase text-[#52525B] mb-1">
                      Small Compartments (S01 – S30)
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                      {smallDrawers.map((dId) => {
                        const info = drawerMap.get(dId);
                        const isSelected = rows[pickerRowIdx].assignedDrawer === dId;
                        const hasItems = (info?.total_units || 0) > 0;
                        return (
                          <button
                            key={dId}
                            type="button"
                            onClick={() => {
                              updateRow(pickerRowIdx, { assignedDrawer: dId });
                              setPickerRowIdx(null);
                            }}
                            className={`py-1.5 px-1 rounded-lg border-2 text-center font-mono text-[11px] font-black transition-all ${
                              isSelected
                                ? 'bg-[#18181B] text-[#86EFAC] border-[#18181B]'
                                : hasItems
                                ? 'bg-[#DCFCE7] text-[#166534] border-[#18181B] hover:bg-[#86EFAC]'
                                : 'bg-white text-[#18181B] border-[#18181B] hover:bg-[#FEF08A]'
                            }`}
                          >
                            {dId}
                            {hasItems ? `·${info?.total_units}` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-black uppercase text-[#52525B] mb-1">
                      Large Compartments (L01 – L09)
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-9 gap-1.5">
                      {largeDrawers.map((dId) => {
                        const info = drawerMap.get(dId);
                        const isSelected = rows[pickerRowIdx].assignedDrawer === dId;
                        const hasItems = (info?.total_units || 0) > 0;
                        return (
                          <button
                            key={dId}
                            type="button"
                            onClick={() => {
                              updateRow(pickerRowIdx, { assignedDrawer: dId });
                              setPickerRowIdx(null);
                            }}
                            className={`py-2 px-1 rounded-lg border-2 text-center font-mono text-xs font-black transition-all ${
                              isSelected
                                ? 'bg-[#18181B] text-[#86EFAC] border-[#18181B]'
                                : hasItems
                                ? 'bg-[#FEF08A] text-[#713F12] border-[#18181B] hover:bg-[#FDE047]'
                                : 'bg-white text-[#18181B] border-[#18181B] hover:bg-[#FEF08A]'
                            }`}
                          >
                            {dId}
                            {hasItems ? ` (${info?.total_units})` : ''}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-black uppercase text-[#52525B] mb-1">
                Optional Audit Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Received via BlueDart courier, verified physically"
                className="w-full px-3 py-1.5 rounded-lg border-2 border-[#18181B] text-xs bg-[#FAFAFA]"
              />
            </div>
          </div>
        )}

        {/* Sticky Footer */}
        {step === 'REVIEW' && (
          <div className="pt-4 mt-4 border-t-2 border-[#18181B] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="text-xs font-semibold text-[#52525B]">
              {unassignedCount > 0 ? (
                <span className="text-[#B91C1C] font-black">
                  Assign compartments to the remaining {unassignedCount} item(s) to enable logging.
                </span>
              ) : (
                <span className="text-[#166534] font-black">
                  Ready to log {selectedRows.length} component(s) ({totalUnitsToCommit} units) with Order Date{' '}
                  {orderDate || 'N/A'} & Arrival {deliveryTime.replace('T', ' ')}.
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                disabled={committing}
                className="brutal-btn brutal-btn-white text-xs py-2 px-4"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={committing || selectedRows.length === 0 || unassignedCount > 0}
                className="brutal-btn brutal-btn-mint text-xs py-2 px-5 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {committing
                  ? 'Logging to Master DB...'
                  : `Log ${selectedRows.length} Component(s) (${totalUnitsToCommit} pcs)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
