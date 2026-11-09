import React, { useState, useEffect } from 'react';
import { DrawerLabelQr } from '../types/inventory';
import { fetchDrawerLabels } from '../api/client';
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
      const data = await fetchDrawerLabels();
      setLabels(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="brutal-card bg-white w-full max-w-4xl p-6 relative max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#18181B] mb-4 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-lg bg-[#86EFAC] border-2 border-[#18181B] flex items-center justify-center">
              <QrCode className="w-5 h-5 text-[#064E3B]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-[#18181B] uppercase">Print Stanley Drawer QR Labels</h2>
              <p className="text-xs text-[#71717A] font-semibold">
                Ready-to-cut printable labels for all 39 compartments (S01–S30, L01–L09)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="brutal-btn brutal-btn-yellow text-xs py-1.5 px-4"
            >
              <Printer className="w-4 h-4" /> Print Sticker Sheet
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg border-2 border-[#18181B] flex items-center justify-center hover:bg-[#F4F4F5]"
            >
              <X className="w-4 h-4 text-[#18181B]" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs font-bold text-[#71717A]">
            Generating QR codes for 39 Stanley compartments...
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 print:grid-cols-4">
            {labels.map((l) => (
              <div
                key={l.drawer_id}
                className="p-3 border-2 border-[#18181B] rounded-xl bg-white flex flex-col items-center justify-between text-center page-break-inside-avoid"
              >
                <div className="w-full flex items-center justify-between border-b border-[#E4E4E7] pb-1 mb-2 font-mono text-[11px] font-bold">
                  <span className="text-[#18181B]">{l.drawer_id}</span>
                  <span className="text-[#71717A] uppercase text-[9px]">{l.type}</span>
                </div>

                <img
                  src={l.qr_data_uri}
                  alt={`QR code for ${l.drawer_id}`}
                  className="w-24 h-24 object-contain my-1"
                />

                <div className="mt-1 text-[10px] font-mono text-[#52525B]">
                  STANLEY 1-93-981
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
