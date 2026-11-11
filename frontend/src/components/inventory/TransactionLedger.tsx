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
    <div className="brutal-card p-6 bg-white mb-6">
      <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-[#18181B]">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-[#18181B]" />
          <h3 className="text-base font-black uppercase text-[#18181B]">
            Permanent Inventory Transaction Ledger
          </h3>
        </div>
        <span className="brutal-pill pill-yellow text-xs font-mono font-bold">
          {filteredTransactions.length} AUDITED MOVEMENTS
        </span>
      </div>

      <div className="overflow-x-auto border-2 border-[#18181B] rounded-xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF9F5] border-b-2 border-[#18181B] text-[#18181B] font-black uppercase text-[11px]">
              <th className="py-3 px-4 min-w-[165px]">TIMESTAMP / DATES</th>
              <th className="py-3 px-4 min-w-[100px]">ACTION</th>
              <th className="py-3 px-4 min-w-[150px]">ITEM</th>
              <th className="py-3 px-4 text-center min-w-[90px]">DRAWER</th>
              <th className="py-3 px-4 text-right min-w-[90px]">CHANGE</th>
              <th className="py-3 px-4 text-right min-w-[110px]">BALANCE AFTER</th>
              <th className="py-3 px-4">NOTES / REFERENCE</th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-[#18181B] bg-white font-mono">
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-[#FBF9F5]">
                  <td className="py-3 px-4 text-[11px] text-[#71717A]">
                    <div>{new Date(tx.timestamp).toLocaleString()}</div>
                    {(tx.order_date || tx.delivery_arrival_time) && (
                      <div className="flex flex-wrap gap-1 mt-1 font-sans">
                        {tx.order_date && (
                          <span className="px-1.5 py-0.2 rounded bg-[#FEF9C3] border border-[#CA8A04] text-[9px] font-bold text-[#713F12]">
                            Ord: {tx.order_date.slice(0, 10)}
                          </span>
                        )}
                        {tx.delivery_arrival_time && (
                          <span className="px-1.5 py-0.2 rounded bg-[#DCFCE7] border border-[#16A34A] text-[9px] font-bold text-[#166534]">
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
                          ? 'bg-[#DCFCE7] text-[#166534] border border-[#86EFAC]'
                          : tx.action_type === 'CONSUME'
                          ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FCA5A5]'
                          : 'bg-[#FEF08A] text-[#854D0E] border border-[#FDE047]'
                      }`}
                    >
                      {tx.action_type}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-bold text-[#18181B]">
                    <div>{tx.item_sku}</div>
                    {tx.item_name && tx.item_name !== tx.item_sku && (
                      <div className="font-sans text-[10px] font-medium text-[#71717A] truncate max-w-[180px]">
                        {tx.item_name}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded border border-[#18181B] bg-[#FEF08A] font-bold text-[10px]">
                      {tx.drawer_id || '—'}
                    </span>
                  </td>
                  <td
                    className={`py-3 px-4 text-right font-black ${
                      tx.change_qty > 0 ? 'text-[#166534]' : 'text-[#991B1B]'
                    }`}
                  >
                    {tx.change_qty > 0 ? `+${tx.change_qty}` : tx.change_qty}
                  </td>
                  <td className="py-3 px-4 text-right font-black text-[#18181B]">
                    {tx.balance_after}
                  </td>
                  <td className="py-3 px-4 text-[11px] text-[#52525B] font-sans truncate max-w-sm">
                    {tx.reference_doc ? `[${tx.reference_doc}] ` : ''}
                    {tx.notes}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="py-8 text-center text-xs text-[#71717A] font-semibold font-sans">
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
