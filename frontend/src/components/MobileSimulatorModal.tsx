import React from 'react';
import { MobileApp } from '../mobile/MobileApp';
import { X, Smartphone, Wifi, BatteryCharging } from 'lucide-react';

interface MobileSimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataChanged: () => void;
}

export const MobileSimulatorModal: React.FC<MobileSimulatorModalProps> = ({
  isOpen,
  onClose,
  onDataChanged,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Close & Info Pill */}
        <div className="mb-3 flex items-center justify-between w-full max-w-[380px] px-2 text-white text-xs font-bold">
          <div className="flex items-center gap-1.5 bg-black/80 px-3 py-1 rounded-full border border-white/20">
            <Smartphone className="w-3.5 h-3.5 text-[#86EFAC]" />
            <span>Android Phone Simulator</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-black/80 border border-white/20 flex items-center justify-center hover:bg-black"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Realistic Android Phone Bezel Frame */}
        <div className="w-[375px] h-[740px] bg-[#121316] rounded-[48px] p-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_0_8px_#27272A] relative flex flex-col border-4 border-[#3F3F46] overflow-hidden">
          {/* Top Speaker & Camera Punch-hole Notch */}
          <div className="absolute top-5 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-50 flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#18181B] border border-[#27272A]" />
            <div className="w-1.5 h-1.5 rounded-full bg-[#27272A]" />
          </div>

          {/* Android Status Bar */}
          <div className="w-full h-8 bg-[#121316] text-white flex items-center justify-between px-6 pt-1 text-[11px] font-mono z-40 select-none">
            <span className="font-bold">1:35</span>
            <div className="flex items-center gap-1.5 text-[#A1A1AA]">
              <Wifi className="w-3 h-3 text-white" />
              <span>5G</span>
              <span className="text-[10px] font-bold text-white flex items-center gap-0.5">
                88% <BatteryCharging className="w-3.5 h-3.5 text-[#86EFAC]" />
              </span>
            </div>
          </div>

          {/* Phone Display Screen Area */}
          <div className="flex-1 rounded-[32px] overflow-hidden relative bg-[#F8F6F1] flex flex-col">
            <MobileApp onDataChanged={onDataChanged} />
          </div>

          {/* Bottom Home Indicator Bar */}
          <div className="w-32 h-1 bg-white/40 rounded-full mx-auto mt-2 mb-0.5" />
        </div>
      </div>
    </div>
  );
};
