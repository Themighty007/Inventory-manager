import React, { useState } from 'react';
import { ItemResponse } from '../../types/inventory';
import { Search, Plus, Package } from 'lucide-react';

interface InventoryTableProps {
  items: ItemResponse[];
  onOpenReceiveModal: (defaultSku?: string) => void;
  onOpenDrawerModal: (drawerId: string) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  onOpenReceiveModal,
  onOpenDrawerModal,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const categories = ['ALL', 'Electrical', 'Network', 'HVAC', 'Microcontrollers', 'Passives', 'Sensors'];

  const filteredItems = items.filter((it) => {
    const matchesSearch =
      it.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (it.description && it.description.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || it.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="brutal-card p-6 bg-white mb-6">
      {/* Table Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#86EFAC] border-2 border-[#18181B] flex items-center justify-center font-bold">
            <Package className="w-5 h-5 text-[#064E3B]" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-[#18181B] uppercase">
              Inventory List
            </h3>
            <p className="text-xs text-[#71717A] font-semibold">
              All registered electronic components and physical drawer locations
            </p>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search components or SKUs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] focus:outline-none focus:bg-white w-64"
            />
          </div>

          <button
            onClick={() => onOpenReceiveModal()}
            className="brutal-btn brutal-btn-mint text-xs py-1.5 px-3"
          >
            <Plus className="w-3.5 h-3.5" /> + Add / Receive Item
          </button>
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1 font-bold rounded-lg border-2 border-[#18181B] whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-[#18181B] text-white shadow-[2px_2px_0px_#18181B]'
                : 'bg-white text-[#18181B] hover:bg-[#F4F4F5]'
            }`}
          >
            {cat}
          </button>
        ))}
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
                <td colSpan={6} className="py-8 text-center text-xs text-[#71717A] font-semibold">
                  No components in inventory. Click "+ Add / Receive Item" to add your first part.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
