import React, { useState, useEffect } from 'react';
import { DrawerLabelQr } from '../../types/inventory';
import { fetchDrawerLabels } from '../../api/client';
import { X, Printer, QrCode } from 'lucide-react';

interface QrPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrPrintModal: React.FC<QrPrintModalProps> = ({ isOpen, onClose }) => {
  const [labels, setLabels] = useState<DrawerLabelQr[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLabels();
    }
  }, [isOpen]);

  const loadLabels = async () => {
    try {
      setLoading(true);
      const res = await fetchDrawerLabels();
      setLabels(res);
    } catch (err) {
      console.warn('Failed to load drawer labels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="brutal-card bg-white w-full max-w-4xl p-6 relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-[#18181B] mb-5 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#FEF08A] border-2 border-[#18181B] flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5 text-[#18181B]" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[#18181B] uppercase">
                Stanley 1-93-981 Drawer QR Label Sheet
              </h3>
              <p className="text-xs text-[#71717A] font-semibold">
                39 Compartments Printable Sticker Sheet (30 Small S01–S30, 9 Large L01–L09)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="brutal-btn brutal-btn-mint text-xs py-2 px-4"
            >
              <Printer className="w-4 h-4" /> Print Labels
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
            >
              <X className="w-4 h-4 text-[#18181B]" />
            </button>
          </div>
        </div>

        {/* Labels Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-[#71717A]">
            Generating QR labels...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2">
            {labels.map((lbl) => (
              <div
                key={lbl.drawer_id}
                className="p-3 bg-white border-2 border-[#18181B] rounded-xl flex flex-col items-center justify-center text-center shadow-[2px_2px_0px_#18181B] print:shadow-none print:border-black"
              >
                <div className="w-24 h-24 mb-1">
                  <img
                    src={lbl.qr_data_uri}
                    alt={lbl.code}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="font-mono font-black text-sm text-[#18181B]">
                  {lbl.drawer_id}
                </div>
                <div className="text-[9px] font-mono font-bold text-[#71717A] uppercase mt-0.5">
                  {lbl.type} • {lbl.dimensions}
                </div>
                <div className="text-[8px] font-mono text-[#A1A1AA] mt-0.5">
                  {lbl.code}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
