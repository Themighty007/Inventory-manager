import React, { useState } from 'react';
import { DrawerSummary } from '../types/inventory';
import { Layers, QrCode, CheckCircle2, Box } from 'lucide-react';

interface CabinetVisualizerProps {
  drawers: DrawerSummary[];
  selectedDrawerId: string | null;
  onSelectDrawer: (drawerId: string) => void;
  onOpenQrForDrawer: (drawerId: string) => void;
}

export const CabinetVisualizer: React.FC<CabinetVisualizerProps> = ({
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
    <div className="brutal-card p-6 bg-white">
      {/* Cabinet Visualizer Header */}
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

      {/* Stanley Cabinet Physical Frame */}
      <div className="stanley-cabinet-frame">
        {/* UPPER SECTION: 30 Small Drawers (6 cols x 5 rows) */}
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

                {/* Handle Graphic */}
                <div className="stanley-drawer-handle z-10" />

                {/* Bottom Row: Item Summary */}
                <div className="z-10 flex items-center justify-between text-[11px] font-mono w-full">
                  {d.is_occupied ? (
                    <>
                      <span className="text-[#E4E4E7] font-bold truncate max-w-[55px]">
                        {d.items_preview[0]?.split(' ')[0] || 'Item'}
                      </span>
                      <span className="text-[#86EFAC] font-black bg-black/60 px-1.5 py-0.5 rounded border border-[#86EFAC]/30 text-[10px]">
                        {d.total_units}u
                      </span>
                    </>
                  ) : (
                    <span className="text-[#71717A] italic text-[10px]">Empty</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* LOWER SECTION: 9 Large Drawers (3 cols x 3 rows) */}
        <div className="stanley-section-divider mt-6">
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
                  d.is_occupied ? 'drawer-status-yellow' : 'drawer-status-gray'
                } ${isSelected ? 'active-selected' : ''} ${
                  !isVisible ? 'opacity-25 pointer-events-none' : ''
                }`}
              >
                {/* Top Row */}
                <div className="flex items-center justify-between z-10 w-full">
                  <span className="font-mono text-sm font-black text-white px-2 py-0.5 rounded bg-black/60 border border-white/10">
                    {d.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#A1A1AA] uppercase font-mono">Large</span>
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
                </div>

                {/* Handle Graphic */}
                <div className="stanley-drawer-handle w-1/2 h-1.5 z-10" />

                {/* Bottom Row */}
                <div className="z-10 flex items-center justify-between text-xs font-mono w-full">
                  {d.is_occupied ? (
                    <>
                      <span className="text-[#E4E4E7] font-bold truncate max-w-[150px]">
                        {d.items_preview[0] || 'Component'}
                      </span>
                      <span className="text-[#86EFAC] font-black bg-black/60 px-2 py-0.5 rounded border border-[#86EFAC]/30">
                        {d.total_units} units
                      </span>
                    </>
                  ) : (
                    <span className="text-[#71717A] italic text-xs">Available compartment</span>
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
