import React, { useState } from 'react';
import { ItemResponse } from '../types/inventory';
import { Search, Plus, Minus, ArrowRightLeft, ExternalLink, AlertCircle } from 'lucide-react';

interface InventoryTableProps {
  items: ItemResponse[];
  onOpenReceiveModal: (defaultSku?: string) => void;
  onOpenConsumeModal: (sku: string, drawerId: string) => void;
  onOpenTransferModal: (sku: string, fromDrawerId: string) => void;
}

export const InventoryTable: React.FC<InventoryTableProps> = ({
  items,
  onOpenReceiveModal,
  onOpenConsumeModal,
  onOpenTransferModal,
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
    <div className="brutal-card p-6 bg-white">
      {/* Table Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-black tracking-tight text-[#18181B] uppercase">
            CENTRAL ENGINEERING STORES INVENTORY
          </h3>
          <span className="brutal-pill pill-dark text-xs">
            ALL LOGGED
          </span>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search SKUs, descriptions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs font-semibold rounded-lg border-2 border-[#18181B] bg-[#FAFAFA] focus:outline-none focus:bg-white w-56"
            />
          </div>

          <button
            onClick={() => onOpenReceiveModal()}
            className="brutal-btn brutal-btn-yellow text-xs py-1.5 px-3"
          >
            <Plus className="w-3.5 h-3.5" /> Add / Receive SKU
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
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b-2 border-[#18181B] text-[#52525B] font-black tracking-wider uppercase text-[11px]">
              <th className="py-2.5 px-3">SKU</th>
              <th className="py-2.5 px-3">ITEM DESCRIPTION</th>
              <th className="py-2.5 px-3 text-center">LOCATIONS</th>
              <th className="py-2.5 px-3 text-right">AVAILABLE</th>
              <th className="py-2.5 px-3 text-right">RESERVED</th>
              <th className="py-2.5 px-3 text-right">UNIT COST</th>
              <th className="py-2.5 px-3 text-center">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E4E4E7]">
            {filteredItems.map((item) => (
              <tr key={item.id} className="hover:bg-[#FBF9F5] transition-colors">
                {/* SKU */}
                <td className="py-3 px-3">
                  <div className="font-mono font-bold text-xs text-[#18181B] flex items-center gap-1.5">
                    {item.sku}
                    {item.is_low_stock && (
                      <span title="Low Stock Threshold Reached">
                        <AlertCircle className="w-3.5 h-3.5 text-[#B91C1C]" />
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[#71717A] uppercase font-semibold">
                    {item.category}
                  </span>
                </td>

                {/* Description */}
                <td className="py-3 px-3">
                  <div className="font-semibold text-xs text-[#18181B] max-w-sm truncate">
                    {item.name}
                  </div>
                  {item.description && (
                    <div className="text-[11px] text-[#71717A] truncate max-w-sm">
                      {item.description}
                    </div>
                  )}
                </td>

                {/* Locations / Drawers */}
                <td className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {item.locations.length > 0 ? (
                      item.locations.map((loc) => (
                        <span
                          key={loc.drawer_id}
                          className="font-mono px-2 py-0.5 rounded border border-[#18181B] bg-[#FEF08A] font-bold text-[10px]"
                          title={`${loc.quantity} ${item.unit} stored in ${loc.drawer_id}`}
                        >
                          {loc.drawer_id} ({loc.quantity})
                        </span>
                      ))
                    ) : (
                      <span className="text-[#A1A1AA] italic text-[11px]">Unassigned</span>
                    )}
                  </div>
                </td>

                {/* Available */}
                <td className="py-3 px-3 text-right font-mono font-black text-xs text-[#18181B]">
                  <span className={`px-2 py-0.5 rounded ${item.total_available <= item.min_stock_threshold ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#DCFCE7] text-[#166534]'}`}>
                    {item.total_available}
                  </span>
                </td>

                {/* Reserved */}
                <td className="py-3 px-3 text-right font-mono font-bold text-xs text-[#71717A]">
                  {item.total_reserved}
                </td>

                {/* Unit Cost */}
                <td className="py-3 px-3 text-right font-mono font-bold text-xs text-[#18181B]">
                  ₹{item.unit_cost.toLocaleString('en-IN')}
                </td>

                {/* Quick Actions */}
                <td className="py-3 px-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => onOpenReceiveModal(item.sku)}
                      className="p-1 rounded bg-[#86EFAC] border border-[#18181B] hover:bg-[#6EE7B7] transition-all"
                      title="Receive More Stock"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#064E3B]" />
                    </button>
                    {item.locations.length > 0 && (
                      <>
                        <button
                          onClick={() => onOpenConsumeModal(item.sku, item.locations[0].drawer_id)}
                          className="p-1 rounded bg-[#FCA5A5] border border-[#18181B] hover:bg-[#F87171] transition-all"
                          title="Consume / Deduct Stock"
                        >
                          <Minus className="w-3.5 h-3.5 text-[#7F1D1D]" />
                        </button>
                        <button
                          onClick={() => onOpenTransferModal(item.sku, item.locations[0].drawer_id)}
                          className="p-1 rounded bg-[#93C5FD] border border-[#18181B] hover:bg-[#60A5FA] transition-all"
                          title="Transfer to Another Drawer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5 text-[#1E3A8A]" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
