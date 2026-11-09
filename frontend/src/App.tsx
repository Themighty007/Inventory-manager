import React, { useState, useEffect } from 'react';
import {
  DrawerSummary,
  ItemResponse,
  DashboardStats,
  TransactionResponse,
} from './types/inventory';
import {
  fetchDrawers,
  fetchItems,
  fetchDashboardStats,
  fetchTransactions,
} from './api/client';

import { MetricCards } from './components/MetricCards';
import { RequisitionCard } from './components/RequisitionCard';
import { CabinetVisualizer } from './components/CabinetVisualizer';
import { InventoryTable } from './components/InventoryTable';
import { CategoryUsage } from './components/CategoryUsage';
import { DrawerModal } from './components/DrawerModal';
import { ParcelIntakeModal } from './components/ParcelIntakeModal';
import { QrPrintModal } from './components/QrPrintModal';
import { MobileSimulatorModal } from './components/MobileSimulatorModal';

import {
  Shield,
  Search,
  LayoutDashboard,
  Layers,
  Package,
  History,
  QrCode,
  Smartphone,
  CheckCircle2,
  Bell,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export const App: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [drawers, setDrawers] = useState<DrawerSummary[]>([]);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view
  const [activePortalView, setActivePortalView] = useState<
    'OVERVIEW' | 'CABINET' | 'INVENTORY' | 'REQUISITIONS' | 'LEDGER'
  >('OVERVIEW');

  // Modals
  const [selectedDrawerId, setSelectedDrawerId] = useState<string | null>(null);
  const [isParcelModalOpen, setIsParcelModalOpen] = useState(false);
  const [parcelDefaultSku, setParcelDefaultSku] = useState<string | undefined>();
  const [parcelDefaultDrawer, setParcelDefaultDrawer] = useState<string>('S01');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isMobileSimOpen, setIsMobileSimOpen] = useState(false);

  // Search
  const [globalSearch, setGlobalSearch] = useState('');

  // Switch role state
  const [activeRole, setActiveRole] = useState('S.');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [s, d, it, tx] = await Promise.all([
        fetchDashboardStats(),
        fetchDrawers(),
        fetchItems(),
        fetchTransactions(),
      ]);
      setStats(s);
      setDrawers(d);
      setItems(it);
      setTransactions(tx);
    } catch (err) {
      console.error('Failed to load inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenReceiveModal = (sku?: string, drawer?: string) => {
    setParcelDefaultSku(sku);
    if (drawer) setParcelDefaultDrawer(drawer);
    setIsParcelModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F6F1] text-[#18181B] font-sans">
      {/* Top Header Bar matching Image 1 */}
      <header className="bg-[#FAF9F5] border-b-2 border-[#18181B] px-6 py-3 flex flex-wrap items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-3">
          <div className="brutal-pill pill-yellow font-black text-xs uppercase tracking-wider">
            PORTAL: STORES & PROCUREMENT MANAGER
          </div>
          <span className="text-xs font-semibold text-[#71717A] hidden md:inline">
            Central Engineering Stores & Spare Parts Procurement
          </span>
        </div>

        {/* Right side role switches & Mobile launcher */}
        <div className="flex items-center gap-2">
          {/* Mobile phone simulator button */}
          <button
            onClick={() => setIsMobileSimOpen(true)}
            className="brutal-btn brutal-btn-mint text-xs py-1.5 px-3"
            title="Launch live interactive Android Phone Simulator"
          >
            <Smartphone className="w-3.5 h-3.5" /> Android Phone Terminal
          </button>

          <span className="text-xs font-bold text-[#71717A] ml-2 hidden sm:inline">SWITCH ROLE:</span>
          {['Aarav', 'Dr.', 'Rajesh', 'Chief', 'S.'].map((role) => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border-2 border-[#18181B] transition-all ${
                activeRole === role
                  ? 'bg-[#18181B] text-white shadow-[2px_2px_0px_#18181B]'
                  : 'bg-white text-[#18181B] hover:bg-[#F4F4F5]'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </header>

      {/* Main Layout Area: Sidebar + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Obsidian Sidebar matching Image 1 */}
        <aside className="w-64 bg-[#121316] text-white flex flex-col justify-between p-4 border-r-2 border-[#18181B] shrink-0 select-none">
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex items-center justify-between px-2 pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FEF08A] text-[#18181B] flex items-center justify-center font-black border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
                  <Shield className="w-4 h-4 text-[#18181B]" />
                </div>
                <div>
                  <h1 className="font-black text-base tracking-tight text-white flex items-center gap-1.5">
                    aegis '26
                    <span className="w-2 h-2 rounded-full bg-[#86EFAC] animate-pulse inline-block" />
                  </h1>
                  <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest font-mono">
                    CAMPUS CRM
                  </span>
                </div>
              </div>
            </div>

            {/* Sidebar Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search rooms, queries..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-lg bg-[#23252B] border border-[#3F3F46] text-white placeholder-[#71717A] focus:outline-none focus:border-[#86EFAC]"
              />
            </div>

            {/* Portal Views Nav */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-black tracking-widest uppercase text-[#71717A] px-2 mb-2">
                PORTAL VIEWS
              </div>

              {/* CRM Overview */}
              <button
                onClick={() => setActivePortalView('OVERVIEW')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition-all ${
                  activePortalView === 'OVERVIEW'
                    ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                    : 'text-[#D4D4D8] hover:bg-[#27272A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>CRM Overview</span>
                </div>
                <span className="brutal-pill pill-dark text-[9px] px-1.5 py-0.2">LIVE</span>
              </button>

              {/* Stanley Cabinet */}
              <button
                onClick={() => setActivePortalView('CABINET')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activePortalView === 'CABINET'
                    ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                    : 'text-[#D4D4D8] hover:bg-[#27272A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Layers className="w-4 h-4" />
                  <span>Stanley Cabinet (39)</span>
                </div>
                <span className="font-mono text-[10px] text-[#A1A1AA]">39</span>
              </button>

              {/* Central Stores Inventory */}
              <button
                onClick={() => setActivePortalView('INVENTORY')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activePortalView === 'INVENTORY'
                    ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                    : 'text-[#D4D4D8] hover:bg-[#27272A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Package className="w-4 h-4" />
                  <span>Central Stores Items</span>
                </div>
                <span className="font-mono text-[10px] text-[#A1A1AA]">{items.length}</span>
              </button>

              {/* Work Orders / Requisitions */}
              <button
                onClick={() => setActivePortalView('REQUISITIONS')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activePortalView === 'REQUISITIONS'
                    ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                    : 'text-[#D4D4D8] hover:bg-[#27272A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4" />
                  <span>Work Orders & Queries</span>
                </div>
                {stats && stats.active_reservations > 0 && (
                  <span className="w-5 h-5 rounded-full bg-[#FEF08A] text-[#18181B] font-bold text-[10px] flex items-center justify-center">
                    {stats.active_reservations}
                  </span>
                )}
              </button>

              {/* Audit Ledger */}
              <button
                onClick={() => setActivePortalView('LEDGER')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                  activePortalView === 'LEDGER'
                    ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                    : 'text-[#D4D4D8] hover:bg-[#27272A]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <History className="w-4 h-4" />
                  <span>Audit History Ledger</span>
                </div>
                <span className="font-mono text-[10px] text-[#A1A1AA]">{transactions.length}</span>
              </button>
            </div>
          </div>

          {/* Quick Actions & Profile at bottom of sidebar */}
          <div className="space-y-3 pt-4 border-t border-[#27272A]">
            <button
              onClick={() => setIsQrModalOpen(true)}
              className="w-full brutal-btn brutal-btn-yellow text-xs py-2 px-3"
            >
              <QrCode className="w-4 h-4" /> Print Drawer QR Sheet
            </button>

            {/* User Profile Card matching Image 1 */}
            <div className="p-3 rounded-xl bg-[#1C1D22] border border-[#2E3038] flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#FEF08A] text-[#18181B] font-black flex items-center justify-center text-sm border border-[#18181B]">
                📦
              </div>
              <div>
                <div className="font-bold text-xs text-white">S. Venkatesh</div>
                <div className="text-[10px] text-[#A1A1AA] font-mono">
                  Inventory Lead #INV-042
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Top Metric Cards */}
          {stats && <MetricCards stats={stats} />}

          {/* Requisition Action Card */}
          {stats && (
            <RequisitionCard
              requisitions={stats.pending_requisitions}
              onRefresh={loadAllData}
            />
          )}

          {/* Centerpiece 39-Drawer Stanley Organizer Visualizer */}
          <CabinetVisualizer
            drawers={drawers}
            selectedDrawerId={selectedDrawerId}
            onSelectDrawer={(id) => setSelectedDrawerId(id)}
          />

          {/* Bottom Grid: Inventory Table (Left) + Category Usage (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <InventoryTable
                items={items}
                onOpenReceiveModal={(sku) => handleOpenReceiveModal(sku)}
                onOpenConsumeModal={(sku, drawer) => {
                  setSelectedDrawerId(drawer);
                }}
                onOpenTransferModal={(sku, drawer) => {
                  setSelectedDrawerId(drawer);
                }}
              />
            </div>

            <div className="lg:col-span-1">
              {stats && <CategoryUsage usage={stats.category_usage} />}
            </div>
          </div>

          {/* Collapsible/Viewable Audit Transaction Ledger */}
          {(activePortalView === 'LEDGER' || transactions.length > 0) && (
            <div className="brutal-card p-6 bg-white">
              <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-[#18181B]">
                <div className="flex items-center gap-2.5">
                  <History className="w-5 h-5 text-[#18181B]" />
                  <h3 className="text-base font-black uppercase text-[#18181B]">
                    PERMANENT INVENTORY TRANSACTION LEDGER
                  </h3>
                </div>
                <span className="brutal-pill pill-yellow text-xs font-mono">
                  {transactions.length} AUDITED OPERATIONS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#18181B] text-[#52525B] font-black uppercase text-[11px]">
                      <th className="py-2 px-3">TIMESTAMP</th>
                      <th className="py-2 px-3">ACTION</th>
                      <th className="py-2 px-3">ITEM</th>
                      <th className="py-2 px-3 text-center">DRAWER</th>
                      <th className="py-2 px-3 text-right">CHANGE</th>
                      <th className="py-2 px-3 text-right">BALANCE AFTER</th>
                      <th className="py-2 px-3">DOC / NOTES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] font-mono">
                    {transactions.slice(0, 15).map((tx) => (
                      <tr key={tx.id} className="hover:bg-[#FBF9F5]">
                        <td className="py-2.5 px-3 text-[11px] text-[#71717A]">
                          {new Date(tx.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-bold">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              tx.action_type === 'RECEIVE'
                                ? 'bg-[#DCFCE7] text-[#166534]'
                                : tx.action_type === 'CONSUME'
                                ? 'bg-[#FEE2E2] text-[#991B1B]'
                                : 'bg-[#FEF08A] text-[#854D0E]'
                            }`}
                          >
                            {tx.action_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-[#18181B]">
                          {tx.item_sku}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-1.5 py-0.5 rounded border border-[#18181B] bg-white font-bold text-[10px]">
                            {tx.drawer_id || '—'}
                          </span>
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-black ${
                            tx.change_qty > 0 ? 'text-[#166534]' : 'text-[#991B1B]'
                          }`}
                        >
                          {tx.change_qty > 0 ? `+${tx.change_qty}` : tx.change_qty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-[#18181B]">
                          {tx.balance_after}
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[#52525B] font-sans truncate max-w-xs">
                          {tx.reference_doc ? `[${tx.reference_doc}] ` : ''}
                          {tx.notes}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODALS */}
      {/* 1. Drawer Inspection & Action Modal */}
      <DrawerModal
        drawerId={selectedDrawerId}
        onClose={() => setSelectedDrawerId(null)}
        onRefresh={loadAllData}
        onOpenReceiveForDrawer={(dId) => handleOpenReceiveModal(undefined, dId)}
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

      {/* 4. Live Android Phone Simulator */}
      <MobileSimulatorModal
        isOpen={isMobileSimOpen}
        onClose={() => setIsMobileSimOpen(false)}
        onDataChanged={loadAllData}
      />
    </div>
  );
};

export default App;
