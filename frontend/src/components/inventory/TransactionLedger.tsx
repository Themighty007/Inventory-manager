import React from 'react';
import { TransactionResponse } from '../../types/inventory';
import { History } from 'lucide-react';

interface TransactionLedgerProps {
  transactions: TransactionResponse[];
  searchQuery?: string;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  searchQuery = '',
}) => {
  const term = searchQuery.trim().toLowerCase();
  const filteredTransactions = transactions.filter((tx) => {
    if (!term) return true;
    return (
      tx.item_sku.toLowerCase().includes(term) ||
      (tx.item_name && tx.item_name.toLowerCase().includes(term)) ||
      (tx.drawer_id && tx.drawer_id.toLowerCase().includes(term)) ||
      tx.action_type.toLowerCase().includes(term) ||
      (tx.reference_doc && tx.reference_doc.toLowerCase().includes(term)) ||
      (tx.notes && tx.notes.toLowerCase().includes(term))
    );
  });

  return (
    <div className="skr-card p-6 bg-white mb-6">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center">
            <History className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold text-[#0B132B]">
              Permanent Inventory Transaction Ledger
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Immutable audit trail of all receipts, deductions, and transfers
            </p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-700">
          {filteredTransactions.length} AUDITED MOVEMENTS
        </span>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 min-w-[165px]">TIMESTAMP / DATES</th>
              <th className="py-3 px-4 min-w-[100px]">ACTION</th>
              <th className="py-3 px-4 min-w-[150px]">ITEM</th>
              <th className="py-3 px-4 text-center min-w-[90px]">DRAWER</th>
              <th className="py-3 px-4 text-right min-w-[90px]">CHANGE</th>
              <th className="py-3 px-4 text-right min-w-[110px]">BALANCE AFTER</th>
              <th className="py-3 px-4">NOTES / REFERENCE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white font-mono">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-[11px] text-slate-500">
                    <div>{new Date(tx.timestamp).toLocaleString()}</div>
                    {(tx.order_date || tx.delivery_arrival_time) && (
                      <div className="flex flex-wrap gap-1 mt-1 font-sans">
                        {tx.order_date && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[9px] font-semibold text-slate-700">
                            Ord: {tx.order_date.slice(0, 10)}
                          </span>
                        )}
                        {tx.delivery_arrival_time && (
                          <span className="px-1.5 py-0.5 rounded bg-[#2EC4B6]/10 border border-[#2EC4B6]/20 text-[9px] font-semibold text-[#0E7490]">
                            Arr: {tx.delivery_arrival_time.replace('T', ' ').slice(0, 16)}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] ${
                        tx.action_type === 'RECEIVE'
                          ? 'bg-[#2EC4B6]/10 text-[#0E7490] border border-[#2EC4B6]/30'
                          : tx.action_type === 'CONSUME'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-[#00B4D8]/10 text-[#0284C7] border border-[#00B4D8]/30'
                      }`}
                    >
                      {tx.action_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-[#0B132B]">{tx.item_sku}</span>
                    <span className="block text-[10px] text-slate-500 font-sans truncate max-w-[180px]">
                      {tx.item_name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-700">
                      {tx.drawer_id || '—'}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      (tx.change_qty ?? tx.quantity_change ?? 0) > 0 ? 'text-[#2EC4B6]' : 'text-rose-600'
                    }`}
                  >
                    {(tx.change_qty ?? tx.quantity_change ?? 0) > 0 ? `+${tx.change_qty ?? tx.quantity_change ?? 0}` : (tx.change_qty ?? tx.quantity_change ?? 0)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-slate-700">
                    {tx.balance_after}
                  </td>
                  <td className="py-3 px-4 text-[11px] font-sans text-slate-600">
                    {tx.reference_doc && (
                      <span className="font-mono font-bold text-[#00B4D8] mr-2">
                        [{tx.reference_doc}]
                      </span>
                    )}
                    {tx.notes}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-sans text-xs">
                  No transactions recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
