import React, { useState } from 'react';
import { DrawerSummary } from '../types/inventory';
import { Layers, Box, Info } from 'lucide-react';

interface CabinetVisualizerProps {
  drawers: DrawerSummary[];
  selectedDrawerId: string | null;
  onSelectDrawer: (drawerId: string) => void;
}

export const CabinetVisualizer: React.FC<CabinetVisualizerProps> = ({
  drawers,
  selectedDrawerId,
  onSelectDrawer,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'OCCUPIED' | 'EMPTY' | 'RESERVED'>('ALL');

  const smallDrawers = drawers.filter((d) => d.drawer_type === 'SMALL');
  const largeDrawers = drawers.filter((d) => d.drawer_type === 'LARGE');

  const matchesFilter = (d: DrawerSummary) => {
    if (filter === 'OCCUPIED') return d.is_occupied;
    if (filter === 'EMPTY') return !d.is_occupied;
    if (filter === 'RESERVED') return d.status_color === 'blue';
    return true;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'yellow':
        return <span className="w-2 h-2 rounded-full bg-[#FEF08A] inline-block shadow-sm" title="Occupied (Single SKU)"></span>;
      case 'purple':
        return <span className="w-2 h-2 rounded-full bg-[#DDD6FE] inline-block shadow-sm" title="Multi-SKU Compartment"></span>;
      case 'coral':
        return <span className="w-2 h-2 rounded-full bg-[#FCA5A5] inline-block shadow-sm" title="Low Stock Warning"></span>;
      case 'blue':
        return <span className="w-2 h-2 rounded-full bg-[#93C5FD] inline-block shadow-sm" title="Active Project Reservation"></span>;
      default:
        return <span className="w-2 h-2 rounded-full bg-[#52525B] inline-block" title="Empty / Available"></span>;
    }
  };

  return (
    <div className="brutal-card p-6 bg-white">
      {/* Visualizer Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center font-bold text-lg shadow-[2px_2px_0px_#18181B]">
            <Layers className="w-5 h-5 text-[#18181B]" />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#18181B]">
              STANLEY 1-93-981 CABINET VISUALIZER
            </h2>
            <p className="text-xs text-[#71717A] font-semibold">
              Physical Matrix: 30 Small Drawers (5×6) + 9 Large Drawers (3×3) • Total 39 Compartments
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {(['ALL', 'OCCUPIED', 'EMPTY', 'RESERVED'] as const).map((mode) => (
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

      {/* Stanley Cabinet Physical Replicating Frame */}
      <div className="stanley-cabinet-frame">
        {/* UPPER SECTION: 30 Small Drawers (6 cols x 5 rows) */}
        <div className="stanley-section-divider">
          <span>Upper Compartments • 30 Small Drawers (S01 – S30)</span>
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
                  d.status_color ? `drawer-status-${d.status_color}` : ''
                } ${isSelected ? 'active-selected' : ''} ${
                  !isVisible ? 'opacity-25 pointer-events-none' : ''
                }`}
              >
                {/* Top Row: Drawer ID & Status */}
                <div className="flex items-center justify-between z-10">
                  <span className="font-mono text-xs font-black text-white px-1.5 py-0.5 rounded bg-black/60 border border-white/10">
                    {d.id}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(d.status_color)}
                  </div>
                </div>

                {/* Handle Graphic */}
                <div className="stanley-drawer-handle z-10" />

                {/* Bottom Row: Item Summary */}
                <div className="z-10 flex items-center justify-between text-[11px] font-mono">
                  {d.is_occupied ? (
                    <>
                      <span className="text-[#E4E4E7] font-bold truncate max-w-[55px]">
                        {d.unique_items_count > 1 ? `${d.unique_items_count} SKUs` : d.items_preview[0]?.split(' ')[0] || '1 SKU'}
                      </span>
                      <span className="text-[#86EFAC] font-black bg-black/50 px-1 rounded">
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
          <span>Lower Compartments • 9 Large Drawers (L01 – L09)</span>
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
                  d.status_color ? `drawer-status-${d.status_color}` : ''
                } ${isSelected ? 'active-selected' : ''} ${
                  !isVisible ? 'opacity-25 pointer-events-none' : ''
                }`}
              >
                {/* Top Row */}
                <div className="flex items-center justify-between z-10">
                  <span className="font-mono text-sm font-black text-white px-2 py-0.5 rounded bg-black/60 border border-white/10">
                    {d.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#A1A1AA] uppercase font-mono">Large</span>
                    {getStatusBadge(d.status_color)}
                  </div>
                </div>

                {/* Handle Graphic */}
                <div className="stanley-drawer-handle w-1/2 h-1.5 z-10" />

                {/* Bottom Row */}
                <div className="z-10 flex items-center justify-between text-xs font-mono">
                  {d.is_occupied ? (
                    <>
                      <span className="text-[#E4E4E7] font-bold truncate max-w-[140px]">
                        {d.unique_items_count > 1
                          ? `${d.unique_items_count} SKUs Partitioned`
                          : d.items_preview[0] || '1 SKU'}
                      </span>
                      <span className="text-[#86EFAC] font-black bg-black/50 px-1.5 py-0.5 rounded">
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

      {/* Status Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#52525B] pt-3 border-t border-[#E4E4E7]">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#52525B] border border-[#18181B] inline-block"></span>
            Empty (Available)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FEF08A] border border-[#18181B] inline-block"></span>
            Occupied (1 SKU)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#DDD6FE] border border-[#18181B] inline-block"></span>
            Multi-SKU Partitioned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#FCA5A5] border border-[#18181B] inline-block"></span>
            Low Stock Alert
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#93C5FD] border border-[#18181B] inline-block"></span>
            Active Reservation
          </span>
        </div>
        <div className="text-[11px] text-[#A1A1AA] flex items-center gap-1">
          <Info className="w-3.5 h-3.5" /> Click any compartment to inspect or manage stock
        </div>
      </div>
    </div>
  );
};
