import React, { useState } from 'react';
import {
  DrawerSummary,
  ItemResponse,
  TransactionResponse,
} from '../../types/inventory';
import { clearDemoData, resetDemoData } from '../../api/client';
import { StanleyCabinetVisualizer } from '../cabinet/StanleyCabinetVisualizer';
import { DrawerModal } from '../cabinet/DrawerModal';
import { InventoryTable } from '../inventory/InventoryTable';
import { TransactionLedger } from '../inventory/TransactionLedger';
import { ParcelIntakeModal } from './ParcelIntakeModal';
import { QrPrintModal } from '../qr/QrPrintModal';

import {
  Cpu,
  Search,
  Layers,
  Package,
  History,
  QrCode,
  User,
  Trash2,
  RotateCcw,
  Plus,
  CheckCircle,
  Smartphone,
  ExternalLink,
  X,
  LayoutGrid,
  Edit2,
  Download,
} from 'lucide-react';

interface DesktopDashboardProps {
  drawers: DrawerSummary[];
  items: ItemResponse[];
  transactions: TransactionResponse[];
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
  userName,
  isOnline,
  installPrompt,
  onRefresh,
  onNotice,
  onUpdateUserName,
  onInstallApp,
}) => {
  // Navigation: ALL, CABINET, INVENTORY, LEDGER
  const [activeView, setActiveView] = useState<'ALL' | 'CABINET' | 'INVENTORY' | 'LEDGER'>('ALL');
  const [globalSearch, setGlobalSearch] = useState('');

  // Modals
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
  const [isIntakeOpen, setIsIntakeOpen] = useState(false);
  const [intakeSku, setIntakeSku] = useState<string | undefined>();
  const [intakeDrawer, setIntakeDrawer] = useState<string>('S01');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const handleClearDemo = async () => {
    if (
      window.confirm(
        'Are you sure you want to clear all demo data? This resets the cabinet to 100% fresh and clean for actual production use.'
      )
    ) {
      try {
        const res = await clearDemoData();
        onNotice(res.message);
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

  const handleResetDemo = async () => {
    if (window.confirm('Reload sample demo components for testing?')) {
      try {
        const res = await resetDemoData();
        onNotice(res.message);
        onRefresh();
      } catch (err: any) {
        alert(err.message);
      }
    }
  };

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

  const totalOccupied = drawers.filter((d) => d.is_occupied).length;
  const totalAvailable = 39 - totalOccupied;
  const totalUnits = drawers.reduce((sum, d) => sum + d.total_units, 0);

  const lanIp = '192.168.29.243';
  const mobileHttpsUrl = `https://${lanIp}:8443`;
  const mobileHttpUrl = `http://${lanIp}:8000`;

  return (
    <div className="app-layout">
      {/* 1. Left Sidebar */}
      <aside className="sidebar-container">
        <div className="flex flex-col gap-5">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 px-1 pt-2">
            <div className="w-10 h-10 rounded-xl bg-[#FEF08A] text-[#18181B] flex items-center justify-center font-black border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
              <Cpu className="w-6 h-6 text-[#18181B]" />
            </div>
            <div>
              <h1 className="font-black text-lg tracking-tight text-white flex items-center gap-1.5">
                Smart Inventory
                <span className="w-2 h-2 rounded-full bg-[#86EFAC] inline-block" />
              </h1>
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider font-mono">
                STANLEY 39-DRAWER SYSTEM
              </span>
            </div>
          </div>

          {/* Sidebar Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search items or drawers..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl bg-[#23252B] border-2 border-[#3F3F46] text-white placeholder-[#71717A] focus:outline-none focus:border-[#86EFAC]"
            />
          </div>

          {/* Navigation Views */}
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-black tracking-widest uppercase text-[#71717A] px-2 mb-1">
              NAVIGATION
            </div>

            {/* All Overview */}
            <button
              onClick={() => setActiveView('ALL')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeView === 'ALL'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <LayoutGrid className="w-4 h-4" />
                <span>All Overview</span>
              </div>
            </button>

            {/* Cabinet Visualizer */}
            <button
              onClick={() => setActiveView('CABINET')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-black transition-all ${
                activeView === 'CABINET'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Layers className="w-4 h-4" />
                <span>Cabinet</span>
              </div>
              <span className="font-mono text-[11px] font-bold">39</span>
            </button>

            {/* Inventory List */}
            <button
              onClick={() => setActiveView('INVENTORY')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'INVENTORY'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4" />
                <span>Inventory List</span>
              </div>
              <span className="font-mono text-[11px]">{items.length}</span>
            </button>

            {/* Transaction Ledger */}
            <button
              onClick={() => setActiveView('LEDGER')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeView === 'LEDGER'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <History className="w-4 h-4" />
                <span>Transaction History</span>
              </div>
              <span className="font-mono text-[11px]">{transactions.length}</span>
            </button>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2.5 pt-4 border-t border-[#27272A]">
          {installPrompt && (
            <button
              onClick={onInstallApp}
              className="w-full brutal-btn brutal-btn-mint text-xs py-2 px-3 text-[#064E3B]"
            >
              <Download className="w-4 h-4" /> Install Desktop App
            </button>
          )}

          <button
            onClick={() => setIsMobileModalOpen(true)}
            className="w-full brutal-btn brutal-btn-yellow text-xs py-2 px-3 text-[#713F12]"
          >
            <Smartphone className="w-4 h-4" /> Mobile PWA & QR Link
          </button>

          <button
            onClick={() => setIsQrModalOpen(true)}
            className="w-full brutal-btn brutal-btn-white text-xs py-2 px-3 text-[#18181B]"
          >
            <QrCode className="w-4 h-4" /> Print Drawer QR Labels
          </button>

          {/* User Profile Card */}
          <div
            onClick={() => {
              setTempName(userName);
              setIsNameModalOpen(true);
            }}
            className="p-3 rounded-xl bg-[#1C1D22] border border-[#2E3038] flex items-center justify-between cursor-pointer hover:border-[#86EFAC] transition-all"
            title="Click to edit your user name"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#FEF08A] text-[#18181B] font-black flex items-center justify-center text-xs border border-[#18181B]">
                <User className="w-4 h-4 text-[#18181B]" />
              </div>
              <div>
                <div className="font-bold text-xs text-white flex items-center gap-1.5">
                  {userName}
                  <Edit2 className="w-3 h-3 text-[#71717A]" />
                </div>
                <div className="text-[10px] text-[#A1A1AA] font-mono">
                  Inventory Lead
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* 2. Main Content Canvas */}
      <div className="main-canvas">
        {/* Top Header Bar */}
        <header className="top-header">
          <div>
            <h2 className="text-base font-black text-[#18181B] tracking-tight uppercase">
              Electronics Storage Dashboard
            </h2>
            <p className="text-xs text-[#71717A] font-semibold">
              STANLEY 1-93-981 • 39 Physical Compartments
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleOpenReceive()}
              className="brutal-btn brutal-btn-mint text-xs py-2 px-4 text-[#064E3B]"
            >
              <Plus className="w-4 h-4" /> + Add / Receive Item
            </button>

            {/* Mobile PWA Shortcut */}
            <button
              onClick={() => setIsMobileModalOpen(true)}
              className="brutal-btn brutal-btn-white text-xs py-2 px-3 text-[#18181B]"
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobile Link
            </button>

            {/* Demo Data Management */}
            {items.length > 0 ? (
              <button
                onClick={handleClearDemo}
                className="brutal-btn brutal-btn-white text-xs py-2 px-3 text-[#B91C1C] border-[#B91C1C]/40 hover:bg-[#FEE2E2]"
                title="Wipe demo data for fresh production use"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Demo Data
              </button>
            ) : (
              <button
                onClick={handleResetDemo}
                className="brutal-btn brutal-btn-yellow text-xs py-2 px-3 text-[#713F12]"
                title="Load sample components for testing"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Load Demo Data
              </button>
            )}

            {/* User Chip */}
            <button
              onClick={() => {
                setTempName(userName);
                setIsNameModalOpen(true);
              }}
              className="brutal-pill pill-yellow text-xs px-3 py-1.5 font-bold cursor-pointer"
            >
              <User className="w-3 h-3" /> {userName}
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="content-body pb-16">
          {/* Quick Status Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="brutal-card p-4 bg-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#71717A]">
                  Total Compartments
                </div>
                <div className="text-2xl font-black font-mono text-[#18181B] mt-0.5">
                  39 <span className="text-xs text-[#71717A] font-sans font-semibold">(30 Small, 9 Large)</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center font-bold">
                <Layers className="w-5 h-5 text-[#18181B]" />
              </div>
            </div>

            <div className="brutal-card p-4 bg-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#71717A]">
                  Occupied Compartments
                </div>
                <div className="text-2xl font-black font-mono text-[#18181B] mt-0.5">
                  {totalOccupied} <span className="text-xs text-[#166534] font-sans font-semibold">({totalAvailable} Available)</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#86EFAC] border-2 border-[#18181B] flex items-center justify-center font-bold">
                <CheckCircle className="w-5 h-5 text-[#064E3B]" />
              </div>
            </div>

            <div className="brutal-card p-4 bg-white flex items-center justify-between">
              <div>
                <div className="text-[11px] font-black uppercase text-[#71717A]">
                  Total Stock Units
                </div>
                <div className="text-2xl font-black font-mono text-[#18181B] mt-0.5">
                  {totalUnits} <span className="text-xs text-[#71717A] font-sans font-semibold">({items.length} Unique SKUs)</span>
                </div>
              </div>
              <div className="w-9 h-9 rounded-xl bg-[#DDD6FE] border-2 border-[#18181B] flex items-center justify-center font-bold">
                <Package className="w-5 h-5 text-[#4C1D95]" />
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

          {/* Inventory Table */}
          {(activeView === 'ALL' || activeView === 'INVENTORY') && (
            <InventoryTable
              items={items}
              onOpenReceiveModal={(sku) => handleOpenReceive(sku)}
              onOpenDrawerModal={(drawerId) => setSelectedDrawerId(drawerId)}
            />
          )}

          {/* Transaction Ledger Table */}
          {(activeView === 'ALL' || activeView === 'LEDGER') && (
            <TransactionLedger transactions={transactions} />
          )}
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

      {/* 2. Parcel & SKU Intake Modal */}
      <ParcelIntakeModal
        isOpen={isIntakeOpen}
        defaultSku={intakeSku}
        defaultDrawer={intakeDrawer}
        onClose={() => setIsIntakeOpen(false)}
        onRefresh={onRefresh}
      />

      {/* 3. Printable QR Labels Sheet */}
      <QrPrintModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />

      {/* 4. Mobile PWA & Access Guide Modal */}
      {isMobileModalOpen && (
        <div className="modal-overlay" onClick={() => setIsMobileModalOpen(false)}>
          <div
            className="brutal-card bg-white w-full max-w-md p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#86EFAC] text-[#064E3B] flex items-center justify-center border-2 border-[#18181B]">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-[#18181B]">
                    Connect Android Phone (PWA)
                  </h3>
                  <span className="text-[11px] text-[#71717A] font-semibold">
                    No APK needed • Install directly from Chrome
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsMobileModalOpen(false)}
                className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
              >
                <X className="w-4 h-4 text-[#18181B]" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl border-2 border-[#18181B] bg-[#DCFCE7] shadow-[2px_2px_0px_#18181B]">
                <div className="text-xs font-black uppercase text-[#15803D] mb-1">
                  1. Secure HTTPS Link (Camera & PWA Enabled)
                </div>
                <p className="text-xs text-[#166534] mb-2.5">
                  Connect your phone to the same Wi-Fi and open this URL in Chrome:
                </p>
                <div className="p-2.5 bg-white border-2 border-[#18181B] rounded-lg font-mono text-xs font-black text-[#18181B] flex items-center justify-between">
                  <span className="select-all">{mobileHttpsUrl}</span>
                  <a
                    href={mobileHttpsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 hover:text-[#15803D]"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
                <span className="text-[10px] text-[#166534] block mt-1.5">
                  💡 In Chrome on Android, tap <b>Advanced → Proceed to {lanIp} (unsafe)</b> to accept your local self-signed certificate.
                </span>
              </div>

              <div className="p-4 rounded-xl border-2 border-[#18181B] bg-[#FAF9F5] shadow-[2px_2px_0px_#18181B]">
                <div className="text-xs font-black uppercase text-[#18181B] mb-1">
                  2. Install to Android Home Screen
                </div>
                <p className="text-xs text-[#71717A]">
                  In Chrome, tap the <b>three dots (⋮)</b> menu in the top right, then tap <b>"Add to Home screen"</b> or <b>"Install app"</b>. The app will install natively with offline support!
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsMobileModalOpen(false)}
              className="w-full mt-4 py-2.5 rounded-xl border-2 border-[#18181B] bg-[#F4F4F5] text-xs font-bold text-[#18181B]"
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
            className="brutal-card bg-white w-full max-w-sm p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-black uppercase text-[#18181B] mb-1">
              Your Name / Sign-In
            </h3>
            <p className="text-xs text-[#71717A] font-semibold mb-4">
              Enter your name to sign your inventory movements and stock removals.
            </p>

            <form onSubmit={handleSaveName} className="space-y-3">
              <div>
                <label className="block text-xs font-black text-[#18181B] mb-1">
                  NAME
                </label>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  placeholder="e.g. Gowthum"
                  className="w-full p-2.5 rounded-lg border-2 border-[#18181B] text-xs font-bold focus:outline-none"
                  autoFocus
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNameModalOpen(false)}
                  className="brutal-btn brutal-btn-white text-xs py-1.5 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="brutal-btn brutal-btn-mint text-xs py-1.5 px-4 text-[#064E3B]"
                >
                  Save Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
