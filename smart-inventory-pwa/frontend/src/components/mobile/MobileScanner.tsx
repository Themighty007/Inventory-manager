import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import jsQR from 'jsqr';
import {
  Camera,
  CameraOff,
  Zap,
  ZapOff,
  Upload,
  Keyboard,
  Barcode,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  SwitchCamera,
  ZoomIn,
  Maximize2,
  Focus,
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
  const [supportsZoom, setSupportsZoom] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(2);

  const [activeTab, setActiveTab] = useState<'CAMERA' | 'UPLOAD' | 'MANUAL'>('CAMERA');
  const [manualCode, setManualCode] = useState('');
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const [focusRing, setFocusRing] = useState<{ x: number; y: number } | null>(null);

  // Available camera devices
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [activeCameraIndex, setActiveCameraIndex] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const lastScanTimeRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafIdRef = useRef<number | null>(null);
  const isComponentMounted = useRef<boolean>(true);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Formats for ZXing fallback engine
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
  ];

  // Synthesized double chime on target lock (880 Hz -> 1320 Hz)
  const playSuccessChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const now = ctx.currentTime;

        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now);
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc1.start(now);
        osc1.stop(now + 0.1);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1320, now + 0.08);
        gain2.gain.setValueAtTime(0.25, now + 0.08);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.22);
      }
    } catch {
      // Audio autoplay blocked or not available
    }
  }, []);

  const triggerHaptic = useCallback(() => {
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([70, 40, 70]);
      }
    } catch {
      // Haptics not permitted or supported
    }
  }, []);

  // Main scan success handler with deduplication and immediate dispatch
  const handleScanSuccess = useCallback((decodedText: string) => {
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

    playSuccessChime();
    triggerHaptic();

    setScannedFeedback(cleanCode);

    // Call onScanResult immediately
    onScanResult(cleanCode);

    // Stop loops and scanner in background
    setTimeout(() => {
      stopScanner().catch(() => {});
    }, 250);
  }, [onScanResult, playSuccessChime, triggerHaptic]);

  // High-frequency frame scanner using jsQR + native BarcodeDetector
  const startFrameDetectionLoop = useCallback(() => {
    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        nativeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'upc_a', 'data_matrix'],
        });
      } catch {
        nativeDetector = null;
      }
    }

    if (!offscreenCanvasRef.current) {
      const c = document.createElement('canvas');
      offscreenCanvasRef.current = c;
    }

    const canvas = offscreenCanvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    let frameCount = 0;

    const processFrame = async () => {
      if (!isComponentMounted.current) return;

      const video = document.querySelector('#qr-reader video') as HTMLVideoElement;
      if (video && video.readyState >= 2 && !video.paused && !video.ended && video.videoWidth > 0) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        frameCount++;

        // Pass 1: Hardware-accelerated BarcodeDetector (if available)
        if (nativeDetector && frameCount % 2 === 0) {
          try {
            const detected = await nativeDetector.detect(video);
            if (detected && detected.length > 0 && detected[0].rawValue) {
              handleScanSuccess(detected[0].rawValue);
              return;
            }
          } catch {
            // Native detector busy
          }
        }

        // Pass 2: jsQR Ultra-Precision Engine
        // Analyzes frames with inversionAttempts: 'attemptBoth'
        try {
          // Downsample slightly if video is 1080p+ to keep CPU latency < 8ms
          let targetW = vw;
          let targetH = vh;
          if (targetW > 1200) {
            const ratio = 1200 / targetW;
            targetW = 1200;
            targetH = Math.round(vh * ratio);
          }

          canvas.width = targetW;
          canvas.height = targetH;
          ctx.drawImage(video, 0, 0, targetW, targetH);
          const imgData = ctx.getImageData(0, 0, targetW, targetH);

          // Fast inverted + normal QR code scan
          const qrResult = jsQR(imgData.data, targetW, targetH, {
            inversionAttempts: 'attemptBoth',
          });

          if (qrResult && qrResult.data) {
            handleScanSuccess(qrResult.data);
            return;
          }

          // Pass 3: Center crop scan at 1:1 sensor resolution for distant or tiny QR codes
          if (vw > 600 && vh > 600 && frameCount % 3 === 0) {
            const cropSize = Math.min(vw, vh, 500);
            const cropX = Math.round((vw - cropSize) / 2);
            const cropY = Math.round((vh - cropSize) / 2);

            canvas.width = cropSize;
            canvas.height = cropSize;
            ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);
            const centerData = ctx.getImageData(0, 0, cropSize, cropSize);

            const centerQr = jsQR(centerData.data, cropSize, cropSize, {
              inversionAttempts: 'attemptBoth',
            });

            if (centerQr && centerQr.data) {
              handleScanSuccess(centerQr.data);
              return;
            }
          }
        } catch {
          // Frame analysis skip
        }
      }

      rafIdRef.current = requestAnimationFrame(processFrame);
    };

    rafIdRef.current = requestAnimationFrame(processFrame);
  }, [handleScanSuccess]);

  const stopFrameDetectionLoop = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  const startScanner = async () => {
    setCameraError(null);
    setScannedFeedback(null);

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

      const qrCode = scannerRef.current;
      if (qrCode.isScanning) {
        return;
      }

      // Enumerate available camera devices
      let discoveredDevices: Array<{ id: string; label: string }> = [];
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          // Sort cameras: prioritize rear/back cameras, deprioritize front and 0.5x ultra-wide
          const sorted = [...devices].sort((a, b) => {
            const labelA = a.label.toLowerCase();
            const labelB = b.label.toLowerCase();
            const isFrontA = labelA.includes('front') || labelA.includes('user');
            const isFrontB = labelB.includes('front') || labelB.includes('user');
            if (isFrontA && !isFrontB) return 1;
            if (!isFrontA && isFrontB) return -1;
            return 0;
          });
          discoveredDevices = sorted;
          setCameras(sorted);
        }
      } catch (err) {
        console.warn('Could not enumerate cameras:', err);
      }

      // WebRTC camera constraints: request HD resolution with continuous autofocus
      let cameraConfig: any = {
        facingMode: 'environment',
      };

      if (discoveredDevices.length > 0) {
        const chosen = discoveredDevices[activeCameraIndex % discoveredDevices.length];
        cameraConfig = { deviceId: { exact: chosen.id } };
      }

      // Start Html5Qrcode with 25 FPS scan rate
      await qrCode.start(
        cameraConfig,
        {
          fps: 25,
          disableFlip: false,
        },
        handleScanSuccess,
        () => {}
      );

      setIsScanning(true);

      // Start parallel high-frequency jsQR & native detector loop
      startFrameDetectionLoop();

      // Configure hardware track features: continuous autofocus, torch & zoom
      try {
        const track = (qrCode as any).getRunningTrack?.() as MediaStreamTrack;
        if (track) {
          const caps: any = track.getCapabilities?.() || {};

          // Apply continuous autofocus if available
          if (caps.focusMode && (caps.focusMode.includes('continuous') || caps.focusMode.includes('single-shot'))) {
            track.applyConstraints({
              advanced: [{ focusMode: 'continuous' } as any],
            }).catch(() => {});
          }

          // Check torch capability
          setHasTorch(Boolean(caps.torch));

          // Check zoom capability
          if (caps.zoom) {
            setSupportsZoom(true);
            const zMin = caps.zoom.min || 1;
            const zMax = Math.min(4, caps.zoom.max || 3);
            setCurrentZoom(zMin);
            setMaxZoom(zMax);
          } else {
            setSupportsZoom(false);
          }
        }
      } catch (trackErr) {
        console.warn('Track capability probe:', trackErr);
      }
    } catch (err: any) {
      console.warn('Camera initialization error:', err);
      setIsScanning(false);
      stopFrameDetectionLoop();

      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        setCameraError(
          'Camera access was denied. Please allow camera permissions in your mobile browser settings, or use Image Upload / Manual Entry below.'
        );
      } else if (err?.name === 'NotFoundError') {
        setCameraError('No camera device detected on this hardware.');
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
    stopFrameDetectionLoop();

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

  useEffect(() => {
    isComponentMounted.current = true;
    if (activeTab === 'CAMERA') {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      isComponentMounted.current = false;
      stopScanner();
    };
  }, [activeTab, activeCameraIndex]);

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

  const handleToggleZoom = async () => {
    if (!scannerRef.current || !supportsZoom) return;
    try {
      const nextZoom = currentZoom === 1 ? Math.min(2, maxZoom) : 1;
      const track = (scannerRef.current as any).getRunningTrack?.() as MediaStreamTrack;
      if (track) {
        await track.applyConstraints({
          advanced: [{ zoom: nextZoom } as any],
        });
        setCurrentZoom(nextZoom);
      }
    } catch (err) {
      console.warn('Zoom adjustment notice:', err);
    }
  };

  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    stopScanner().then(() => {
      setActiveCameraIndex((prev) => (prev + 1) % cameras.length);
    });
  };

  // Interactive tap-to-focus on camera viewfinder
  const handleViewfinderTap = async (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setFocusRing({ x, y });
    setTimeout(() => setFocusRing(null), 1200);

    // Apply continuous focus constraint to camera track
    try {
      const track = (scannerRef.current as any)?.getRunningTrack?.() as MediaStreamTrack;
      if (track) {
        const normX = Math.max(0, Math.min(1, x / rect.width));
        const normY = Math.max(0, Math.min(1, y / rect.height));
        const caps: any = track.getCapabilities?.() || {};
        if (caps.focusMode) {
          await track.applyConstraints({
            advanced: [{
              focusMode: 'continuous',
              pointsOfInterest: [{ x: normX, y: normY }],
            } as any],
          });
        }
      }
    } catch {
      // Tap focus completed
    }
  };

  // High-precision photo upload scan with dual jsQR + Html5Qrcode
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback('Scanning high-resolution photo...');

    // Method 1: Instant jsQR analysis on loaded Image bitmap
    try {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image load failed'));
        img.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, img.width, img.height);
        const qrResult = jsQR(data.data, img.width, img.height, {
          inversionAttempts: 'attemptBoth',
        });

        URL.revokeObjectURL(objectUrl);

        if (qrResult && qrResult.data) {
          playSuccessChime();
          triggerHaptic();
          setUploadFeedback(`✓ Detected: ${qrResult.data}`);
          handleScanSuccess(qrResult.data);
          return;
        }
      }
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.warn('jsQR image upload probe note:', err);
    }

    // Method 2: Html5Qrcode ZXing fallback
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
        playSuccessChime();
        triggerHaptic();
        setUploadFeedback(`✓ Detected: ${decoded}`);
        handleScanSuccess(decoded.trim());
        return;
      }
    } catch {
      setUploadFeedback('Could not detect a clear code. Try holding closer, taking another photo, or typing it below.');
    }
  };

  // Manual code submission
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      playSuccessChime();
      triggerHaptic();
      handleScanSuccess(manualCode.trim().toUpperCase());
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
            <span className="text-[10px] text-[#86EFAC] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#86EFAC] animate-pulse" />
              Ultra-Precision jsQR Engine
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

      {/* Mode Switcher */}
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
          {/* Target Container for camera stream & visual targeting reticle */}
          <div
            onClick={handleViewfinderTap}
            className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-[#86EFAC] bg-black shadow-xl relative min-h-[260px] flex items-center justify-center cursor-pointer"
            title="Tap anywhere to refocus"
          >
            {/* Camera feed */}
            <div id="qr-reader" className="w-full h-full" />

            {/* High-Precision Viewfinder Reticle Overlay */}
            {isScanning && !scannedFeedback && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="relative w-52 h-52 border border-dashed border-[#86EFAC]/40 rounded-2xl flex items-center justify-center">
                  {/* Four Corner Brackets */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-4 border-l-4 border-[#86EFAC] rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-4 border-r-4 border-[#86EFAC] rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-4 border-l-4 border-[#86EFAC] rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-4 border-r-4 border-[#86EFAC] rounded-br-xl" />

                  {/* Animated Sweeping Laser Line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#86EFAC] to-transparent shadow-[0_0_10px_#86EFAC] animate-bounce" />

                  {/* Central Target Aim Dot */}
                  <div className="w-2 h-2 rounded-full bg-[#86EFAC] animate-ping" />
                </div>
              </div>
            )}

            {/* Tap-to-Focus Ring Indicator */}
            {focusRing && (
              <div
                className="absolute pointer-events-none w-12 h-12 -ml-6 -mt-6 border-2 border-[#FEF08A] rounded-full animate-ping z-30"
                style={{ left: focusRing.x, top: focusRing.y }}
              />
            )}

            {/* Scanned Success Flash Banner */}
            {scannedFeedback && (
              <div className="absolute inset-0 bg-[#86EFAC]/95 flex flex-col items-center justify-center p-4 z-30 animate-in fade-in zoom-in-95">
                <CheckCircle2 className="w-14 h-14 text-[#064E3B] mb-2" />
                <span className="text-xs font-black uppercase text-[#064E3B] tracking-wider">
                  Target Identified!
                </span>
                <span className="font-mono text-base font-black text-[#121316] mt-2 bg-white px-4 py-1.5 rounded-xl border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
                  {scannedFeedback}
                </span>
              </div>
            )}

            {/* Quick Controls Overlay: Torch, Zoom & Camera Switch */}
            <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
              {supportsZoom && isScanning && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleZoom();
                  }}
                  className="px-2.5 py-1.5 rounded-full border-2 border-[#18181B] bg-black/75 text-[#FEF08A] font-mono font-black text-xs shadow-lg flex items-center gap-1"
                  title="Toggle Zoom (1x / 2x)"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>{currentZoom > 1 ? '2x' : '1x'}</span>
                </button>
              )}

              {cameras.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSwitchCamera();
                  }}
                  className="p-2.5 rounded-full border-2 border-[#18181B] bg-black/75 text-white shadow-lg"
                  title={`Switch Lens (${activeCameraIndex + 1}/${cameras.length})`}
                >
                  <SwitchCamera className="w-4 h-4" />
                </button>
              )}

              {hasTorch && isScanning && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleTorch();
                  }}
                  className={`p-2.5 rounded-full border-2 border-[#18181B] shadow-lg ${
                    torchOn ? 'bg-[#FEF08A] text-[#18181B]' : 'bg-black/75 text-white'
                  }`}
                  title="Toggle Flashlight / Torch"
                >
                  {torchOn ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
                </button>
              )}
            </div>

            {/* Tap hint footer */}
            {isScanning && !scannedFeedback && (
              <div className="absolute bottom-2 inset-x-0 text-center pointer-events-none">
                <span className="text-[9px] font-mono font-bold bg-black/60 text-[#86EFAC] px-2.5 py-0.5 rounded-full border border-[#86EFAC]/30">
                  ⚡ Auto-finding QR • Tap screen to focus
                </span>
              </div>
            )}
          </div>

          {/* Camera Permission / Notice Banner */}
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
                  className="brutal-btn brutal-btn-mint text-xs py-1 px-3 text-[#064E3B]"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="brutal-btn brutal-btn-yellow text-xs py-1 px-3 text-[#713F12]"
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
              title="Submit Code"
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
              Snap a clear photo or select an image containing a compartment QR or component barcode.
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
