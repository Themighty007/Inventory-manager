import React from 'react';
import { DashboardStats } from '../types/inventory';
import { ShieldAlert, CheckCircle2, Bookmark, IndianRupee } from 'lucide-react';

interface MetricCardsProps {
  stats: DashboardStats;
}

export const MetricCards: React.FC<MetricCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. SKUs Monitored */}
      <div className="brutal-card p-5 bg-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black tracking-wider uppercase text-[#52525B]">
              SKUS MONITORED
            </span>
            <div className="w-7 h-7 rounded-md bg-[#F4F4F5] border border-[#18181B] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#18181B]" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight mono-num text-[#18181B]">
            {stats.skus_monitored}
          </div>
        </div>
        <div className="mt-3 text-xs font-semibold text-[#71717A] truncate">
          Electrical, HVAC, LAN, Passives
        </div>
      </div>

      {/* 2. Stock Availability */}
      <div className="brutal-card p-5 bg-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black tracking-wider uppercase text-[#52525B]">
              STOCK AVAILABILITY
            </span>
            <div className="w-7 h-7 rounded-md bg-[#86EFAC] border border-[#18181B] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-[#064E3B]" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight mono-num text-[#18181B]">
            {stats.stock_availability_pct}%
          </div>
        </div>
        <div className="mt-3 text-xs font-bold text-[#15803D] flex items-center gap-1">
          Zero Stockouts This Term
        </div>
      </div>

      {/* 3. Active Reservations */}
      <div className="brutal-card p-5 bg-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black tracking-wider uppercase text-[#52525B]">
              ACTIVE RESERVATIONS
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FEF08A] border border-[#18181B] flex items-center justify-center">
              <Bookmark className="w-4 h-4 text-[#713F12]" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight mono-num text-[#18181B]">
            {stats.active_reservations}
          </div>
        </div>
        <div className="mt-3 text-xs font-semibold text-[#52525B] truncate">
          {stats.pending_requisitions[0]
            ? `${stats.pending_requisitions[0].quantity}x ${stats.pending_requisitions[0].item_sku} for ${stats.pending_requisitions[0].target_location?.split(' ')[0] || 'Repair'}`
            : 'No active locks'}
        </div>
      </div>

      {/* 4. Procurement Budget */}
      <div className="brutal-card p-5 bg-white flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-black tracking-wider uppercase text-[#52525B]">
              PROCUREMENT BUDGET
            </span>
            <div className="w-7 h-7 rounded-md bg-[#FCA5A5] border border-[#18181B] flex items-center justify-center">
              <IndianRupee className="w-4 h-4 text-[#7F1D1D]" />
            </div>
          </div>
          <div className="text-3xl font-black tracking-tight mono-num text-[#18181B]">
            ₹{stats.procurement_budget_remaining.toLocaleString('en-IN')}
          </div>
        </div>
        <div className="mt-3 text-xs font-bold text-[#B91C1C]">
          Remaining Monthly Cap
        </div>
      </div>
    </div>
  );
};
