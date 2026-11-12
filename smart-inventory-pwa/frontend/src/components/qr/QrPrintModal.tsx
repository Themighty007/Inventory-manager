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
        className="skr-card bg-white w-full max-w-4xl p-6 relative max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-5 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/20 flex items-center justify-center font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-bold text-[#0B132B]">
                Stanley 1-93-981 Drawer QR Label Sheet
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                39 Compartments Printable Sticker Sheet (30 Small S01–S30, 9 Large L01–L09)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="btn-cyan text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 font-semibold"
            >
              <Printer className="w-4 h-4" /> Print Labels
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Labels Grid */}
        {loading ? (
          <div className="py-16 text-center text-xs font-semibold text-slate-400">
            Generating QR labels...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-3 print:gap-2">
            {labels.map((lbl) => (
              <div
                key={lbl.drawer_id}
                className="p-3 bg-white border border-slate-200 rounded-xl flex flex-col items-center justify-center text-center shadow-xs print:shadow-none print:border-black"
              >
                <div className="w-24 h-24 mb-1">
                  <img
                    src={lbl.qr_data_uri}
                    alt={lbl.code}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="font-mono font-bold text-sm text-[#0B132B]">
                  {lbl.drawer_id}
                </div>
                <div className="text-[9px] font-mono font-medium text-slate-400 uppercase mt-0.5">
                  {lbl.type} • {lbl.dimensions}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
