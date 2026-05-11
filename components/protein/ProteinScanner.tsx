"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { X } from "lucide-react";

type Props = {
  onDetect: (barcode: string) => void;
  onClose:  () => void;
};

export default function ProteinScanner({ onDetect, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    async function start() {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (devices.length === 0) {
          setError("No camera found.");
          return;
        }
        // Prefer rear camera on phones
        const rear = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[devices.length - 1];

        if (cancelled || !videoRef.current) return;

        const controls = await reader.decodeFromVideoDevice(
          rear.deviceId,
          videoRef.current,
          (result, err, ctrls) => {
            if (result) {
              ctrls.stop();
              onDetect(result.getText());
            }
            // Ignore err — zxing fires NotFoundException on every empty frame
          }
        );
        controlsRef.current = controls;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Camera access failed";
        setError(msg.includes("Permission") ? "Camera permission denied. Enable it in Settings and try again." : msg);
      }
    }

    start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-zinc-900">
        <span className="text-xs uppercase tracking-widest text-zinc-400">Scan barcode</span>
        <button onClick={onClose} className="text-zinc-400 hover:text-white">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <div className="px-6 text-center">
            <p className="text-sm text-red-400 mb-3">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 rounded-xl text-sm text-zinc-200"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {/* Crosshair overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-72 h-44 border-2 border-white/60 rounded-2xl" />
            </div>
            <div className="absolute bottom-8 left-0 right-0 text-center">
              <p className="text-xs text-zinc-400">Point camera at a barcode</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
