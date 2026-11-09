import React, { useState, useEffect } from 'react';
import {
  DrawerSummary,
  ItemResponse,
  TransactionResponse,
} from './types/inventory';
import {
  fetchDrawers,
  fetchItems,
  fetchTransactions,
  clearDemoData,
  resetDemoData,
} from './api/client';

import { CabinetVisualizer } from './components/CabinetVisualizer';
import { InventoryTable } from './components/InventoryTable';
import { DrawerModal } from './components/DrawerModal';
import { ParcelIntakeModal } from './components/ParcelIntakeModal';
import { QrPrintModal } from './components/QrPrintModal';
import { MobileApp } from './mobile/MobileApp';

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
  AlertCircle,
  Edit2,
  Smartphone,
} from 'lucide-react';

export const App: React.FC = () => {
  // Check if viewing mobile route
  const isMobileRoute = window.location.pathname.startsWith('/mobile');

  // Single User Setup (persisted in localStorage)
  const [userName, setUserName] = useState<string>(() => {
    return localStorage.getItem('inventory_user_name') || 'Admin User';
  });
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const [drawers, setDrawers] = useState<DrawerSummary[]>([]);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Active view tab
  const [activePortalView, setActivePortalView] = useState<
    'CABINET' | 'INVENTORY' | 'LEDGER'
  >('CABINET');

  // Modals
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
  const [isParcelModalOpen, setIsParcelModalOpen] = useState(false);
  const [parcelDefaultSku, setParcelDefaultSku] = useState<string | undefined>();
  const [parcelDefaultDrawer, setParcelDefaultDrawer] = useState<string>('S01');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Search
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [d, it, tx] = await Promise.all([
        fetchDrawers(),
        fetchItems(),
        fetchTransactions(),
      ]);
      setDrawers(d);
      setItems(it);
      setTransactions(tx);
    } catch (err) {
      console.warn('Backend loading error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempName.trim()) {
      setUserName(tempName.trim());
      localStorage.setItem('inventory_user_name', tempName.trim());
      setIsNameModalOpen(false);
      showNotice(`User name updated to: ${tempName.trim()}`);
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleClearDemo = async () => {
    if (window.confirm('Are you sure you want to clear all demo data? This resets the cabinet to 100% fresh and clean for actual production use.')) {
      try {
        setLoading(true);
        const res = await clearDemoData();
        showNotice(res.message);
        loadAllData();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetDemo = async () => {
    if (window.confirm('Reload sample demo components for testing?')) {
      try {
        setLoading(true);
        const res = await resetDemoData();
        showNotice(res.message);
        loadAllData();
      } catch (err: any) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleOpenReceiveModal = (sku?: string, drawer?: string) => {
    setParcelDefaultSku(sku);
    if (drawer) setParcelDefaultDrawer(drawer);
    setIsParcelModalOpen(true);
  };

  // If URL is /mobile, render the dedicated Mobile App interface directly!
  if (isMobileRoute) {
    return <MobileApp onDataChanged={loadAllData} />;
  }

  // Calculate clean high-level summary counts
  const totalOccupied = drawers.filter((d) => d.is_occupied).length;
  const totalAvailable = 39 - totalOccupied;
  const totalUnits = drawers.reduce((sum, d) => sum + d.total_units, 0);

  return (
    <div className="app-layout">
      {/* 1. Clean Left Sidebar */}
      <aside className="sidebar-container">
        <div className="flex flex-col gap-6">
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

          {/* Clean Sidebar Search */}
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
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-black tracking-widest uppercase text-[#71717A] px-2">
              NAVIGATION
            </div>

            {/* Cabinet Visualizer */}
            <button
              onClick={() => setActivePortalView('CABINET')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-black transition-all ${
                activePortalView === 'CABINET'
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
              onClick={() => setActivePortalView('INVENTORY')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activePortalView === 'INVENTORY'
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
              onClick={() => setActivePortalView('LEDGER')}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                activePortalView === 'LEDGER'
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

        {/* Bottom Actions & User Profile */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[#27272A]">
          <button
            onClick={() => setIsQrModalOpen(true)}
            className="w-full brutal-btn brutal-btn-yellow text-xs py-2 px-3"
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
            title="Click to change your name"
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

          {/* Top Controls: Add Button & Demo Data Toggle */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleOpenReceiveModal()}
              className="brutal-btn brutal-btn-mint text-xs py-2 px-4"
            >
              <Plus className="w-4 h-4" /> + Add / Receive Item
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
                className="brutal-btn brutal-btn-yellow text-xs py-2 px-3"
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

        {/* Global Notice Banner */}
        {notice && (
          <div className="mx-6 mt-4 p-3 bg-[#DCFCE7] border-2 border-[#15803D] rounded-xl text-xs font-bold text-[#15803D] flex items-center justify-between shadow-[2px_2px_0px_#18181B]">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{notice}</span>
            </div>
            <button onClick={() => setNotice(null)} className="font-mono text-xs">✕</button>
          </div>
        )}

        {/* Content Body with clean 24px spacing */}
        <main className="content-body pb-16">
          {/* Top Quick Status Ribbon */}
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
          <CabinetVisualizer
            drawers={drawers}
            selectedDrawerId={selectedDrawerId}
            onSelectDrawer={(id) => setSelectedDrawerId(id)}
            onOpenQrForDrawer={(id) => {
              setSelectedDrawerId(id);
            }}
          />

          {/* Inventory Table */}
          <InventoryTable
            items={items}
            onOpenReceiveModal={(sku) => handleOpenReceiveModal(sku)}
            onOpenDrawerModal={(drawerId) => setSelectedDrawerId(drawerId)}
          />

          {/* Transaction Ledger Table */}
          <div className="brutal-card p-6 bg-white mb-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-[#18181B]">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-[#18181B]" />
                <h3 className="text-base font-black uppercase text-[#18181B]">
                  Permanent Inventory Transaction Ledger
                </h3>
              </div>
              <span className="brutal-pill pill-yellow text-xs font-mono">
                {transactions.length} AUDITED MOVEMENTS
              </span>
            </div>

            <div className="overflow-x-auto border-2 border-[#18181B] rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#FAF9F5] border-b-2 border-[#18181B] text-[#18181B] font-black uppercase text-[11px]">
                    <th className="py-3 px-4 min-w-[150px]">TIMESTAMP</th>
                    <th className="py-3 px-4 min-w-[100px]">ACTION</th>
                    <th className="py-3 px-4 min-w-[140px]">ITEM</th>
                    <th className="py-3 px-4 text-center min-w-[90px]">DRAWER</th>
                    <th className="py-3 px-4 text-right min-w-[90px]">CHANGE</th>
                    <th className="py-3 px-4 text-right min-w-[110px]">BALANCE AFTER</th>
                    <th className="py-3 px-4">NOTES / REFERENCE</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-[#18181B] bg-white font-mono">
                  {transactions.length > 0 ? (
                    transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#FBF9F5]">
                        <td className="py-3 px-4 text-[11px] text-[#71717A]">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              tx.action_type === 'RECEIVE'
                                ? 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
                                : tx.action_type === 'CONSUME'
                                ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
                                : 'bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]'
                            }`}
                          >
                            {tx.action_type}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-[#18181B]">
                          {tx.item_sku}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-0.5 rounded border border-[#18181B] bg-[#FEF08A] font-bold text-[10px]">
                            {tx.drawer_id || '—'}
                          </span>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-black ${
                            tx.change_qty > 0 ? 'text-[#166534]' : 'text-[#991B1B]'
                          }`}
                        >
                          {tx.change_qty > 0 ? `+${tx.change_qty}` : tx.change_qty}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-[#18181B]">
                          {tx.balance_after}
                        </td>
                        <td className="py-3 px-4 text-[11px] text-[#52525B] font-sans truncate max-w-sm">
                          {tx.reference_doc ? `[${tx.reference_doc}] ` : ''}
                          {tx.notes}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-[#71717A] font-semibold font-sans">
                        No transactions recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Drawer Inspection & Action Modal */}
      <DrawerModal
        drawerId={selectedDrawerId}
        userName={userName}
        onClose={() => setSelectedDrawerId(null)}
        onRefresh={loadAllData}
        onOpenReceiveForDrawer={(dId) => handleOpenReceiveModal(undefined, dId)}
        onPrintQrForDrawer={(dId) => setIsQrModalOpen(true)}
      />

      {/* 2. Parcel & SKU Intake Modal */}
      <ParcelIntakeModal
        isOpen={isParcelModalOpen}
        defaultSku={parcelDefaultSku}
        defaultDrawer={parcelDefaultDrawer}
        onClose={() => setIsParcelModalOpen(false)}
        onRefresh={loadAllData}
      />

      {/* 3. Printable QR Labels Sheet */}
      <QrPrintModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />

      {/* 4. User Name Setup Modal */}
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
                  className="brutal-btn brutal-btn-mint text-xs py-1.5 px-4"
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

export default App;
