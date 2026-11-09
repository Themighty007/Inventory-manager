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
    <div className="brutal-card p-6 bg-white mb-6">
      {/* Cabinet Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center font-bold text-lg shadow-[2px_2px_0px_#18181B]">
            <Layers className="w-5 h-5 text-[#18181B]" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#18181B]">
              Cabinet
            </h2>
            <p className="text-xs text-[#71717A] font-semibold">
              39 Compartments: 30 Small Drawers (S01–S30) • 9 Large Drawers (L01–L09)
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['ALL', 'OCCUPIED', 'EMPTY'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border-2 border-[#18181B] transition-all ${
                filter === mode
                  ? 'bg-[#18181B] text-white shadow-[2px_2px_0px_#18181B]'
                  : 'bg-white text-[#18181B] hover:bg-[#F4F4F5]'
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
          <span className="text-[10px] text-[#A1A1AA] font-mono">13.5 × 5.0 × 3.5 cm</span>
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
                  d.is_occupied ? 'drawer-status-yellow' : 'drawer-status-gray'
                } ${isSelected ? 'active-selected' : ''} ${
                  !isVisible ? 'opacity-25 pointer-events-none' : ''
                }`}
              >
                {/* Top Row: Drawer ID & QR Icon */}
                <div className="flex items-center justify-between z-10 w-full">
                  <span className="font-mono text-xs font-black text-white px-1.5 py-0.5 rounded bg-black/60 border border-white/10">
                    {d.id}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQrForDrawer(d.id);
                    }}
                    className="p-1 rounded hover:bg-white/20 transition-all text-[#A1A1AA] hover:text-[#86EFAC]"
                    title={`View QR for ${d.id}`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Center / Bottom: Occupancy Indicator & Preview */}
                <div className="z-10 mt-1 flex flex-col justify-end w-full">
                  {d.is_occupied ? (
                    <div>
                      <div className="font-mono font-black text-sm text-[#FEF08A] tracking-tight truncate">
                        {d.total_units} <span className="text-[10px] font-sans font-semibold text-white/70">units</span>
                      </div>
                      <div className="text-[10px] text-[#D4D4D8] font-mono truncate">
                        {d.items_preview[0] || '1 SKU'}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[#71717A] font-semibold italic">
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
          <span className="text-[10px] text-[#A1A1AA] font-mono">13.5 × 11.0 × 6.0 cm</span>
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
                    <span className="font-mono text-xs font-black text-white px-2 py-0.5 rounded bg-black/60 border border-white/10">
                      {d.id}
                    </span>
                    <span className="text-[9px] text-[#A1A1AA] uppercase font-mono">Large</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenQrForDrawer(d.id);
                    }}
                    className="p-1 rounded hover:bg-white/20 transition-all text-[#A1A1AA] hover:text-[#86EFAC]"
                    title={`View QR for ${d.id}`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Center / Bottom: Occupancy Indicator & Preview */}
                <div className="z-10 mt-2 flex flex-col justify-end w-full">
                  {d.is_occupied ? (
                    <div>
                      <div className="font-mono font-black text-base text-[#86EFAC] tracking-tight">
                        {d.total_units} <span className="text-xs font-sans font-semibold text-white/70">units</span>
                      </div>
                      <div className="text-[11px] text-[#E4E4E7] font-semibold truncate">
                        {d.items_preview.join(', ')}
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-[#71717A] font-semibold italic">
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
