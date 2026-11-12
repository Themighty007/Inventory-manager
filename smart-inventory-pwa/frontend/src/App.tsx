import React, { useState, useEffect } from 'react';
import {
  DrawerSummary,
  ItemResponse,
  TransactionResponse,
  InvoiceSummaryResponse,
  PendingDeliveryItem,
} from './types/inventory';
import {
  fetchDrawers,
  fetchItems,
  fetchTransactions,
  fetchInvoices,
  fetchPendingDeliveries,
  checkServerHealth,
  syncBatchOperations,
} from './api/client';
import {
  getPendingOperations,
  removeOperation,
  updateOperationStatus,
  cacheDrawersOffline,
  getCachedDrawersOffline,
  cacheItemsOffline,
  getCachedItemsOffline,
} from './db/offlineDb';

import { DesktopDashboard } from './components/desktop/DesktopDashboard';
import { MobileHome } from './components/mobile/MobileHome';
import { CheckCircle, AlertTriangle, Monitor, Smartphone, Download, RefreshCw, User } from 'lucide-react';

export const App: React.FC = () => {
  // Device mode: AUTO, DESKTOP, MOBILE
  const [viewMode, setViewMode] = useState<'AUTO' | 'DESKTOP' | 'MOBILE'>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const param = urlParams.get('mode');
    if (param === 'mobile' || window.location.pathname.startsWith('/mobile')) return 'MOBILE';
    if (param === 'desktop') return 'DESKTOP';
    return 'AUTO';
  });

  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    return typeof window !== 'undefined' ? window.innerWidth < 850 : false;
  });

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [pendingCount, setPendingCount] = useState<number>(0);
  const [userName, setUserName] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userParam = urlParams.get('user');
    if (userParam) {
      localStorage.setItem('inventory_user_name', userParam);
      return userParam;
    }
    return localStorage.getItem('inventory_user_name') || 'Gowthum';
  });
  const [showInitialLogin, setShowInitialLogin] = useState<boolean>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('user')) return false;
    return !localStorage.getItem('inventory_user_name');
  });
  const [loginNameInput, setLoginNameInput] = useState('');

  const [drawers, setDrawers] = useState<DrawerSummary[]>([]);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
  const [invoices, setInvoices] = useState<InvoiceSummaryResponse[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<PendingDeliveryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // 1. Viewport resize detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 850);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Service Worker & PWA Install Prompt
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('PWA ServiceWorker registered with scope:', reg.scope))
        .catch((err) => console.warn('PWA ServiceWorker registration failed:', err));
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // 3. Online/Offline Network Monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      showNotice('Network connected. Re-checking sync queue...');
      syncPendingQueue();
      loadAllData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showNotice('Offline Mode: Disconnected from master server. All transactions will queue in IndexedDB.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic heartbeat to verify server reachability
    const interval = setInterval(async () => {
      const serverAlive = await checkServerHealth();
      setIsOnline((prev) => {
        if (!prev && serverAlive) {
          syncPendingQueue();
        }
        return serverAlive;
      });
      refreshPendingCount();
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  // 4. Initial Data Load
  useEffect(() => {
    loadAllData();
    refreshPendingCount();
  }, []);

  const refreshPendingCount = async () => {
    try {
      const ops = await getPendingOperations();
      setPendingCount(ops.length);
    } catch {
      setPendingCount(0);
    }
  };

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const loadAllData = async () => {
    try {
      const [d, it, tx, inv, pending] = await Promise.all([
        fetchDrawers(),
        fetchItems(),
        fetchTransactions(),
        fetchInvoices().catch(() => [] as InvoiceSummaryResponse[]),
        fetchPendingDeliveries().catch(() => [] as PendingDeliveryItem[]),
      ]);

      setDrawers(d);
      setItems(it);
      setTransactions(tx);
      setInvoices(inv);
      setPendingDeliveries(pending);
      setIsOnline(true);

      // Save fresh copy to IndexedDB for offline resilience
      cacheDrawersOffline(d);
      cacheItemsOffline(it);
    } catch (err) {
      console.warn('Network load error, falling back to IndexedDB offline cache:', err);
      setIsOnline(false);

      // Load cached offline data
      const cachedD = await getCachedDrawersOffline();
      const cachedIt = await getCachedItemsOffline();
      if (cachedD.length > 0) setDrawers(cachedD);
      if (cachedIt.length > 0) setItems(cachedIt);
    } finally {
      refreshPendingCount();
    }
  };

  const syncPendingQueue = async () => {
    try {
      const ops = await getPendingOperations();
      if (ops.length === 0) return;

      const res = await syncBatchOperations(ops);

      for (const r of res.results) {
        if (r.status === 'CONFIRMED' || r.status === 'ALREADY_CONFIRMED') {
          await removeOperation(r.client_op_id);
        } else {
          await updateOperationStatus(r.client_op_id, 'FAILED', r.error);
        }
      }

      showNotice(`Auto-synced ${res.synced_count} offline records with Windows master database!`);
      loadAllData();
    } catch (err) {
      console.warn('Auto-sync retry failed:', err);
    }
  };

  const handleUpdateUserName = (newName: string) => {
    setUserName(newName);
    localStorage.setItem('inventory_user_name', newName);
    showNotice(`User name updated to: ${newName}`);
  };

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      showNotice('App successfully installed to your device!');
      setInstallPrompt(null);
    }
  };

  // Determine whether to render Mobile or Desktop view
  const renderMobile =
    viewMode === 'MOBILE' || (viewMode === 'AUTO' && isMobileScreen);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8FAFC]">
      {/* View Switcher & Global Status Bar (Desktop Banner) */}
      <div className="bg-[#0B132B] text-white px-4 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-slate-800 z-30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#2EC4B6] animate-pulse' : 'bg-red-400'
              }`}
            />
            <b className="tracking-wide">{isOnline ? 'MASTER SERVER ONLINE' : 'OFFLINE MODE'}</b>
          </span>

          {pendingCount > 0 && (
            <span className="bg-[#00B4D8] text-white px-2 py-0.2 rounded-full font-bold text-[10px]">
              {pendingCount} Pending Sync
            </span>
          )}
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400 hidden sm:inline text-[10px]">VIEW:</span>
          <button
            onClick={() => setViewMode('AUTO')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors ${
              viewMode === 'AUTO'
                ? 'bg-[#00B4D8] text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => setViewMode('DESKTOP')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'DESKTOP'
                ? 'bg-[#00B4D8] text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3 h-3" /> Desktop
          </button>
          <button
            onClick={() => setViewMode('MOBILE')}
            className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors flex items-center gap-1 ${
              viewMode === 'MOBILE'
                ? 'bg-[#00B4D8] text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3 h-3" /> Mobile
          </button>
        </div>
      </div>

      {/* Global Notice Toast */}
      {notice && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#0B132B] border border-[#2EC4B6] text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl flex items-center gap-2 max-w-md w-[90%] animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-[#2EC4B6] shrink-0" />
          <span className="truncate">{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-auto font-mono text-xs text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Experience Body */}
      <div className="flex-1 overflow-hidden relative">
        {renderMobile ? (
          <MobileHome
            drawers={drawers}
            items={items}
            pendingDeliveries={pendingDeliveries}
            isOnline={isOnline}
            pendingCount={pendingCount}
            userName={userName}
            installPrompt={installPrompt}
            onRefresh={loadAllData}
            onNotice={showNotice}
            onInstallApp={handleInstallApp}
          />
        ) : (
          <DesktopDashboard
            drawers={drawers}
            items={items}
            transactions={transactions}
            invoices={invoices}
            pendingDeliveries={pendingDeliveries}
            userName={userName}
            isOnline={isOnline}
            installPrompt={installPrompt}
            onRefresh={loadAllData}
            onNotice={showNotice}
            onUpdateUserName={handleUpdateUserName}
            onInstallApp={handleInstallApp}
          />
        )}
      </div>

      {/* First-Time Sign In Prompt */}
      {showInitialLogin && (
        <div className="modal-overlay">
          <div className="skr-card bg-white p-6 max-w-sm w-full mx-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-200">
              <img
                src="/logos/logo-symbol.png"
                alt="SKR Tech"
                className="w-10 h-10 object-contain"
              />
              <div>
                <h2 className="text-base font-display font-bold text-[#0B132B]">
                  SKR Tech's Inventory System
                </h2>
                <p className="text-xs text-slate-500 font-medium">Enter your operator signature</p>
              </div>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = loginNameInput.trim();
                if (trimmed) {
                  handleUpdateUserName(trimmed);
                  setShowInitialLogin(false);
                }
              }}
            >
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1.5">
                Operator Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Gowthum"
                value={loginNameInput}
                onChange={(e) => setLoginNameInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-[#00B4D8] mb-4"
              />
              <button
                type="submit"
                className="w-full btn-cyan text-xs py-2.5 font-semibold rounded-xl"
              >
                Access System
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
