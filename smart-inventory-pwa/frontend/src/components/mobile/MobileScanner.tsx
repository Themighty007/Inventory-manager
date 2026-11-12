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

  // All 1D and 2D formats for ZXing fallback engine
  const formatsToSupport = [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.CODE_93,
    Html5QrcodeSupportedFormats.CODABAR,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E,
    Html5QrcodeSupportedFormats.PDF_417,
    Html5QrcodeSupportedFormats.DATA_MATRIX,
    Html5QrcodeSupportedFormats.AZTEC,
    Html5QrcodeSupportedFormats.MAXICODE,
    Html5QrcodeSupportedFormats.RSS_14,
    Html5QrcodeSupportedFormats.RSS_EXPANDED,
    Html5QrcodeSupportedFormats.UPC_EAN_EXTENSION,
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

  // High-frequency frame scanner using native BarcodeDetector + jsQR fallback
  const startFrameDetectionLoop = useCallback(() => {
    let nativeDetector: any = null;
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const allSupported = [
          'qr_code',
          'code_128',
          'code_39',
          'code_93',
          'codabar',
          'data_matrix',
          'ean_13',
          'ean_8',
          'itf',
          'pdf417',
          'upc_a',
          'upc_e',
          'aztec',
        ];
        nativeDetector = new (window as any).BarcodeDetector({ formats: allSupported });
      } catch {
        try {
          nativeDetector = new (window as any).BarcodeDetector();
        } catch {
          nativeDetector = null;
        }
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

        // Pass 1: Hardware-accelerated BarcodeDetector (Runs on EVERY frame for all 1D/2D barcodes)
        if (nativeDetector) {
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

          const qrResult = jsQR(imgData.data, targetW, targetH, {
            inversionAttempts: 'attemptBoth',
          });

          if (qrResult && qrResult.data) {
            handleScanSuccess(qrResult.data);
            return;
          }

          // Pass 3: Center crop scan at 1:1 sensor resolution for distant or tiny QR codes
          if (vw > 600 && vh > 600 && frameCount % 2 === 0) {
            const cropSize = Math.min(vw, vh, 500);
            const cropX = Math.round((vw - cropSize) / 2);
            const cropY = Math.round((vh - cropSize) / 2);

            canvas.width = cropSize;
            canvas.height = cropSize;
            ctx.drawImage(video, cropX, cropY, cropSize, cropSize, 0, 0, cropSize, cropSize);

            // Also test native detector on the center crop for dense 1D barcodes
            if (nativeDetector) {
              try {
                const detectedCenter = await nativeDetector.detect(canvas);
                if (detectedCenter && detectedCenter.length > 0 && detectedCenter[0].rawValue) {
                  handleScanSuccess(detectedCenter[0].rawValue);
                  return;
                }
              } catch {}
            }

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

      let cameraConfig: any = {
        facingMode: 'environment',
      };

      if (discoveredDevices.length > 0) {
        const chosen = discoveredDevices[activeCameraIndex] || discoveredDevices[0];
        cameraConfig = { deviceId: { exact: chosen.id } };
      }

      const qrConfig = {
        fps: 25,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          const edge = Math.floor(minDim * 0.85);
          return { width: edge, height: edge };
        },
        aspectRatio: 1.0,
      };

      await qrCode.start(
        cameraConfig,
        qrConfig,
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame without barcode - ignore to prevent console flooding
        }
      );

      setIsScanning(true);
      startFrameDetectionLoop();

      // Check capabilities (torch, zoom, autofocus)
      try {
        const track = (qrCode as any).getRunningTrack();
        if (track && typeof track.getCapabilities === 'function') {
          const caps = track.getCapabilities();
          if (caps.torch) setHasTorch(true);
          if (caps.zoom) {
            setSupportsZoom(true);
            setMaxZoom(caps.zoom.max || 2);
            setCurrentZoom(caps.zoom.min || 1);
          }
        }
      } catch (e) {
        console.warn('Could not read track capabilities:', e);
      }
    } catch (err: any) {
      console.error('Failed to start camera:', err);
      setIsScanning(false);
      stopFrameDetectionLoop();

      const errMsg = err?.message || String(err);
      if (errMsg.includes('NotAllowedError') || errMsg.includes('Permission')) {
        setCameraError(
          'Camera access was denied by your browser. Please tap the lock / settings icon in your browser address bar and enable Camera permissions for this site.'
        );
      } else if (errMsg.includes('NotFoundError') || errMsg.includes('OverconstrainedError')) {
        setCameraError(
          'Rear camera could not be bound. You can use the Photo tab to snap/upload an image or type the code manually.'
        );
      } else {
        setCameraError(
          `Unable to start camera scanner: ${errMsg}. Use Photo or Type mode below.`
        );
      }
    }
  };

  const stopScanner = async () => {
    stopFrameDetectionLoop();
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing scanner instance:', err);
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
      stopFrameDetectionLoop();
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [activeTab, activeCameraIndex]);

  // Flashlight / Torch toggle
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const track = (scannerRef.current as any).getRunningTrack();
      if (track && typeof track.applyConstraints === 'function') {
        const nextState = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextState } as any],
        });
        setTorchOn(nextState);
      }
    } catch (err) {
      console.warn('Failed to toggle flashlight:', err);
    }
  };

  // Switch camera between multiple rear/front lenses
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    await stopScanner();
    setActiveCameraIndex((prev) => (prev + 1) % cameras.length);
  };

  // Zoom control
  const handleToggleZoom = async () => {
    if (!scannerRef.current || !supportsZoom) return;
    try {
      const track = (scannerRef.current as any).getRunningTrack();
      if (track && typeof track.applyConstraints === 'function') {
        const nextZoom = currentZoom >= 2 ? 1 : Math.min(2, maxZoom);
        await track.applyConstraints({
          advanced: [{ zoom: nextZoom } as any],
        });
        setCurrentZoom(nextZoom);
      }
    } catch (err) {
      console.warn('Zoom failed:', err);
    }
  };

  // Tap on viewfinder to trigger autofocus & show focus ring
  const handleViewfinderTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusRing({ x, y });
    setTimeout(() => setFocusRing(null), 800);

    try {
      const track = (scannerRef.current as any)?.getRunningTrack();
      if (track && typeof track.applyConstraints === 'function') {
        track.applyConstraints({
          advanced: [{ focusMode: 'continuous' } as any],
        }).catch(() => {});
      }
    } catch {}
  };

  // Image Upload fallback scanner
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback('Analyzing image for QR codes & barcodes...');

    // 1. Try native BarcodeDetector on image bitmap
    if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
      try {
        const detector = new (window as any).BarcodeDetector();
        const bitmap = await createImageBitmap(file);
        const results = await detector.detect(bitmap);
        if (results && results.length > 0 && results[0].rawValue) {
          setUploadFeedback(`Found: ${results[0].rawValue}`);
          handleScanSuccess(results[0].rawValue);
          return;
        }
      } catch (err) {
        console.warn('Native BarcodeDetector on photo failed, trying fallback:', err);
      }
    }

    // 2. Try jsQR with normal + inverted attempts
    try {
      const img = new Image();
      const reader = new FileReader();

      reader.onload = (loadEvent) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setUploadFeedback('Failed to initialize image processor.');
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });

          if (code && code.data) {
            setUploadFeedback(`Found: ${code.data}`);
            handleScanSuccess(code.data);
          } else {
            // 3. Fallback to html5-qrcode file scanner
            if (scannerRef.current) {
              scannerRef.current
                .scanFile(file, true)
                .then((decodedText) => {
                  setUploadFeedback(`Found: ${decodedText}`);
                  handleScanSuccess(decodedText);
                })
                .catch(() => {
                  setUploadFeedback(
                    'No barcode or QR code found in this photo. Try taking a closer, sharper photo with good lighting or enter the code manually.'
                  );
                });
            } else {
              setUploadFeedback(
                'No barcode detected. Ensure the label is clear, unblurred, and well-lit.'
              );
            }
          }
        };
        img.src = loadEvent.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch {
      setUploadFeedback('Error reading photo file.');
    }
  };

  // Manual code entry fallback
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualCode.trim();
    if (!clean) return;
    handleScanSuccess(clean);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B132B] text-white p-4 select-none">
      {/* Hidden file input for photo upload */}
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#00B4D8]/10 text-[#00B4D8] border border-[#00B4D8]/30 flex items-center justify-center font-bold">
            <Barcode className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-display font-bold text-white tracking-tight">
              Barcode & QR Scanner
            </h2>
            <span className="text-[10px] text-[#2EC4B6] font-mono flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2EC4B6] animate-pulse" />
              All 1D & 2D Barcode Engine Active
            </span>
          </div>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#1E293B]/70 border border-slate-700/60 rounded-xl mb-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('CAMERA')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'CAMERA'
              ? 'bg-[#00B4D8] text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Camera className="w-3.5 h-3.5" /> Camera
        </button>
        <button
          onClick={() => setActiveTab('UPLOAD')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'UPLOAD'
              ? 'bg-[#00B4D8] text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" /> Photo
        </button>
        <button
          onClick={() => setActiveTab('MANUAL')}
          className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
            activeTab === 'MANUAL'
              ? 'bg-[#00B4D8] text-white shadow-xs font-bold'
              : 'text-slate-400 hover:text-white'
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
            className="w-full max-w-sm rounded-2xl overflow-hidden border border-[#00B4D8]/40 bg-black shadow-2xl relative min-h-[260px] flex items-center justify-center cursor-pointer"
            title="Tap anywhere to refocus"
          >
            {/* Camera feed */}
            <div id="qr-reader" className="w-full h-full" />

            {/* High-Precision Viewfinder Reticle Overlay */}
            {isScanning && !scannedFeedback && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                <div className="relative w-52 h-52 border border-dashed border-[#00B4D8]/30 rounded-2xl flex items-center justify-center">
                  {/* Four Corner Brackets */}
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-[#00B4D8] rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-[#00B4D8] rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-[#00B4D8] rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-[#00B4D8] rounded-br-xl" />

                  {/* Animated Sweeping Laser Line */}
                  <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#00B4D8] to-transparent shadow-[0_0_8px_#00B4D8] animate-bounce" />

                  {/* Central Target Aim Dot */}
                  <div className="w-2 h-2 rounded-full bg-[#00B4D8] animate-ping" />
                </div>
              </div>
            )}

            {/* Tap-to-Focus Ring Indicator */}
            {focusRing && (
              <div
                className="absolute pointer-events-none w-12 h-12 -ml-6 -mt-6 border-2 border-[#2EC4B6] rounded-full animate-ping z-30"
                style={{ left: focusRing.x, top: focusRing.y }}
              />
            )}

            {/* Scanned Success Flash Banner */}
            {scannedFeedback && (
              <div className="absolute inset-0 bg-[#0B132B]/95 border-2 border-[#2EC4B6] flex flex-col items-center justify-center p-4 z-30 animate-in fade-in zoom-in-95">
                <CheckCircle2 className="w-14 h-14 text-[#2EC4B6] mb-2" />
                <span className="text-xs font-bold uppercase text-[#2EC4B6] tracking-wider">
                  Target Identified!
                </span>
                <span className="font-mono text-base font-bold text-white mt-2 bg-[#1E293B] px-4 py-1.5 rounded-xl border border-slate-700 shadow-md">
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
                  className="px-2.5 py-1.5 rounded-full border border-slate-700 bg-black/75 text-[#00B4D8] font-mono font-bold text-xs shadow-lg flex items-center gap-1"
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
                  className="p-2.5 rounded-full border border-slate-700 bg-black/75 text-white shadow-lg hover:text-[#00B4D8] transition-colors"
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
                  className={`p-2.5 rounded-full border border-slate-700 shadow-lg transition-colors ${
                    torchOn ? 'bg-[#00B4D8] text-white' : 'bg-black/75 text-white'
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
                <span className="text-[9px] font-mono font-medium bg-black/60 text-[#00B4D8] px-2.5 py-0.5 rounded-full border border-[#00B4D8]/30">
                  ⚡ Auto-detecting 1D & 2D Barcodes • Tap to focus
                </span>
              </div>
            )}
          </div>

          {/* Camera Permission / Notice Banner */}
          {cameraError && (
            <div className="p-3.5 bg-[#1E293B] border border-red-400/40 rounded-xl text-xs space-y-2 max-w-sm text-center my-2">
              <div className="flex items-center justify-center gap-2 text-red-400 font-bold">
                <CameraOff className="w-4 h-4" />
                <span>Camera Notice</span>
              </div>
              <p className="text-slate-300 leading-relaxed text-[11px]">
                {cameraError}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  onClick={startScanner}
                  className="btn-cyan text-xs py-1 px-3"
                >
                  <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Retry Camera
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-1 px-3 rounded-lg border border-slate-600 bg-slate-700 text-slate-200 text-xs font-semibold"
                >
                  <Upload className="w-3.5 h-3.5 inline mr-1" /> Snap Photo
                </button>
              </div>
            </div>
          )}

          {/* Quick Manual Entry Bar Directly Below Camera */}
          <form
            onSubmit={handleManualSubmit}
            className="w-full max-w-sm mt-3 pt-2 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Or type/paste code (e.g. S01, ESP32)..."
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 px-3 py-2 text-xs font-mono font-medium rounded-xl bg-[#1E293B] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-[#00B4D8]"
            />
            <button
              type="submit"
              className="btn-cyan py-2 px-3 text-xs rounded-xl flex items-center justify-center"
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
          <div className="w-14 h-14 rounded-2xl bg-[#00B4D8]/10 text-[#00B4D8] flex items-center justify-center border border-[#00B4D8]/20">
            <Upload className="w-7 h-7" />
          </div>

          <div>
            <h3 className="text-sm font-display font-bold text-white">
              Scan from Photo or Gallery
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xs">
              Snap a clear photo or select an image containing a compartment QR or component barcode.
            </p>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-cyan text-xs py-2.5 px-6 rounded-xl"
          >
            Select Photo / Take Picture
          </button>

          {uploadFeedback && (
            <div className="p-3 rounded-xl bg-[#1E293B] border border-slate-700 text-xs font-mono text-[#00B4D8] max-w-xs">
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
              <div className="w-12 h-12 rounded-2xl bg-[#00B4D8]/10 text-[#00B4D8] mx-auto flex items-center justify-center border border-[#00B4D8]/20">
                <Keyboard className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-display font-bold text-white">
                Manual Code Entry
              </h3>
              <p className="text-xs text-slate-400">
                Type any Drawer Compartment (e.g. S01, L04) or Component SKU
              </p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Enter Code / Identifier
              </label>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. S01 or ESP32-WROOM-32"
                className="w-full p-3 text-sm font-mono font-bold rounded-xl bg-[#1E293B] border border-slate-700 text-white focus:outline-none focus:border-[#00B4D8]"
                autoFocus
                required
              />
            </div>

            <button
              type="submit"
              className="w-full btn-cyan py-3 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
            >
              Continue to Intake <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
