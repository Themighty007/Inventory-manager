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
  SwitchCamera,
  QrCode,
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
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);

  // Available camera devices
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);

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
  }, [activeTab, activeCameraIndex]);

  // Audio beep feedback for scan confirmation
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // 880 Hz beep
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      }
    } catch {
      // Audio playback blocked or not allowed yet
    }
  };

  const triggerHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([60, 40, 60]);
      }
    } catch {
      // Haptics not supported or permitted
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    if (!decodedText) return;
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Debounce duplicate scans within 2.5 seconds
    if (
      lastScannedRef.current === cleanCode &&
      now - lastScanTimeRef.current < 2500
    ) {
      return;
    }

    lastScannedRef.current = cleanCode;
    lastScanTimeRef.current = now;

    // Beep & Haptic Feedback
    playBeep();
    triggerHaptic();

    // Visual confirmation banner
    setScannedFeedback(cleanCode);

    // Call onScanResult IMMEDIATELY to avoid lost/delayed events!
    onScanResult(cleanCode);

    // Asynchronously stop the scanner in background
    setTimeout(() => {
      stopScanner().catch(() => {});
    }, 200);
  };

  const startScanner = async () => {
    setCameraError(null);
    setScannedFeedback(null);

    try {
      // Create Html5Qrcode instance with BarcodeDetector acceleration
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
      }

      const qrCode = scannerRef.current;
      if (qrCode.isScanning) {
        return;
      }

      // Discover available cameras
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setCameras(devices);
        }
      } catch (err) {
        console.warn('Could not list cameras:', err);
      }

      // Camera selection strategy:
      // If we have cameras and an index, use deviceId; otherwise use environment facingMode
      let cameraConfig: any = { facingMode: 'environment' };
      if (cameras.length > 0) {
        const chosen = cameras[activeCameraIndex % cameras.length];
        cameraConfig = { deviceId: { exact: chosen.id } };
      }

      // Start scanning with optimal square viewfinder and unconstrained aspect ratio
      await qrCode.start(
        cameraConfig,
        {
          fps: 20,
          qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.max(220, Math.floor(minEdge * 0.85));
            return { width: edge, height: edge };
          },
        },
        handleScanSuccess,
        () => {
          // Frame callback
        }
      );

      setIsScanning(true);

      // Check torch capabilities
      try {
        const capabilities = qrCode.getRunningTrackCapabilities?.() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setIsScanning(false);

      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        setCameraError(
          'Camera access was denied. Please allow camera permissions in your browser settings (Chrome → Site Settings → Camera → Allow).'
        );
      } else if (err?.name === 'NotFoundError') {
        setCameraError('No rear camera device detected on this hardware.');
      } else if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setCameraError(
          'Mobile browsers require HTTPS to access the camera over local Wi-Fi. Access this app via https://192.168.29.243:8443'
        );
      } else {
        setCameraError(err?.message || 'Could not start camera. Try switching camera or using Image Upload / Manual Entry.');
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

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    stopScanner().then(() => {
      setActiveCameraIndex((prev) => (prev + 1) % cameras.length);
    });
  };

  // Image Upload Scanning Fallback
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback('Scanning code from photo...');
    try {
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode('qr-reader', {
          formatsToSupport,
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
      }

      const decoded = await scannerRef.current.scanFile(file, true);
      if (decoded) {
        playBeep();
        triggerHaptic();
        setUploadFeedback(`✓ Detected: ${decoded}`);
        onScanResult(decoded.trim());
      }
    } catch (err: any) {
      setUploadFeedback('Could not detect a clear barcode or QR code in this image. Try another photo or type it below.');
    }
  };

  // Manual Code Submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playBeep();
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
              High-Speed Detector • Point & Scan
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
          <Upload className="w-3.5 h-3.5" /> Photo
        </button>
        <button
          onClick={() => setActiveTab('MANUAL')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'MANUAL'
              ? 'bg-[#DDD6FE] text-[#4C1D95] shadow-[1px_1px_0px_#18181B]'
              : 'text-[#A1A1AA] hover:text-white'
          }`}
        >
          <Keyboard className="w-3.5 h-3.5" /> Type
        </button>
      </div>

      {/* VIEW 1: LIVE CAMERA SCANNER */}
      {activeTab === 'CAMERA' && (
        <div className="flex-1 flex flex-col items-center justify-between relative min-h-[320px]">
          {/* Target Container for html5-qrcode */}
          <div className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-[#86EFAC] bg-black shadow-xl relative min-h-[260px] flex items-center justify-center">
            <div id="qr-reader" className="w-full h-full" />

            {/* Scanned Success Flash Banner */}
            {scannedFeedback && (
              <div className="absolute inset-0 bg-[#86EFAC]/90 flex flex-col items-center justify-center p-4 z-30 animate-in fade-in zoom-in-95">
                <CheckCircle2 className="w-12 h-12 text-[#064E3B] mb-2" />
                <span className="text-xs font-black uppercase text-[#064E3B]">Code Detected!</span>
                <span className="font-mono text-sm font-black text-[#121316] mt-1 bg-white px-3 py-1 rounded-lg border border-[#18181B]">
                  {scannedFeedback}
                </span>
              </div>
            )}

            {/* Controls Overlay: Torch & Camera Switch */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {cameras.length > 1 && (
                <button
                  onClick={handleSwitchCamera}
                  className="p-2.5 rounded-full border-2 border-[#18181B] bg-black/60 text-white shadow-lg"
                  title="Switch Camera Lens"
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}

              {hasTorch && isScanning && (
                <button
                  onClick={toggleTorch}
                  className={`p-2.5 rounded-full border-2 border-[#18181B] shadow-lg ${
                    torchOn ? 'bg-[#FEF08A] text-[#18181B]' : 'bg-black/60 text-white'
                  }`}
                  title="Toggle Flash / Torch"
                >
                  {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          {/* Camera Permission / Hardware Error Display */}
          {cameraError && (
            <div className="p-3.5 bg-[#27272A] border-2 border-[#FCA5A5] rounded-xl text-xs space-y-2 max-w-sm text-center my-2">
              <div className="flex items-center justify-center gap-2 text-[#FCA5A5] font-black">
                <CameraOff className="w-4 h-4" />
                <span>Camera Notice</span>
              </div>
              <p className="text-[#D4D4D8] leading-relaxed text-[11px]">
                {cameraError}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={startScanner}
                  className="brutal-btn brutal-btn-mint text-xs py-1 px-3"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
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

          {/* Quick Manual Entry Bar Directly Below Camera */}
          <form
            onSubmit={handleManualSubmit}
            className="w-full max-w-sm mt-3 pt-2 border-t border-[#27272A] flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Or type/paste code (e.g. S01, ESP32)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3 py-2 text-xs font-mono font-bold rounded-xl bg-[#23252B] border-2 border-[#3F3F46] text-white placeholder-[#71717A] focus:outline-none focus:border-[#86EFAC]"
            />
            <button
              type="submit"
              className="brutal-btn brutal-btn-mint text-xs py-2 px-3 text-[#064E3B]"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* VIEW 2: PHOTO / FILE UPLOAD FALLBACK */}
      {activeTab === 'UPLOAD' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF08A] text-[#18181B] flex items-center justify-center border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-sm font-black text-white uppercase">
              Scan from Photo or Gallery
            </h3>
            <p className="text-xs text-[#A1A1AA] mt-1 max-w-xs">
              Take a snapshot or upload an image containing a drawer QR or component barcode.
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="brutal-btn brutal-btn-mint text-xs py-2.5 px-6 text-[#064E3B]"
          >
            Select Photo / Take Picture
          </button>

          {uploadFeedback && (
            <div className="p-3 rounded-xl bg-[#27272A] border border-[#3F3F46] text-xs font-mono text-[#FEF08A] max-w-xs">
              {uploadFeedback}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MANUAL CODE ENTRY */}
      {activeTab === 'MANUAL' && (
        <div className="flex-1 flex flex-col justify-center p-4 max-w-sm mx-auto w-full">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 rounded-2xl bg-[#DDD6FE] text-[#4C1D95] mx-auto flex items-center justify-center border-2 border-[#18181B]">
                <Keyboard className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-black text-white uppercase">
                Manual Code Entry
              </h3>
              <p className="text-xs text-[#A1A1AA]">
                Type any Drawer Compartment (e.g. S01, L04) or Component SKU
              </p>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-[#A1A1AA] block mb-1">
                Enter Code / Identifier
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. S01 or ESP32-WROOM-32"
                className="w-full p-3 text-sm font-mono font-black rounded-xl bg-[#23252B] border-2 border-[#3F3F46] text-white focus:outline-none focus:border-[#86EFAC]"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="w-full brutal-btn brutal-btn-mint py-3 text-xs font-black uppercase text-[#064E3B] flex items-center justify-center gap-2"
            >
              Continue to Intake <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
