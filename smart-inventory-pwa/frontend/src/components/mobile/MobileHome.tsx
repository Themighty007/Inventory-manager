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
  Cpu,
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

    // Check if the scanned code is a Drawer identifier (e.g. "DRAWER:S01", "DRAWER:L03", "S01", "L05")
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
    <div className="flex flex-col h-full bg-[#121316] text-[#18181B] select-none overflow-hidden">
      {/* Mobile Top App Bar */}
      <header className="bg-[#121316] text-white px-4 py-2.5 border-b-2 border-[#18181B] flex items-center justify-between z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FEF08A] text-[#18181B] flex items-center justify-center font-black border-2 border-[#18181B] shadow-[1px_1px_0px_#18181B]">
            <Cpu className="w-4 h-4 text-[#18181B]" />
          </div>
          <div>
            <div className="text-xs font-black tracking-tight flex items-center gap-1.5">
              <span>Smart Inventory</span>
              <span className="text-[9px] text-[#86EFAC] font-mono px-1 rounded bg-[#86EFAC]/20">
                PWA
              </span>
            </div>
            <div className="text-[10px] text-[#A1A1AA] flex items-center gap-1 font-mono">
              {isOnline ? (
                <>
                  <Wifi className="w-3 h-3 text-[#86EFAC]" />
                  <span>Online ({userName})</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-[#FCA5A5]" />
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
              className="px-2 py-1 rounded-lg bg-[#86EFAC] text-[#064E3B] text-[10px] font-black border border-[#18181B] flex items-center gap-1"
              title="Install as Android App"
            >
              <Download className="w-3 h-3" /> Install
            </button>
          )}

          <button
            onClick={onRefresh}
            className="p-1.5 rounded-lg border border-[#3F3F46] bg-[#27272A] hover:bg-[#3F3F46] text-white"
            title="Refresh inventory"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Screen View Area */}
      <main className="flex-1 overflow-hidden relative">
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
      <nav className="bg-white border-t-2 border-[#18181B] py-2 px-1.5 flex items-center justify-around text-[10px] font-bold shadow-[0_-2px_10px_rgba(0,0,0,0.06)] z-20">
        <button
          onClick={() => setActiveTab('CABINET')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'CABINET'
              ? 'text-[#713F12] bg-[#FEF08A] border border-[#18181B] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#71717A]'
          }`}
        >
          <Layers className="w-4 h-4" /> Cabinet
        </button>

        <button
          onClick={() => setActiveTab('SCANNER')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'SCANNER'
              ? 'text-[#064E3B] bg-[#86EFAC] border border-[#18181B] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#71717A]'
          }`}
        >
          <Camera className="w-4 h-4" /> Scanner
        </button>

        <button
          onClick={() => setActiveTab('INVOICE')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'INVOICE'
              ? 'text-[#713F12] bg-[#FDE047] border border-[#18181B] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#71717A]'
          }`}
        >
          <FileText className="w-4 h-4" /> Invoice
        </button>

        <button
          onClick={() => {
            setScannedCode('');
            setActiveTab('INTAKE');
          }}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all ${
            activeTab === 'INTAKE'
              ? 'text-[#4C1D95] bg-[#DDD6FE] border border-[#18181B] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#71717A]'
          }`}
        >
          <PlusCircle className="w-4 h-4" /> Intake
        </button>

        <button
          onClick={() => setActiveTab('QUEUE')}
          className={`flex flex-col items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all relative ${
            activeTab === 'QUEUE'
              ? 'text-[#1E3A8A] bg-[#93C5FD] border border-[#18181B] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#71717A]'
          }`}
        >
          <Database className="w-4 h-4" /> Queue
          {pendingCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-[#B91C1C] text-white text-[9px] font-mono flex items-center justify-center border border-white absolute -top-1 right-0.5">
              {pendingCount}
            </span>
          )}
        </button>
      </nav>
    </div>
  );
};
