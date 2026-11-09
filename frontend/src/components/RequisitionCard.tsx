import React, { useState } from 'react';
import { RequisitionResponse } from '../types/inventory';
import { Package, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react';
import { dispatchRequisition } from '../api/client';

interface RequisitionCardProps {
  requisitions: RequisitionResponse[];
  onRefresh: () => void;
}

export const RequisitionCard: React.FC<RequisitionCardProps> = ({ requisitions, onRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pendingReqs = requisitions.filter((r) => r.status === 'PENDING');

  const handleApprove = async (code: string) => {
    try {
      setLoading(true);
      const res = await dispatchRequisition(code);
      setSuccessMsg(res.message);
      setTimeout(() => setSuccessMsg(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert(`Error approving requisition: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="brutal-card p-6 bg-white mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center">
            <Package className="w-4 h-4 text-[#18181B]" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-[#18181B] uppercase">
              TECHNICIAN PART REQUISITIONS
            </h3>
            <p className="text-xs text-[#71717A] font-semibold">
              Approvals for field repairs and spare parts allocation
            </p>
          </div>
        </div>

        <span className="brutal-pill pill-yellow">
          {pendingReqs.length} PENDING
        </span>
      </div>

      {successMsg && (
        <div className="mb-3 p-3 bg-[#DCFCE7] border-2 border-[#15803D] rounded-xl text-xs font-bold text-[#15803D] flex items-center gap-2">
          <CheckCircle className="w-4 h-4" /> {successMsg}
        </div>
      )}

      {/* Requisitions List */}
      {pendingReqs.length > 0 ? (
        <div className="space-y-3">
          {pendingReqs.map((req) => (
            <div
              key={req.id}
              className="p-4 rounded-xl border-2 border-[#18181B] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="brutal-pill pill-yellow font-mono text-xs">
                    {req.requisition_code}
                  </span>
                  <span className="font-bold text-sm text-[#18181B]">
                    {req.requester}
                  </span>
                  {req.priority === 'HIGH_EXAM' && (
                    <span className="brutal-pill pill-coral text-[11px]">
                      HIGH_EXAM
                    </span>
                  )}
                  {req.priority === 'CRITICAL' && (
                    <span className="brutal-pill pill-coral text-[11px] animate-pulse">
                      CRITICAL
                    </span>
                  )}
                </div>

                <div className="text-xs font-bold text-[#27272A] flex items-center gap-2">
                  <span>Requested:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#18181B]">
                    {req.quantity}x {req.item_sku}
                  </span>
                  {req.drawer_id && (
                    <span className="text-[#71717A] font-mono">
                      (Drawer {req.drawer_id})
                    </span>
                  )}
                </div>

                {req.target_location && (
                  <div className="text-[11px] font-semibold text-[#71717A]">
                    Target: {req.target_location}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleApprove(req.requisition_code)}
                disabled={loading}
                className="brutal-btn brutal-btn-mint px-5 py-2.5 text-sm"
              >
                <CheckCircle className="w-4 h-4" />
                {loading ? 'Processing...' : 'Approve & Dispatch'}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-dashed border-[#A1A1AA] text-center text-xs text-[#71717A] font-semibold">
          No pending technician requisitions right now. All requests dispatched.
        </div>
      )}
    </div>
  );
};
