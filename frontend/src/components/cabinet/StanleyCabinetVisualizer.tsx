import React, { useState } from 'react';
import { DrawerSummary } from '../../types/inventory';
import { Layers, QrCode } from 'lucide-react';

interface StanleyCabinetVisualizerProps {
  drawers: DrawerSummary[];
  selectedDrawerId: string | null;
  onSelectDrawer: (drawerId: string) => void;
  onOpenQrForDrawer: (drawerId: string) => void;
}

export const StanleyCabinetVisualizer: React.FC<StanleyCabinetVisualizerProps> = ({
  drawers,
  selectedDrawerId,
  onSelectDrawer,
  onOpenQrForDrawer,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OCCUPIED' | 'EMPTY'>('ALL');

  const smallDrawers = drawers.filter((d) => d.drawer_type === 'SMALL');
  const largeDrawers = drawers.filter((d) => d.drawer_type === 'LARGE');

  const matchesFilter = (d: DrawerSummary) => {
    if (filter === 'OCCUPIED') return d.is_occupied;
    if (filter === 'EMPTY') return !d.is_occupied;
    return true;
  };

  return (
    <div className="skr-card p-6 bg-white mb-6">
      {/* Cabinet Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center font-bold">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-display font-bold text-[#0B132B] tracking-tight">
              Stanley 39-Compartment Storage Matrix
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Upper Section: 30 Small Drawers (S01–S30) • Lower Section: 9 Large Drawers (L01–L09)
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['ALL', 'OCCUPIED', 'EMPTY'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                filter === mode
                  ? 'bg-[#0B132B] text-[#00B4D8] border border-[#00B4D8]/50 shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 border border-slate-200'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Physical Stanley 1-93-981 Cabinet Frame */}
      <div className="stanley-cabinet-frame">
        {/* UPPER SECTION: 30 Small Drawers (5 rows x 6 cols) */}
        <div className="stanley-section-divider">
          <span>Upper Section • 30 Small Drawers (S01 – S30)</span>
          <span className="text-[10px] text-slate-400 font-mono">13.5 × 5.0 × 3.5 cm</span>
        </div>

        <div className="stanley-grid-small">
          {smallDrawers.map((d) => {
            const isVisible = matchesFilter(d);
            const isSelected = selectedDrawerId === d.id;

            return (
              <div
                key={d.id}
                onClick={() => onSelectDrawer(d.id)}
                className={`stanley-drawer-cell ${
                  d.is_occupied ? 'drawer-status-mint' : 'drawer-status-gray'
                } ${isSelected ? 'active-selected' : ''} ${
                  !isVisible ? 'opacity-25 pointer-events-none' : ''
                }`}
              >
                {/* Top Row: Drawer ID & QR Icon */}
                <div className="flex items-center justify-between z-10 w-full">
                  <span className="font-mono text-xs font-bold text-white px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                    {d.id}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQrForDrawer(d.id);
                    }}
                    className="p-1 rounded hover:bg-white/15 transition-all text-slate-400 hover:text-[#00B4D8]"
                    title={`View QR for ${d.id}`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Center / Bottom: Occupancy Indicator & Preview */}
                <div className="z-10 mt-1 flex flex-col justify-end w-full">
                  {d.is_occupied ? (
                    <div>
                      <div className="font-mono font-bold text-sm text-[#2EC4B6] tracking-tight truncate">
                        {d.total_units} <span className="text-[10px] font-sans font-medium text-slate-300">units</span>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono truncate">
                        {d.items_preview[0] || '1 SKU'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium italic">
                      Empty
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* LOWER SECTION: 9 Large Drawers (3 rows x 3 cols) */}
        <div className="stanley-section-divider mt-5">
          <span>Lower Section • 9 Large Drawers (L01 – L09)</span>
          <span className="text-[10px] text-slate-400 font-mono">13.5 × 11.0 × 6.0 cm</span>
        </div>

        <div className="stanley-grid-large">
          {largeDrawers.map((d) => {
            const isVisible = matchesFilter(d);
            const isSelected = selectedDrawerId === d.id;

            return (
              <div
                key={d.id}
                onClick={() => onSelectDrawer(d.id)}
                className={`stanley-drawer-cell stanley-drawer-cell-large ${
                  d.is_occupied ? 'drawer-status-mint' : 'drawer-status-gray'
                } ${isSelected ? 'active-selected' : ''} ${
                  !isVisible ? 'opacity-25 pointer-events-none' : ''
                }`}
              >
                {/* Top Row: Drawer ID & QR Icon */}
                <div className="flex items-center justify-between z-10 w-full">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-white px-2 py-0.5 rounded bg-black/40 border border-white/10">
                      {d.id}
                    </span>
                    <span className="text-[9px] text-[#00B4D8] uppercase font-mono font-bold">Large</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQrForDrawer(d.id);
                    }}
                    className="p-1 rounded hover:bg-white/15 transition-all text-slate-400 hover:text-[#00B4D8]"
                    title={`View QR for ${d.id}`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Center / Bottom: Occupancy Indicator & Preview */}
                <div className="z-10 mt-2 flex flex-col justify-end w-full">
                  {d.is_occupied ? (
                    <div>
                      <div className="font-mono font-bold text-base text-[#2EC4B6] tracking-tight">
                        {d.total_units} <span className="text-xs font-sans font-medium text-slate-300">units</span>
                      </div>
                      <div className="text-[11px] text-slate-200 font-medium truncate">
                        {d.items_preview.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-medium italic">
                      Empty Compartment
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
