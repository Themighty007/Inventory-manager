import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  CameraOff,
  Zap,
  ZapOff,
  Upload,
  Keyboard,
  Barcode,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

interface MobileScannerProps {
  onScanResult: (code: string) => void;
  onCancel?: () => void;
}

export const MobileScanner: React.FC<MobileScannerProps> = ({
  onScanResult,
  onCancel,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [activeTab, setActiveTab] = useState<'CAMERA' | 'UPLOAD' | 'MANUAL'>('CAMERA');
  const [manualCode, setManualCode] = useState('');
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Supported formats: QR codes + Common 1D Barcodes
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
  ];

  useEffect(() => {
    if (activeTab === 'CAMERA') {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [activeTab]);

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(60);
      }
    } catch {
      // Haptics not supported or permitted
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    const now = Date.now();
    // Debounce duplicate scans within 2.5 seconds
    if (
      lastScannedRef.current === decodedText &&
      now - lastScanTimeRef.current < 2500
    ) {
      return;
    }

    lastScannedRef.current = decodedText;
    lastScanTimeRef.current = now;
    triggerHaptic();

    // Stop scanning and pass scanned code to parcel registration workflow
    stopScanner().then(() => {
      onScanResult(decodedText.trim());
    });
  };

  const startScanner = async () => {
    setCameraError(null);
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport,
          verbose: false,
        });
      }

      const qrCode = scannerRef.current;
      if (qrCode.isScanning) {
        return;
      }

      // Request rear camera with responsive viewfinder configuration
      await qrCode.start(
        { facingMode: 'environment' },
        {
          fps: 15,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            return {
              width: Math.floor(minEdge * 0.75),
              height: Math.floor(minEdge * 0.55),
            };
          },
          aspectRatio: 1.0,
        },
        handleScanSuccess,
        () => {
          // Frame scan callback (silent for performance)
        }
      );

      setIsScanning(true);

      // Check for torch capability
      try {
        const capabilities = qrCode.getRunningTrackCapabilities?.() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setIsScanning(false);

      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        setCameraError(
          'Camera access was denied. Please allow camera permissions in your browser settings, or use Image Upload / Manual Entry below.'
        );
      } else if (err?.name === 'NotFoundError') {
        setCameraError('No rear camera device detected on this hardware.');
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setCameraError(
          'Mobile browsers require HTTPS to access the camera over local Wi-Fi. Please access this app via HTTPS.'
        );
      } else {
        setCameraError(err?.message || 'Could not start camera. Please try image upload fallback.');
      }
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    setIsScanning(false);
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await (scannerRef.current as any).applyVideoConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Failed to toggle torch:', err);
    }
  };

  // Image Upload Scanning Fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback('Processing barcode from image...');
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport,
          verbose: false,
        });
      }

      const decoded = await scannerRef.current.scanFile(file, true);
      if (decoded) {
        triggerHaptic();
        setUploadFeedback(`Found: ${decoded}`);
        setTimeout(() => {
          onScanResult(decoded.trim());
        }, 500);
      }
    } catch (err: any) {
      setUploadFeedback('No valid barcode or QR code found in this photo. Please try another image or manual entry.');
    }
  };

  // Manual Code Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      triggerHaptic();
      onScanResult(manualCode.trim().toUpperCase());
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#121316] text-white p-4 select-none">
      {/* Hidden file input for photo upload */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#27272A] mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#FEF08A] text-[#18181B] flex items-center justify-center font-black border-2 border-[#18181B]">
            <Barcode className="w-4 h-4 text-[#18181B]" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white tracking-tight">
              Barcode & QR Scanner
            </h2>
            <span className="text-[10px] text-[#86EFAC] font-mono">
              Auto-Rear Camera • 1D & 2D Codes
            </span>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="px-2.5 py-1 text-xs font-bold rounded-lg border border-[#3F3F46] bg-[#27272A] text-[#D4D4D8]"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Scan Mode Switcher */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1C1D22] border-2 border-[#27272A] rounded-xl mb-3 text-xs font-bold">
        <button
          onClick={() => setActiveTab('CAMERA')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'CAMERA'
              ? 'bg-[#86EFAC] text-[#064E3B] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Camera
        </button>
        <button
          onClick={() => setActiveTab('UPLOAD')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'UPLOAD'
              ? 'bg-[#FEF08A] text-[#713F12] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Upload
        </button>
        <button
          onClick={() => setActiveTab('MANUAL')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'MANUAL'
              ? 'bg-[#DDD6FE] text-[#4C1D95] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" /> Manual
        </button>
      </div>

      {/* VIEW 1: LIVE REAR CAMERA SCANNER */}
      {activeTab === 'CAMERA' && (
        <div className="flex-1 flex flex-col items-center justify-center relative min-h-[300px]">
          {/* Target Container for html5-qrcode */}
          <div
            id="qr-reader"
            className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-[#3F3F46] bg-black shadow-xl relative"
          />

          {/* Torch toggle overlay button */}
          {hasTorch && isScanning && (
            <button
              onClick={toggleTorch}
              className={`absolute top-4 right-4 p-3 rounded-full border-2 border-[#18181B] z-20 shadow-lg ${
                torchOn ? 'bg-[#FEF08A] text-[#18181B]' : 'bg-black/60 text-white'
              }`}
              title="Toggle Flashlight / Torch"
            >
              {torchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          {/* Camera Permission Error Display */}
          {cameraError && (
            <div className="p-4 bg-[#27272A] border-2 border-[#FCA5A5] rounded-xl text-xs space-y-2.5 max-w-sm text-center mt-3">
              <div className="flex items-center justify-center gap-2 text-[#FCA5A5] font-black">
                <CameraOff className="w-5 h-5" />
                <span>Camera Access Issue</span>
              </div>
              <p className="text-[#D4D4D8] leading-relaxed text-[11px]">
                {cameraError}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={startScanner}
                  className="brutal-btn brutal-btn-mint text-xs py-1 px-3"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="brutal-btn brutal-btn-yellow text-xs py-1 px-3"
                >
                  <Upload className="w-3.5 h-3.5" /> Snap Photo
                </button>
              </div>
            </div>
          )}

          <p className="text-[11px] text-[#A1A1AA] text-center mt-3 font-mono">
            Align barcode or drawer QR within the viewfinder frame.
          </p>
        </div>
      )}

      {/* VIEW 2: PHOTO / FILE UPLOAD FALLBACK */}
      {activeTab === 'UPLOAD' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF08A] text-[#18181B] flex items-center justify-center border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
            <Upload className="w-8 h-8 text-[#18181B]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Scan Barcode from Photo</h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-xs">
              Take a photo using your phone camera or select an existing picture of a parcel label.
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="brutal-btn brutal-btn-mint text-xs py-3 px-6 w-full max-w-xs text-[#064E3B]"
          >
            <Camera className="w-4 h-4" /> Take Photo / Choose File
          </button>

          {uploadFeedback && (
            <div className="p-3 bg-[#1C1D22] border border-[#3F3F46] rounded-xl text-xs text-[#FEF08A] font-mono max-w-xs">
              {uploadFeedback}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MANUAL ENTRY FALLBACK */}
      {activeTab === 'MANUAL' && (
        <div className="flex-1 flex flex-col justify-center p-4 max-w-sm mx-auto w-full">
          <form onSubmit={handleManualSubmit} className="space-y-4 bg-[#1C1D22] p-5 rounded-2xl border-2 border-[#27272A]">
            <div>
              <label className="text-xs font-black text-[#FEF08A] uppercase block mb-1">
                Enter Barcode, SKU or Drawer ID
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="e.g. TRACK-ESP32-901 or DRAWER:S04"
                className="w-full p-3 text-xs font-mono font-bold rounded-xl bg-[#27272A] border-2 border-[#3F3F46] text-white focus:outline-none focus:border-[#86EFAC]"
                autoFocus
                required
              />
              <span className="text-[10px] text-[#A1A1AA] mt-1 block">
                Supports tracking numbers, component SKUs, and drawer stamps.
              </span>
            </div>

            <button
              type="submit"
              className="w-full brutal-btn brutal-btn-yellow py-3 text-xs font-black text-[#713F12]"
            >
              Continue to Registration <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
