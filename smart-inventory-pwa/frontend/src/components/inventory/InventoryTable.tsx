import React, { useState } from 'react';
import { ItemResponse } from '../../types/inventory';
import { Plus, Package } from 'lucide-react';

interface InventoryTableProps {
  items: ItemResponse[];
  searchQuery?: string;
  onOpenReceiveModal: (defaultSku?: string) => void;
  onOpenDrawerModal: (drawerId: string) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  searchQuery = '',
  onOpenReceiveModal,
  onOpenDrawerModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = [
    'ALL',
    'Microcontrollers',
    'Semiconductors',
    'Passives',
    'Electrical',
    'Sensors',
    'Cables & Connectors',
    'Network',
    'HVAC',
    'Tools & Mechanical',
    'Hardware',
    'General',
  ];

  const effectiveSearch = searchQuery.trim().toLowerCase();

  const filteredItems = items.filter((it) => {
    const matchesSearch =
      !effectiveSearch ||
      it.sku.toLowerCase().includes(effectiveSearch) ||
      it.name.toLowerCase().includes(effectiveSearch) ||
      (it.description && it.description.toLowerCase().includes(effectiveSearch)) ||
      it.locations.some((l) => l.drawer_id.toLowerCase().includes(effectiveSearch));

    const matchesCategory = selectedCategory === 'ALL' || it.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="brutal-card p-6 bg-white">
      {/* Table Header & Compact Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#86EFAC] border-2 border-[#18181B] flex items-center justify-center shadow-[2px_2px_0px_#18181B] shrink-0">
            <Package className="w-5 h-5 text-[#064E3B]" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-[#18181B] uppercase">
              Inventory List
            </h3>
            <p className="text-xs text-[#71717A] font-semibold">
              {filteredItems.length} component{filteredItems.length === 1 ? '' : 's'} shown across physical cabinet drawers
            </p>
          </div>
        </div>

        {/* Clean Single Category Filter Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="px-3.5 py-2 text-xs font-bold rounded-xl border-2 border-[#18181B] bg-[#FAF9F5] text-[#18181B] focus:outline-none focus:bg-white cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'ALL' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border-2 border-[#18181B] rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF9F5] border-b-2 border-[#18181B] text-[#18181B] font-black tracking-wider uppercase text-[11px]">
              <th className="py-3 px-4 min-w-[140px]">SKU</th>
              <th className="py-3 px-4">ITEM DESCRIPTION</th>
              <th className="py-3 px-4 min-w-[130px] text-center">LOCATIONS</th>
              <th className="py-3 px-4 min-w-[100px] text-right">AVAILABLE</th>
              <th className="py-3 px-4 min-w-[100px] text-right">UNIT COST</th>
              <th className="py-3 px-4 min-w-[120px] text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#18181B] bg-white">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-[#FBF9F5] transition-colors">
                  {/* SKU */}
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-xs text-[#18181B]">
                      {item.sku}
                    </div>
                    <span className="text-[10px] text-[#71717A] uppercase font-semibold">
                      {item.category}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-xs text-[#18181B]">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-[#71717A]">
                        {item.description}
                      </div>
                    )}
                    {(item.last_order_date || item.last_delivery_time) && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {item.last_order_date && (
                          <span className="px-1.5 py-0.2 rounded bg-[#FEF9C3] border border-[#CA8A04] font-mono text-[9px] font-bold text-[#713F12]">
                            Ord: {item.last_order_date.slice(0, 10)}
                          </span>
                        )}
                        {item.last_delivery_time && (
                          <span className="px-1.5 py-0.2 rounded bg-[#DCFCE7] border border-[#16A34A] font-mono text-[9px] font-bold text-[#166534]">
                            Arr: {item.last_delivery_time.replace('T', ' ').slice(0, 16)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Locations / Drawers */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {item.locations.length > 0 ? (
                        item.locations.map((loc) => (
                          <button
                            key={loc.drawer_id}
                            onClick={() => onOpenDrawerModal(loc.drawer_id)}
                            className="font-mono px-2 py-0.5 rounded border border-[#18181B] bg-[#FEF08A] hover:bg-[#FDE047] font-bold text-[10px] cursor-pointer"
                            title={`Click to open Drawer ${loc.drawer_id}`}
                          >
                            {loc.drawer_id} ({loc.quantity})
                          </button>
                        ))
                      ) : (
                        <span className="text-[#A1A1AA] italic text-[11px]">Unassigned</span>
                      )}
                    </div>
                  </td>

                  {/* Available */}
                  <td className="py-3 px-4 text-right font-mono font-black text-xs text-[#18181B]">
                    <span className="px-2.5 py-1 rounded bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] inline-block">
                      {item.total_available} {item.unit}
                    </span>
                  </td>

                  {/* Unit Cost */}
                  <td className="py-3 px-4 text-right font-mono font-bold text-xs text-[#18181B]">
                    ₹{item.unit_cost.toLocaleString('en-IN')}
                  </td>

                  {/* Quick Actions */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onOpenReceiveModal(item.sku)}
                        className="p-1.5 rounded bg-[#86EFAC] border border-[#18181B] hover:bg-[#6EE7B7] text-[#064E3B] transition-all"
                        title="Add Stock"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                      {item.locations.length > 0 && (
                        <button
                          onClick={() => onOpenDrawerModal(item.locations[0].drawer_id)}
                          className="px-2 py-1 rounded bg-[#FEF08A] border border-[#18181B] hover:bg-[#FDE047] text-[#18181B] text-[11px] font-bold transition-all"
                          title="Manage in Drawer"
                        >
                          View / Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-10 px-4 text-center text-xs text-[#71717A] font-semibold">
                  No components logged yet. Use <span className="font-black text-[#18181B]">Add Stock</span> or <span className="font-black text-[#18181B]">Upload Invoice</span> at the top to add parts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
