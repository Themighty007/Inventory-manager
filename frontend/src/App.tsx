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

// Default initial state matching Image 1 so UI renders immediately
const initialStats: DashboardStats = {
  skus_monitored: 8,
  stock_availability_pct: 98.2,
  active_reservations: 1,
  procurement_budget_remaining: 42500,
  currency_symbol: "₹",
  total_drawers: 39,
  occupied_drawers: 9,
  empty_drawers: 30,
  category_usage: [
    { category: "Electrical (MCBs, Fuses)", percentage: 62.0, color: "#86EFAC", item_count: 1 },
    { category: "Network (Cat6, RJ45)", percentage: 24.0, color: "#93C5FD", item_count: 1 },
    { category: "HVAC (Coolant, Filters)", percentage: 14.0, color: "#F472B6", item_count: 2 },
  ],
  pending_requisitions: [
    {
      id: 1,
      requisition_code: "REQ-8821",
      item_sku: "MCB-63A-3P",
      item_name: "Triple Pole 63A Miniature Circuit Breaker (10kA)",
      drawer_id: "S04",
      quantity: 1,
      status: "PENDING",
      requester: "Rajesh Kumar (Lead Tech)",
      target_location: "Hall B-204 Main Power Outage",
      priority: "HIGH_EXAM",
      created_at: new Date().toISOString(),
    },
  ],
};

// Prepopulate 39 Stanley drawers
const initialDrawers: DrawerSummary[] = [
  ...Array.from({ length: 30 }, (_, i) => {
    const num = i + 1;
    const id = `S${num < 10 ? '0' + num : num}`;
    const row = Math.floor(i / 6) + 1;
    const col = (i % 6) + 1;
    const isOccupied = ['S01', 'S02', 'S03', 'S04', 'S12'].includes(id);
    return {
      id,
      section: 'UPPER' as const,
      drawer_type: 'SMALL' as const,
      row_idx: row,
      col_idx: col,
      dimensions: '13.5 x 5.0 x 3.5 cm',
      is_occupied: isOccupied,
      unique_items_count: isOccupied ? 1 : 0,
      total_units: id === 'S03' ? 120 : id === 'S12' ? 8 : id === 'S04' ? 3 : isOccupied ? 5 : 0,
      status_color: (id === 'S04' ? 'blue' : isOccupied ? 'yellow' : 'gray') as 'gray' | 'yellow' | 'purple' | 'coral' | 'blue',
      items_preview: isOccupied ? [id === 'S12' ? 'ESP32 (8)' : id === 'S04' ? 'MCB (3)' : 'Item (5)'] : [],
    };
  }),
  ...Array.from({ length: 9 }, (_, i) => {
    const num = i + 1;
    const id = `L0${num}`;
    const row = Math.floor(i / 3) + 1;
    const col = (i % 3) + 1;
    const isOccupied = ['L01', 'L02', 'L05', 'L08'].includes(id);
    return {
      id,
      section: 'LOWER' as const,
      drawer_type: 'LARGE' as const,
      row_idx: row,
      col_idx: col,
      dimensions: '13.5 x 11.0 x 6.0 cm',
      is_occupied: isOccupied,
      unique_items_count: isOccupied ? 1 : 0,
      total_units: id === 'L02' ? 14 : id === 'L08' ? 4 : isOccupied ? 3 : 0,
      status_color: (isOccupied ? 'yellow' : 'gray') as 'gray' | 'yellow' | 'purple' | 'coral' | 'blue',
      items_preview: isOccupied ? ['Bulk Component'] : [],
    };
  }),
];

export const App: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [drawers, setDrawers] = useState<DrawerSummary[]>(initialDrawers);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [loading, setLoading] = useState(false);

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
      console.warn('Backend loading: using initialized default state', err);
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
    <div className="app-layout">
      {/* 1. Left Obsidian Sidebar matching Image 1 */}
      <aside className="sidebar-container">
        <div className="flex flex-col gap-5">
          {/* Logo */}
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="w-9 h-9 rounded-xl bg-[#FEF08A] text-[#18181B] flex items-center justify-center font-black border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
              <Shield className="w-5 h-5 text-[#18181B]" />
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
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-black tracking-widest uppercase text-[#71717A] px-2 mb-1">
              PORTAL VIEWS
            </div>

            {/* CRM Overview */}
            <button
              onClick={() => setActivePortalView('OVERVIEW')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-black transition-all ${
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
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
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
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activePortalView === 'INVENTORY'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Package className="w-4 h-4" />
                <span>Central Stores Items</span>
              </div>
              <span className="font-mono text-[10px] text-[#A1A1AA]">{items.length || 8}</span>
            </button>

            {/* Work Orders / Requisitions */}
            <button
              onClick={() => setActivePortalView('REQUISITIONS')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activePortalView === 'REQUISITIONS'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4" />
                <span>Work Orders & Queries</span>
              </div>
              <span className="w-5 h-5 rounded-full bg-[#FEF08A] text-[#18181B] font-bold text-[10px] flex items-center justify-center">
                {stats.active_reservations}
              </span>
            </button>

            {/* Audit Ledger */}
            <button
              onClick={() => setActivePortalView('LEDGER')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activePortalView === 'LEDGER'
                  ? 'bg-[#86EFAC] text-[#121316] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]'
                  : 'text-[#D4D4D8] hover:bg-[#27272A]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <History className="w-4 h-4" />
                <span>Audit History Ledger</span>
              </div>
              <span className="font-mono text-[10px] text-[#A1A1AA]">{transactions.length || 10}</span>
            </button>
          </div>
        </div>

        {/* Quick Actions & Profile at bottom of sidebar */}
        <div className="flex flex-col gap-3 pt-4 border-t border-[#27272A]">
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

      {/* 2. Main Canvas */}
      <div className="main-canvas">
        {/* Top Header Bar matching Image 1 */}
        <header className="top-header">
          <div className="flex items-center gap-3">
            <div className="brutal-pill pill-yellow font-black text-xs uppercase tracking-wider">
              PORTAL: STORES & PROCUREMENT MANAGER
            </div>
            <span className="text-xs font-semibold text-[#71717A] hidden lg:inline">
              Central Engineering Stores & Spare Parts Procurement
            </span>
          </div>

          {/* Right side role switches & Mobile launcher */}
          <div className="flex items-center gap-2">
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

        {/* Content Body with 24px padding */}
        <main className="content-body">
          {/* Row 1: 4 Top Metric Cards */}
          <MetricCards stats={stats} />

          {/* Row 2: Technician Requisition Card */}
          <RequisitionCard
            requisitions={stats.pending_requisitions}
            onRefresh={loadAllData}
          />

          {/* Row 3: Centerpiece Stanley 1-93-981 39-Drawer Visualizer */}
          <CabinetVisualizer
            drawers={drawers}
            selectedDrawerId={selectedDrawerId}
            onSelectDrawer={(id) => setSelectedDrawerId(id)}
          />

          {/* Row 4: Central Engineering Stores Table (Left) + Category Usage (Right) */}
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
              <CategoryUsage usage={stats.category_usage} />
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
                  {transactions.length || 10} AUDITED OPERATIONS
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b-2 border-[#18181B] text-[#52525B] font-black uppercase text-[11px]">
                      <th className="py-2.5 px-3">TIMESTAMP</th>
                      <th className="py-2.5 px-3">ACTION</th>
                      <th className="py-2.5 px-3">ITEM</th>
                      <th className="py-2.5 px-3 text-center">DRAWER</th>
                      <th className="py-2.5 px-3 text-right">CHANGE</th>
                      <th className="py-2.5 px-3 text-right">BALANCE AFTER</th>
                      <th className="py-2.5 px-3">DOC / NOTES</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E4E7] font-mono">
                    {(transactions.length > 0 ? transactions.slice(0, 15) : [
                      { id: '1', timestamp: new Date().toISOString(), action_type: 'RECEIVE', item_sku: 'MCB-63A-3P', drawer_id: 'S04', change_qty: 3, balance_after: 3, reference_doc: 'INV-2026-8801', notes: 'Initial receipt of 3-pole circuit breakers' },
                      { id: '2', timestamp: new Date().toISOString(), action_type: 'RECEIVE', item_sku: 'CAT6-50M-SHLD', drawer_id: 'L02', change_qty: 14, balance_after: 14, reference_doc: 'INV-2026-7731', notes: 'Networking spool restock' },
                      { id: '3', timestamp: new Date().toISOString(), action_type: 'RECEIVE', item_sku: 'ESP32-DEV-01', drawer_id: 'S12', change_qty: 10, balance_after: 10, reference_doc: 'INV-2026-00125', notes: 'Parcel TRACK123456 intake' },
                      { id: '4', timestamp: new Date().toISOString(), action_type: 'CONSUME', item_sku: 'ESP32-DEV-01', drawer_id: 'S12', change_qty: -2, balance_after: 8, reference_doc: 'LAB-TEST-01', notes: '2 boards used for IoT gateway prototyping' },
                    ]).map((tx: any) => (
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
