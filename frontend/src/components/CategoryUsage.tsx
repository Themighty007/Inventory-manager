import React from 'react';
import { CategoryUsageStat } from '../types/inventory';
import { PieChart } from 'lucide-react';

interface CategoryUsageProps {
  usage: CategoryUsageStat[];
}

export const CategoryUsage: React.FC<CategoryUsageProps> = ({ usage }) => {
  return (
    <div className="brutal-card p-6 bg-white flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b-2 border-[#18181B]">
          <h3 className="text-sm font-black tracking-tight text-[#18181B] uppercase flex items-center gap-2">
            <PieChart className="w-4 h-4 text-[#18181B]" />
            CATEGORY USAGE
          </h3>
          <span className="brutal-pill pill-yellow text-[11px]">
            30 DAYS
          </span>
        </div>

        <div className="space-y-4">
          {usage.map((u) => (
            <div key={u.category} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#18181B]">
                <span className="truncate max-w-[200px]">{u.category}</span>
                <span className="mono-num">{u.percentage}%</span>
              </div>
              <div className="w-full h-2.5 bg-[#F4F4F5] rounded-full border border-[#18181B] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${u.percentage}%`,
                    backgroundColor: u.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 pt-3 border-t border-[#E4E4E7] text-[11px] font-semibold text-[#71717A] flex items-center justify-between">
        <span>Total Parts Dispatched:</span>
        <span className="font-mono font-bold text-[#18181B]">38 items</span>
      </div>
    </div>
  );
};
