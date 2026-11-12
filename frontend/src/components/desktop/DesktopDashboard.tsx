import React, { useState, useEffect } from 'react';
import {
  DrawerSummary,
  ItemResponse,
  TransactionResponse,
  InvoiceSummaryResponse,
  PendingDeliveryItem,
  NetworkInfo,
} from '../../types/inventory';
import { StanleyCabinetVisualizer } from '../cabinet/StanleyCabinetVisualizer';
import { InventoryTable } from '../inventory/InventoryTable';
import { InvoicesPanel } from '../inventory/InvoicesPanel';
import { YetToBeDeliveredPanel } from '../inventory/YetToBeDeliveredPanel';
import { TransactionLedger } from '../inventory/TransactionLedger';
import { DrawerModal } from '../cabinet/DrawerModal';
import { ParcelIntakeModal } from './ParcelIntakeModal';
import { InvoiceUploadModal } from './InvoiceUploadModal';
import { QrPrintModal } from '../qr/QrPrintModal';
import { fetchQrCode, fetchNetworkInfo } from '../../api/client';
import {
  Layers,
  Package,
  History,
  Plus,
  QrCode,
  Smartphone,
  ExternalLink,
  Search,
  User,
  CheckCircle,
  X,
  LayoutGrid,
  Edit2,
  Download,
  FileText,
  Upload,
  Wifi,
  ChevronDown,
  ShieldAlert,
  HelpCircle,
  Copy,
  Check,
  Truck,
  Clock,
} from 'lucide-react';

interface DesktopDashboardProps {
  drawers: DrawerSummary[];
  items: ItemResponse[];
  transactions: TransactionResponse[];
  invoices: InvoiceSummaryResponse[];
  pendingDeliveries?: PendingDeliveryItem[];
  userName: string;
  isOnline: boolean;
  installPrompt: any;
  onRefresh: () => void;
  onNotice: (msg: string) => void;
  onUpdateUserName: (newName: string) => void;
  onInstallApp: () => void;
}

export const DesktopDashboard: React.FC<DesktopDashboardProps> = ({
  drawers,
  items,
  transactions,
  invoices,
  pendingDeliveries = [],
  userName,
  isOnline,
  installPrompt,
  onRefresh,
  onNotice,
  onUpdateUserName,
  onInstallApp,
}) => {
  // Navigation: ALL, CABINET, INVENTORY, PENDING_DELIVERY, INVOICES, LEDGER
  const [activeView, setActiveView] = useState<'ALL' | 'CABINET' | 'INVENTORY' | 'PENDING_DELIVERY' | 'INVOICES' | 'LEDGER'>(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view')?.toUpperCase();
    if (v === 'PENDING' || v === 'PENDING_DELIVERY') return 'PENDING_DELIVERY';
    if (v === 'CABINET') return 'CABINET';
    if (v === 'INVENTORY') return 'INVENTORY';
    if (v === 'INVOICES') return 'INVOICES';
    if (v === 'LEDGER') return 'LEDGER';
    return 'ALL';
  });
  const [globalSearch, setGlobalSearch] = useState('');

  // Modals
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [isInvoiceUploadOpen, setIsInvoiceUploadOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('modal') === 'invoice';
  });
  const [intakeSku, setIntakeSku] = useState<string | undefined>();
  const [intakeDrawer, setIntakeDrawer] = useState<string>('S01');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [mobileQrUri, setMobileQrUri] = useState<string | null>(null);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);

  // Dynamic Network Discovery
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [selectedLanIp, setSelectedLanIp] = useState<string>('');
  const [customIpInput, setCustomIpInput] = useState<string>('');
  const [isCustomIp, setIsCustomIp] = useState<boolean>(false);
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState<boolean>(false);

  // Load active network information on mount
  useEffect(() => {
    fetchNetworkInfo()
      .then((info) => {
        setNetworkInfo(info);
        // If current window is accessed via a non-localhost IP, use that
        const currentHost = window.location.hostname;
        if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
          setSelectedLanIp(currentHost);
        } else {
          setSelectedLanIp(info.primary_ip);
        }
      })
      .catch((err) => {
        console.warn('Network info discovery failed, using fallback:', err);
        const fallback = window.location.hostname || '127.0.0.1';
        setSelectedLanIp(fallback);
      });
  }, []);

  const effectiveIp = isCustomIp && customIpInput.trim() ? customIpInput.trim() : (selectedLanIp || '127.0.0.1');
  const mobileHttpsUrl = `https://${effectiveIp}:8443`;
  const mobileHttpUrl = `http://${effectiveIp}:8000`;

  // Regenerate Mobile QR code whenever effective IP changes or modal opens
  useEffect(() => {
    if (isMobileModalOpen && effectiveIp) {
      setMobileQrUri(null);
      fetchQrCode(mobileHttpsUrl)
        .then((res) => setMobileQrUri(res.data_uri))
        .catch((err) => console.warn('Failed to load mobile QR:', err));
    }
  }, [isMobileModalOpen, mobileHttpsUrl, effectiveIp]);

  const handleOpenReceive = (sku?: string, drawer?: string) => {
    setIntakeSku(sku);
    if (drawer) setIntakeDrawer(drawer);
    setIsIntakeOpen(true);
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      onUpdateUserName(tempName.trim());
      setIsNameModalOpen(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

  const totalOccupied = drawers.filter((d) => d.is_occupied).length;
  const totalAvailable = 39 - totalOccupied;
  const totalUnits = drawers.reduce((sum, d) => sum + d.total_units, 0);

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar - Deep Hardware Navy (#0B132B) */}
      <aside className="sidebar-container">
        <div className="flex flex-col gap-6">
          {/* SKR Tek Primary Logo & Branding */}
          <div className="px-1 pt-1">
            <div className="flex items-center gap-3">
              <img
                src="/logos/logo-symbol.png"
                alt="SKR Tek"
                className="w-9 h-11 object-contain drop-shadow-[0_2px_8px_rgba(0,180,216,0.3)]"
              />
              <div className="flex flex-col">
                <span className="font-display font-black text-base tracking-tight text-white flex items-center gap-1.5">
                  SKR Tek
                  <span className="w-2 h-2 rounded-full bg-[#00B4D8] shadow-[0_0_8px_#00B4D8] inline-block" />
                </span>
                <span className="text-[10px] text-[#2EC4B6] font-semibold tracking-wider uppercase">
                  Hardware Innovations
                </span>
                <span className="text-[9px] text-slate-400 font-mono tracking-tight mt-0.5">
                  Stanley 39-Drawer Matrix
                </span>
              </div>
            </div>
          </div>

          {/* Navigation Views */}
          <nav className="flex flex-col gap-1.5">
            <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 px-3 mb-1">
              INVENTORY VIEWS
            </div>

            {/* All Overview */}
            <button
              onClick={() => setActiveView('ALL')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'ALL'
                  ? 'bg-gradient-to-r from-[#00B4D8]/20 to-[#2EC4B6]/10 text-[#00B4D8] border border-[#00B4D8]/40 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4 shrink-0" />
                <span>All Overview</span>
              </div>
            </button>

            {/* Cabinet Visualizer */}
            <button
              onClick={() => setActiveView('CABINET')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'CABINET'
                  ? 'bg-gradient-to-r from-[#00B4D8]/20 to-[#2EC4B6]/10 text-[#00B4D8] border border-[#00B4D8]/40 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4 shrink-0" />
                <span>Cabinet Matrix</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">39</span>
            </button>

            {/* Inventory List */}
            <button
              onClick={() => setActiveView('INVENTORY')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'INVENTORY'
                  ? 'bg-gradient-to-r from-[#00B4D8]/20 to-[#2EC4B6]/10 text-[#00B4D8] border border-[#00B4D8]/40 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4 shrink-0" />
                <span>Inventory Items</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{items.length}</span>
            </button>

            {/* Yet to be Delivered */}
            <button
              onClick={() => setActiveView('PENDING_DELIVERY')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'PENDING_DELIVERY'
                  ? 'bg-gradient-to-r from-[#00B4D8]/25 to-[#2EC4B6]/15 text-[#00B4D8] border border-[#00B4D8]/50 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Truck className="w-4 h-4 shrink-0" />
                <span>Yet to be Delivered</span>
              </div>
              {pendingDeliveries.length > 0 ? (
                <span className="font-mono text-[10px] bg-[#00B4D8] text-white px-2 py-0.5 rounded-full font-bold shadow-xs">
                  {pendingDeliveries.length}
                </span>
              ) : (
                <span className="font-mono text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">0</span>
              )}
            </button>

            {/* Invoices & Arrivals */}
            <button
              onClick={() => setActiveView('INVOICES')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'INVOICES'
                  ? 'bg-gradient-to-r from-[#2EC4B6]/20 to-[#00B4D8]/10 text-[#2EC4B6] border border-[#2EC4B6]/40 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Invoices & Arrivals</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{invoices.length}</span>
            </button>

            {/* Transaction Ledger */}
            <button
              onClick={() => setActiveView('LEDGER')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeView === 'LEDGER'
                  ? 'bg-gradient-to-r from-[#00B4D8]/20 to-[#2EC4B6]/10 text-[#00B4D8] border border-[#00B4D8]/40 shadow-sm'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <History className="w-4 h-4 shrink-0" />
                <span>Audit Ledger</span>
              </div>
              <span className="font-mono text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded">{transactions.length}</span>
            </button>
          </nav>
        </div>

        {/* Bottom Actions & User Profile */}
        <div className="flex flex-col gap-2.5 pt-4 border-t border-slate-800">
          {installPrompt && (
            <button
              onClick={onInstallApp}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Install Desktop App
            </button>
          )}

          <button
            onClick={() => setIsMobileModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#00B4D8] to-[#0096C7] text-white hover:brightness-110 shadow-sm transition-all"
          >
            <Smartphone className="w-4 h-4" /> Connect Mobile (PWA)
          </button>

          <button
            onClick={() => setIsQrModalOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-medium bg-slate-800/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 transition-all"
          >
            <QrCode className="w-3.5 h-3.5" /> Print Drawer QR Sheet
          </button>

          {/* User Profile Chip */}
          <div
            onClick={() => {
              setTempName(userName);
              setIsNameModalOpen(true);
            }}
            className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-[#00B4D8]/50 transition-all mt-1"
            title="Click to change your operator signature"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#00B4D8]/20 text-[#00B4D8] border border-[#00B4D8]/30 flex items-center justify-center">
                <User className="w-3.5 h-3.5" />
              </div>
              <div className="overflow-hidden">
                <div className="font-semibold text-xs text-white truncate flex items-center gap-1.5">
                  {userName}
                  <Edit2 className="w-3 h-3 text-slate-400" />
                </div>
                <div className="text-[10px] text-slate-400 font-mono truncate">
                  Operator Signature
                </div>
              </div>
            </div>
          </div>

          {/* Attribution in sidebar bottom */}
          <div className="text-[10px] text-slate-500 text-center pt-1 font-medium">
            Developed by <span className="text-[#00B4D8] font-semibold">Gowthum Vijaay D</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <div className="main-canvas">
        {/* Top Header Bar */}
        <header className="top-header">
          <div className="flex items-center gap-3">
            <img
              src="/logos/logo-dark.png"
              alt="SKR Tek"
              className="h-8 w-auto object-contain hidden md:block"
            />
            <div className="border-l border-slate-200 pl-3 hidden md:block">
              <h2 className="text-sm font-display font-bold text-[#0B132B] tracking-tight">
                SKR Tech's Inventory System
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Stanley 39-Compartment Storage Matrix
              </p>
            </div>
            <div className="md:hidden">
              <h2 className="text-sm font-display font-bold text-[#0B132B]">
                SKR Tech's Inventory
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Global Search Bar */}
            <div className="flex items-center gap-2 bg-white border border-slate-300 rounded-xl px-3 py-1.5 w-60 sm:w-72 shadow-sm focus-within:border-[#00B4D8] focus-within:ring-2 focus-within:ring-[#00B4D8]/20 transition-all">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search SKU, invoice, or drawer..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full text-xs font-medium bg-transparent text-[#1E293B] placeholder-slate-400 focus:outline-none"
              />
              {globalSearch && (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setIsInvoiceUploadOpen(true)}
              className="btn-cyan text-xs py-2 px-3.5 font-semibold flex items-center gap-2 rounded-xl"
            >
              <Upload className="w-3.5 h-3.5 shrink-0" /> Upload Invoice (PDF/Doc)
            </button>

            <button
              onClick={() => handleOpenReceive()}
              className="btn-teal text-xs py-2 px-3.5 font-semibold flex items-center gap-2 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" /> Add Stock
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="content-body pb-16">
          {/* Quick Metrics Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="skr-card p-4.5 bg-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Compartments
                </div>
                <div className="text-2xl font-black font-mono text-[#0B132B] mt-0.5">
                  39 <span className="text-xs text-slate-500 font-sans font-medium">(30S, 9L)</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="skr-card p-4.5 bg-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Occupied Compartments
                </div>
                <div className="text-2xl font-black font-mono text-[#0B132B] mt-0.5">
                  {totalOccupied} <span className="text-xs text-[#2EC4B6] font-sans font-semibold">({totalAvailable} Free)</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#2EC4B6]/10 text-[#2EC4B6] border border-[#2EC4B6]/20 flex items-center justify-center">
                <CheckCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="skr-card p-4.5 bg-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Physical Stock Units
                </div>
                <div className="text-2xl font-black font-mono text-[#0B132B] mt-0.5">
                  {totalUnits} <span className="text-xs text-slate-500 font-sans font-medium">({items.length} SKUs)</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-100 text-[#0B132B] border border-slate-200 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('PENDING_DELIVERY')}
              className={`skr-card p-4.5 bg-white flex items-center justify-between cursor-pointer transition-all border ${
                activeView === 'PENDING_DELIVERY'
                  ? 'border-[#00B4D8] ring-2 ring-[#00B4D8]/20'
                  : 'border-slate-200 hover:border-[#00B4D8]/50'
              }`}
            >
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  Yet to be Delivered
                  {pendingDeliveries.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-[#00B4D8] animate-ping" />
                  )}
                </div>
                <div className="text-2xl font-black font-mono text-[#00B4D8] mt-0.5">
                  {pendingDeliveries.length}{' '}
                  <span className="text-xs text-slate-500 font-sans font-medium">
                    ({pendingDeliveries.reduce((a, b) => a + b.quantity, 0)} units)
                  </span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center">
                <Truck className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Centerpiece Cabinet View */}
          {(activeView === 'ALL' || activeView === 'CABINET') && (
            <StanleyCabinetVisualizer
              drawers={drawers}
              selectedDrawerId={selectedDrawerId}
              onSelectDrawer={(id) => setSelectedDrawerId(id)}
              onOpenQrForDrawer={(id) => setSelectedDrawerId(id)}
            />
          )}

          {/* Yet to be Delivered Panel */}
          {(activeView === 'ALL' || activeView === 'PENDING_DELIVERY') && (
            <YetToBeDeliveredPanel
              pendingItems={pendingDeliveries}
              drawers={drawers}
              searchQuery={globalSearch}
              onRefresh={onRefresh}
              onNotice={onNotice}
              onOpenDrawerModal={(drawerId) => setSelectedDrawerId(drawerId)}
            />
          )}

          {/* Inventory Table */}
          {(activeView === 'ALL' || activeView === 'INVENTORY') && (
            <InventoryTable
              items={items}
              searchQuery={globalSearch}
              onOpenReceiveModal={(sku) => handleOpenReceive(sku)}
              onOpenDrawerModal={(drawerId) => setSelectedDrawerId(drawerId)}
            />
          )}

          {/* Invoices & Arrivals Panel */}
          {(activeView === 'ALL' || activeView === 'INVOICES') && (
            <InvoicesPanel
              invoices={invoices}
              searchQuery={globalSearch}
              onOpenInvoiceUpload={() => setIsInvoiceUploadOpen(true)}
              onOpenDrawerModal={(drawerId) => setSelectedDrawerId(drawerId)}
            />
          )}

          {/* Transaction Ledger Table */}
          {(activeView === 'ALL' || activeView === 'LEDGER') && (
            <TransactionLedger transactions={transactions} searchQuery={globalSearch} />
          )}

          {/* Footer with Developer Attribution */}
          <footer className="mt-12 pt-6 pb-2 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-3">
            <div className="flex items-center gap-2.5">
              <img src="/logos/logo-symbol.png" alt="SKR Tek" className="w-4 h-5 object-contain" />
              <span className="font-semibold text-[#0B132B]">SKR Tech's Inventory System</span>
              <span>•</span>
              <span className="text-slate-400">Hardware Innovations</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span>Developed by</span>
              <span className="font-bold text-[#00B4D8] tracking-wide">Gowthum Vijaay D</span>
            </div>
          </footer>
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Drawer Inspection & Action Modal */}
      <DrawerModal
        drawerId={selectedDrawerId}
        userName={userName}
        onClose={() => setSelectedDrawerId(null)}
        onRefresh={onRefresh}
        onOpenReceiveForDrawer={(dId) => handleOpenReceive(undefined, dId)}
        onPrintQrForDrawer={() => setIsQrModalOpen(true)}
      />

      {/* 1b. Invoice Upload & Extraction Modal */}
      <InvoiceUploadModal
        isOpen={isInvoiceUploadOpen}
        drawers={drawers}
        onClose={() => setIsInvoiceUploadOpen(false)}
        onRefresh={onRefresh}
        onNotice={onNotice}
      />

      {/* 2. Parcel & SKU Intake Modal */}
      <ParcelIntakeModal
        isOpen={isIntakeOpen}
        defaultSku={intakeSku}
        defaultDrawer={intakeDrawer}
        onClose={() => setIsIntakeOpen(false)}
        onRefresh={onRefresh}
        onSwitchToInvoiceUpload={() => setIsInvoiceUploadOpen(true)}
      />

      {/* 3. Printable QR Labels Sheet */}
      <QrPrintModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />

      {/* 4. Connect Mobile Phone (PWA) with Multi-Network Adapter Support */}
      {isMobileModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMobileModalOpen(false)}>
          <div
            className="skr-card bg-white w-full max-w-lg p-6 relative max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/30 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-bold text-[#0B132B]">
                    Connect Android Phone (PWA)
                  </h3>
                  <span className="text-xs text-slate-500 font-medium">
                    SKR Tech's Inventory System • No APK Required
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileModalOpen(false)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Dynamic Network Adapter Selector */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                    <Wifi className="w-3.5 h-3.5 text-[#00B4D8]" /> Active Network Interface
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustomIp(!isCustomIp)}
                    className="text-[11px] font-semibold text-[#00B4D8] hover:underline"
                  >
                    {isCustomIp ? 'Choose Detected Adapter' : 'Enter Custom IP'}
                  </button>
                </div>

                {!isCustomIp ? (
                  <div className="relative">
                    <select
                      value={selectedLanIp}
                      onChange={(e) => setSelectedLanIp(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-[#0B132B] focus:outline-none focus:border-[#00B4D8] appearance-none"
                    >
                      {networkInfo?.interfaces && networkInfo.interfaces.length > 0 ? (
                        networkInfo.interfaces.map((iface) => (
                          <option key={iface.ip} value={iface.ip}>
                            {iface.name}: {iface.ip} {iface.is_primary ? '(Default)' : ''}
                          </option>
                        ))
                      ) : (
                        <option value={selectedLanIp}>{selectedLanIp} (Primary)</option>
                      )}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 192.168.1.15"
                      value={customIpInput}
                      onChange={(e) => setCustomIpInput(e.target.value)}
                      className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold focus:outline-none focus:border-[#00B4D8]"
                    />
                  </div>
                )}
                <span className="text-[10px] text-slate-500 block mt-1.5">
                  Select the IP address of the Wi-Fi or Hotspot network your phone is connected to.
                </span>
              </div>

              {/* Live QR Code Box */}
              <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
                <div className="w-44 h-44 p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-center mb-2 shadow-inner">
                  {mobileQrUri ? (
                    <img
                      src={mobileQrUri}
                      alt="Scan to open on Mobile"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs font-mono font-bold text-slate-400 animate-pulse">
                      Generating QR...
                    </div>
                  )}
                </div>
                <div className="text-xs font-bold text-[#0B132B]">
                  Scan with your phone's camera
                </div>
                <div className="text-[11px] text-slate-500 font-medium">
                  Instantly opens the Mobile PWA in Chrome
                </div>
              </div>

              {/* Secure HTTPS Link & One-Click Copy */}
              <div className="p-3.5 rounded-xl bg-[#00B4D8]/10 border border-[#00B4D8]/30">
                <div className="text-xs font-bold uppercase text-[#0E7490] mb-1 flex items-center justify-between">
                  <span>1. Secure Mobile URL</span>
                  <button
                    onClick={() => handleCopyUrl(mobileHttpsUrl)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-[#0E7490] hover:text-[#0B132B]"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-[#0B132B] flex items-center justify-between break-all">
                  <span>{mobileHttpsUrl}</span>
                  <a
                    href={mobileHttpsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-slate-400 hover:text-[#00B4D8]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-[10px] text-[#0E7490] block mt-1.5">
                  💡 In Chrome on Android: tap <b>Advanced → Proceed to {effectiveIp} (unsafe)</b> to accept your local self-signed certificate.
                </span>
              </div>

              {/* Troubleshooting Drawer / Expandable */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                  className="w-full p-3 bg-slate-50 text-left text-xs font-semibold text-slate-700 flex items-center justify-between hover:bg-slate-100 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-3.5 h-3.5 text-[#00B4D8]" /> Mobile says "Connection Timed Out"? Click for Fixes
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showTroubleshooting ? 'rotate-180' : ''}`} />
                </button>

                {showTroubleshooting && (
                  <div className="p-4 bg-white space-y-2.5 text-xs text-slate-600 border-t border-slate-200">
                    <p className="font-semibold text-slate-800">
                      Why connection times out on another Wi-Fi network:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1.5 text-[11px]">
                      <li>
                        <b>Same Wi-Fi Required:</b> Confirm that both your laptop and phone are connected to the exact same Wi-Fi SSID.
                      </li>
                      <li>
                        <b>Router Client Isolation (Hostels / Colleges / Cafes):</b> Some routers block devices from talking to each other.
                        <div className="mt-1 p-2 bg-[#2EC4B6]/10 text-[#0E7490] rounded-lg font-medium">
                          ⚡ <b>Guaranteed Fix:</b> Turn on <b>Mobile Hotspot</b> on your laptop (or phone) and connect the other device to that hotspot! Then select that hotspot IP above.
                        </div>
                      </li>
                      <li>
                        <b>Windows Firewall:</b> Windows may block incoming port 8443 on Public networks. Make sure you ran <code>start.bat</code> which adds the firewall rule, or allow Python in Windows Firewall.
                      </li>
                      <li>
                        <b>Multiple Network Adapters:</b> If your laptop has VirtualBox/Docker/Ethernet/Wi-Fi active, use the dropdown above to switch to your Wi-Fi IP.
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setIsMobileModalOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 5. User Name Setup Modal */}
      {isNameModalOpen && (
        <div className="modal-overlay" onClick={() => setIsNameModalOpen(false)}>
          <div
            className="skr-card bg-white w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/30 flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-[#0B132B]">
                  Operator Signature
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Signs all stock receipts and audits
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase">
                  Operator Name
                </label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="e.g. Gowthum"
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs font-semibold focus:outline-none focus:border-[#00B4D8]"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNameModalOpen(false)}
                  className="py-1.5 px-3 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-cyan py-1.5 px-4 text-xs font-semibold rounded-lg"
                >
                  Save Signature
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
