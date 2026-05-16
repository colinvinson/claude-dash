"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X, SkipForward } from "lucide-react";
import { haptic } from "@/lib/feedback/haptics";
import { formatRest } from "@/lib/fitness/rest-timer";

// Compact circular rest countdown. Opens automatically after a set is
// logged; closes itself ~3s after hitting 0 unless Sir keeps tapping
// "+30s".
//
// Implementation notes:
//   - Uses an absolute END timestamp so backgrounding the tab / locking
//     the phone doesn't pause the timer.
//   - Web Audio API ping at 0 (no audio file dependency).
//   - Haptic at the 10-second warning AND at zero.

export type RestTimerProps = {
  // Seconds initially programmed. When this number changes (i.e. a new set
  // is logged), the timer restarts to that value.
  initialSeconds: number;
  // Brief explainer shown under the time ("2:30 — failure set + low recovery")
  hint?: string;
  // External trigger — increment to (re-)open the timer. 0 = closed.
  openKey: number;
  // Called when Sir explicitly skips OR the auto-close fires after 0.
  onClose: () => void;
};

// Lazily-allocated single AudioContext. Some browsers (notably Safari)
// require this to be created from a user gesture; we lazy-init on the
// first ping so it inherits the just-completed tap's user-gesture context.
let _audio: AudioContext | null = null;
function ping(freqHz: number, durationMs: number, gain = 0.18) {
  if (typeof window === "undefined") return;
  try {
    if (!_audio) {
      const Ctor = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      if (!Ctor) return;
      _audio = new Ctor();
    }
    const ctx = _audio;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freqHz;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.02);
    g.gain.linearRampToValueAtTime(0,    ctx.currentTime + durationMs / 1000);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.05);
  } catch {}
}

export default function RestTimer({ initialSeconds, hint, openKey, onClose }: RestTimerProps) {
  // Absolute "end" timestamp (ms). null = closed.
  const [endsAt, setEndsAt]     = useState<number | null>(null);
  const [now, setNow]           = useState<number>(() => Date.now());
  const lastKeyRef              = useRef<number>(0);
  const firedTenWarn            = useRef<boolean>(false);
  const firedZero               = useRef<boolean>(false);

  // Open / re-arm when openKey changes.
  useEffect(() => {
    if (openKey === 0 || openKey === lastKeyRef.current) return;
    lastKeyRef.current = openKey;
    const end = Date.now() + initialSeconds * 1000;
    setEndsAt(end);
    firedTenWarn.current = false;
    firedZero.current    = false;
  }, [openKey, initialSeconds]);

  // Tick — 250ms is fine for a seconds display.
  useEffect(() => {
    if (endsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [endsAt]);

  // Side-effect triggers — 10s warning + 0 ping.
  useEffect(() => {
    if (endsAt == null) return;
    const remainingMs = endsAt - now;
    if (!firedTenWarn.current && remainingMs <= 10_000 && remainingMs > 9_500) {
      firedTenWarn.current = true;
      haptic("tap");
      ping(660, 90);
    }
    if (!firedZero.current && remainingMs <= 0) {
      firedZero.current = true;
      haptic("milestone");
      // 2-tone "ready" chime
      ping(880, 140);
      setTimeout(() => ping(1175, 160), 160);
      // Auto-close 3s after zero unless Sir extends
      setTimeout(() => {
        setEndsAt((cur) => (cur != null && Date.now() - cur >= 2900 ? null : cur));
        onClose();
      }, 3000);
    }
  }, [now, endsAt, onClose]);

  if (endsAt == null) return null;

  const remainingMs = Math.max(0, endsAt - now);
  const remainingS  = Math.ceil(remainingMs / 1000);
  const elapsedS    = Math.max(0, initialSeconds - remainingS);
  const pct         = Math.max(0, Math.min(1, elapsedS / initialSeconds));
  const done        = remainingMs <= 0;

  // Ring math — same approach as the activity rings
  const R = 56;
  const C = 2 * Math.PI * R;
  const dash = C * pct;

  const accent = done ? "#34d399" : remainingMs <= 10_000 ? "#fbbf24" : "#60a5fa";

  function extend(seconds: number) {
    setEndsAt((cur) => (cur == null ? null : cur + seconds * 1000));
    if (done) {
      // If we'd already fired, allow re-firing for the new endpoint.
      firedZero.current = false;
      firedTenWarn.current = false;
    }
    haptic("tap");
  }
  function skip() {
    setEndsAt(null);
    onClose();
    haptic("tap");
  }

  return (
    <div
      className="rounded-2xl p-4 mt-3 mb-3 border anim-fade"
      style={{
        background: done ? "rgba(52,211,153,0.08)" : "rgba(20,20,22,0.6)",
        borderColor: done ? "rgba(52,211,153,0.35)" : "rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg width={128} height={128} viewBox="0 0 128 128">
            <circle cx={64} cy={64} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
            <circle
              cx={64} cy={64} r={R}
              fill="none"
              stroke={accent}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 64 64)"
              style={{ transition: "stroke-dasharray 250ms linear, stroke 300ms ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black tabular-nums text-white">
              {done ? "GO" : formatRest(remainingS)}
            </span>
            {!done && <span className="text-[9px] uppercase tracking-widest text-zinc-500">rest</span>}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          {!done && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Rest target</p>
              {hint && <p className="text-[11px] text-zinc-300 leading-snug mb-2">{hint}</p>}
            </>
          )}
          {done && (
            <p className="text-sm font-semibold text-emerald-300 mb-2">Ready for next set.</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5">
            {!done && (
              <button
                onClick={() => extend(30)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold"
              >
                <Plus size={11} /> 30s
              </button>
            )}
            {done && (
              <button
                onClick={() => extend(60)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold"
              >
                <Plus size={11} /> 1 min
              </button>
            )}
            <button
              onClick={skip}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[11px]"
            >
              {done ? <X size={11} /> : <SkipForward size={11} />}
              {done ? "Close" : "Skip"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
