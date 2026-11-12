import React, { useState } from 'react';
import { ItemResponse } from '../../types/inventory';
import { Plus, Package, MapPin } from 'lucide-react';

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
    <div className="skr-card p-6 bg-white">
      {/* Table Header & Compact Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2EC4B6]/10 text-[#2EC4B6] border border-[#2EC4B6]/20 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold tracking-tight text-[#0B132B]">
              Component Inventory List
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {filteredItems.length} component{filteredItems.length === 1 ? '' : 's'} registered in Stanley storage matrix
            </p>
          </div>
        </div>

        {/* Clean Single Category Filter Dropdown */}
        <div className="flex items-center gap-3">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            aria-label="Filter by category"
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-slate-50 text-slate-700 focus:outline-none focus:border-[#00B4D8] cursor-pointer"
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
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 min-w-[140px]">SKU</th>
              <th className="py-3 px-4">ITEM DESCRIPTION</th>
              <th className="py-3 px-4 min-w-[130px] text-center">LOCATIONS</th>
              <th className="py-3 px-4 min-w-[100px] text-right">AVAILABLE</th>
              <th className="py-3 px-4 min-w-[100px] text-right">UNIT COST</th>
              <th className="py-3 px-4 min-w-[120px] text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* SKU */}
                  <td className="py-3 px-4">
                    <div className="font-mono font-bold text-xs text-[#0B132B]">
                      {item.sku}
                    </div>
                    <span className="text-[10px] text-[#00B4D8] uppercase font-semibold">
                      {item.category}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="py-3 px-4">
                    <div className="font-semibold text-xs text-[#1E293B]">
                      {item.name}
                    </div>
                    {item.description && (
                      <div className="text-[11px] text-slate-500">
                        {item.description}
                      </div>
                    )}
                  </td>

                  {/* Physical Locations */}
                  <td className="py-3 px-4 text-center">
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      {item.locations.length > 0 ? (
                        item.locations.map((loc) => (
                          <button
                            key={loc.drawer_id}
                            onClick={() => onOpenDrawerModal(loc.drawer_id)}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 hover:bg-[#00B4D8]/20 transition-all"
                            title={`Inspect ${loc.drawer_id}`}
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            {loc.drawer_id}: {loc.quantity}
                          </button>
                        ))
                      ) : (
                        <span className="text-slate-400 font-mono text-[11px]">—</span>
                      )}
                    </div>
                  </td>

                  {/* Available Balance */}
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono font-bold text-xs ${
                        (item.total_available ?? item.total_quantity ?? 0) <= (item.min_stock_threshold ?? item.reorder_point ?? 0)
                          ? 'text-rose-600 font-extrabold'
                          : 'text-[#2EC4B6]'
                      }`}
                    >
                      {item.total_available ?? item.total_quantity ?? 0}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Min: {item.min_stock_threshold ?? item.reorder_point ?? 0}
                    </span>
                  </td>

                  {/* Unit Cost */}
                  <td className="py-3 px-4 text-right font-mono font-semibold text-xs text-slate-700">
                    ₹{(item.unit_cost ?? item.unit_price ?? 0).toFixed(2)}
                  </td>

                  {/* Quick Action */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => onOpenReceiveModal(item.sku)}
                      className="inline-flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-[#00B4D8]/10 hover:text-[#00B4D8] border border-slate-200 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Receive
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Package className="w-8 h-8 text-slate-300" />
                    <span className="text-xs font-medium">
                      No components logged yet. Use <b>Add Stock</b> or <b>Upload Invoice</b> to add your first part.
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
