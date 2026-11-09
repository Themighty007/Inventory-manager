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
    return localStorage.getItem('inventory_user_name') || 'Admin User';
  });
  const [showInitialLogin, setShowInitialLogin] = useState<boolean>(() => {
    return !localStorage.getItem('inventory_user_name');
  });
  const [loginNameInput, setLoginNameInput] = useState('');

  const [drawers, setDrawers] = useState<DrawerSummary[]>([]);
  const [items, setItems] = useState<ItemResponse[]>([]);
  const [transactions, setTransactions] = useState<TransactionResponse[]>([]);
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
      const [d, it, tx] = await Promise.all([
        fetchDrawers(),
        fetchItems(),
        fetchTransactions(),
      ]);

      setDrawers(d);
      setItems(it);
      setTransactions(tx);
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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#F8F6F1]">
      {/* View Switcher & Global Status Bar (Desktop Banner) */}
      <div className="bg-[#18181B] text-white px-4 py-1.5 flex items-center justify-between text-[11px] font-mono border-b border-[#27272A] z-30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? 'bg-[#86EFAC] animate-pulse' : 'bg-[#FCA5A5]'
              }`}
            />
            <b>{isOnline ? 'MASTER SERVER ONLINE' : 'OFFLINE MODE'}</b>
          </span>

          {pendingCount > 0 && (
            <span className="bg-[#B91C1C] text-white px-2 py-0.2 rounded-full font-bold text-[10px]">
              {pendingCount} Pending Sync
            </span>
          )}
        </div>

        {/* View Switcher Controls */}
        <div className="flex items-center gap-1.5">
          <span className="text-[#A1A1AA] hidden sm:inline">VIEW:</span>
          <button
            onClick={() => setViewMode('AUTO')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              viewMode === 'AUTO' ? 'bg-[#FEF08A] text-[#18181B]' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            Auto
          </button>
          <button
            onClick={() => setViewMode('DESKTOP')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
              viewMode === 'DESKTOP' ? 'bg-[#86EFAC] text-[#121316]' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Monitor className="w-3 h-3" /> Desktop
          </button>
          <button
            onClick={() => setViewMode('MOBILE')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
              viewMode === 'MOBILE' ? 'bg-[#DDD6FE] text-[#4C1D95]' : 'text-[#A1A1AA] hover:text-white'
            }`}
          >
            <Smartphone className="w-3 h-3" /> Mobile
          </button>
        </div>
      </div>

      {/* Global Notice Toast */}
      {notice && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-[#DCFCE7] border-2 border-[#15803D] text-[#15803D] px-4 py-2 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 max-w-md w-[90%]">
          <CheckCircle className="w-4 h-4 shrink-0" />
          <span className="truncate">{notice}</span>
          <button onClick={() => setNotice(null)} className="ml-auto font-mono text-xs">✕</button>
        </div>
      )}

      {/* Experience Body */}
      <div className="flex-1 overflow-hidden relative">
        {renderMobile ? (
          <MobileHome
            drawers={drawers}
            items={items}
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
          <div className="brutal-card bg-white p-6 max-w-sm w-full mx-4 shadow-[4px_4px_0px_#18181B] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[#18181B]">
              <div className="w-10 h-10 rounded-xl bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center font-bold">
                <User className="w-5 h-5 text-[#18181B]" />
              </div>
              <div>
                <h2 className="text-base font-black text-[#18181B] uppercase">Sign In</h2>
                <p className="text-xs text-[#71717A] font-semibold">Enter your name to access inventory</p>
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
              <label className="block text-xs font-black uppercase text-[#18181B] mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="Enter your name..."
                value={loginNameInput}
                onChange={(e) => setLoginNameInput(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] focus:outline-none focus:bg-white mb-4"
              />
              <button
                type="submit"
                className="w-full brutal-btn brutal-btn-mint text-xs py-2.5 font-black uppercase"
              >
                Continue to Inventory
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
