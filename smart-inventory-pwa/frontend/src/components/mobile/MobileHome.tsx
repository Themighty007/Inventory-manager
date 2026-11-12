import React, { useState } from 'react';
import { DrawerSummary, ItemResponse } from '../../types/inventory';
import { MobileScanner } from './MobileScanner';
import { MobileParcelIntake } from './MobileParcelIntake';
import { MobileInvoiceIntake } from './MobileInvoiceIntake';
import { MobileCabinetView } from './MobileCabinetView';
import { MobileSyncQueue } from './MobileSyncQueue';
import {
  Camera,
  Layers,
  Database,
  PlusCircle,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  FileText,
} from 'lucide-react';

interface MobileHomeProps {
  drawers: DrawerSummary[];
  items: ItemResponse[];
  isOnline: boolean;
  pendingCount: number;
  userName: string;
  installPrompt: any;
  onRefresh: () => void;
  onNotice: (msg: string) => void;
  onInstallApp: () => void;
}

export const MobileHome: React.FC<MobileHomeProps> = ({
  drawers,
  items,
  isOnline,
  pendingCount,
  userName,
  installPrompt,
  onRefresh,
  onNotice,
  onInstallApp,
}) => {
  const [activeTab, setActiveTab] = useState<'CABINET' | 'SCANNER' | 'INVOICE' | 'INTAKE' | 'QUEUE'>('CABINET');
  const [scannedCode, setScannedCode] = useState<string>('');

  const handleScanCompleted = (code: string) => {
    setScannedCode(code);

    const drawerMatch = code.match(/^(?:DRAWER:)?([SL]\d{2})$/i);
    if (drawerMatch) {
      const drawerId = drawerMatch[1].toUpperCase();
      if (drawers.some((d) => d.id === drawerId)) {
        setScannedCode(`DRAWER:${drawerId}`);
        setActiveTab('INTAKE');
        onNotice(`Compartment ${drawerId} recognized! Assigning item to ${drawerId}.`);
        return;
      }
    }

    setActiveTab('INTAKE');
    onNotice(`Code detected: ${code}`);
  };

  const handleIntakeCompleted = (msg: string) => {
    onNotice(msg);
    setActiveTab('CABINET');
    onRefresh();
  };

  const handleIntakeForDrawer = (drawerId: string) => {
    setScannedCode(`DRAWER:${drawerId}`);
    setActiveTab('INTAKE');
  };

  return (
    <div className="flex flex-col h-full bg-[#0B132B] text-slate-100 select-none overflow-hidden">
      {/* Mobile Top App Bar */}
      <header className="bg-[#0B132B] text-white px-4 py-2.5 border-b border-slate-800 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          <img
            src="/logos/logo-symbol.png"
            alt="SKR Tech Logo"
            className="w-7 h-7 object-contain"
          />
          <div>
            <div className="text-xs font-display font-bold tracking-tight flex items-center gap-1.5">
              <span>SKR Tech's Inventory System</span>
              <span className="text-[9px] text-[#00B4D8] font-mono px-1 rounded bg-[#00B4D8]/10 border border-[#00B4D8]/20">
                PWA
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-[#2EC4B6]" />
                  <span>Online ({userName})</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-red-400" />
                  <span>Offline ({userName})</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {installPrompt && (
            <button
              onClick={onInstallApp}
              className="px-2 py-1 rounded-lg bg-[#00B4D8] text-white text-[10px] font-semibold flex items-center gap-1 shadow-xs hover:bg-[#0096b4]"
              title="Install as Android App"
            >
              <Download className="w-3 h-3" /> Install
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Refresh inventory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Screen View Area */}
      <main className="flex-1 overflow-hidden relative bg-[#F8FAFC]">
        {activeTab === 'CABINET' && (
          <MobileCabinetView
            drawers={drawers}
            isOnline={isOnline}
            userName={userName}
            onRefresh={onRefresh}
            onIntakeForDrawer={handleIntakeForDrawer}
            onNotice={onNotice}
          />
        )}

        {activeTab === 'SCANNER' && (
          <MobileScanner
            onScanResult={handleScanCompleted}
            onCancel={() => setActiveTab('CABINET')}
          />
        )}

        {activeTab === 'INVOICE' && (
          <MobileInvoiceIntake
            drawers={drawers}
            isOnline={isOnline}
            userName={userName}
            onCompleted={handleIntakeCompleted}
            onSwitchToManual={() => setActiveTab('INTAKE')}
          />
        )}

        {activeTab === 'INTAKE' && (
          <MobileParcelIntake
            initialCode={scannedCode}
            drawers={drawers}
            isOnline={isOnline}
            userName={userName}
            onCompleted={handleIntakeCompleted}
            onBack={() => setActiveTab('SCANNER')}
            onSwitchToInvoice={() => setActiveTab('INVOICE')}
          />
        )}

        {activeTab === 'QUEUE' && (
          <MobileSyncQueue
            isOnline={isOnline}
            onSyncCompleted={onRefresh}
            onNotice={onNotice}
          />
        )}
      </main>

      {/* Bottom PWA Tab Bar */}
      <nav className="bg-[#0B132B] border-t border-slate-800 py-1.5 px-2 flex items-center justify-around text-[10px] font-semibold shadow-lg z-20 shrink-0">
        <button
          onClick={() => setActiveTab('CABINET')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'CABINET'
              ? 'text-[#00B4D8] bg-[#00B4D8]/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Cabinet</span>
        </button>

        <button
          onClick={() => setActiveTab('SCANNER')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'SCANNER'
              ? 'text-[#00B4D8] bg-[#00B4D8]/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Camera className="w-4 h-4" />
          <span>Scanner</span>
        </button>

        <button
          onClick={() => setActiveTab('INVOICE')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'INVOICE'
              ? 'text-[#00B4D8] bg-[#00B4D8]/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoice</span>
        </button>

        <button
          onClick={() => {
            setScannedCode('');
            setActiveTab('INTAKE');
          }}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all ${
            activeTab === 'INTAKE'
              ? 'text-[#00B4D8] bg-[#00B4D8]/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>Intake</span>
        </button>

        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-xl transition-all relative ${
            activeTab === 'QUEUE'
              ? 'text-[#00B4D8] bg-[#00B4D8]/10'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Queue</span>
          {pendingCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#00B4D8] text-white text-[9px] font-mono flex items-center justify-center absolute -top-1 right-0.5 shadow-xs">
              {pendingCount}
            </span>
          )}
        </button>
      </nav>

      {/* Developer Attribution Footer */}
      <footer className="bg-[#0B132B] border-t border-slate-900 py-1 text-center text-[9px] text-slate-400 font-medium shrink-0">
        SKR Tech's Inventory System • Developed by <span className="text-[#00B4D8] font-semibold">Gowthum Vijaay D</span>
      </footer>
    </div>
  );
};
