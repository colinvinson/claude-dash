"use client";

import { useEffect, useRef, useState } from "react";
import { Minus, Plus, X, Check, SkipForward } from "lucide-react";
import { useWorkout } from "@/hooks/useWorkout";
import { kgToLb, lbToKg, roundToPlate } from "@/lib/units";
import { recommendRest, formatRest } from "@/lib/fitness/rest-timer";
import { haptic } from "@/lib/feedback/haptics";
import { pick } from "@/lib/feedback/phrases";
import { PALETTE } from "@/lib/design-tokens";
import ConfettiBurst from "@/components/ui/ConfettiBurst";

// LIVE workout view — full-screen overlay that takes over during an active
// workout. Big numbers, big tap targets (gym = sweaty hands, no time to
// squint at small UI). State machine cycles: WORKING → RESTING → WORKING …
// until all planned sets done → COMPLETE.

type Phase = "working" | "resting" | "complete";

// Same Web Audio ping the small RestTimer uses, inline so this view stays
// self-contained.
let _audio: AudioContext | null = null;
function ping(freqHz: number, durationMs: number, gain = 0.2) {
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

export default function LiveWorkoutView({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    activeExercise, verdict, todaySets, logSet, recovery, mesoState, pastSessions,
  } = useWorkout();

  // Input state — initialized from the coach's prescription on first open.
  const [weight, setWeight] = useState(45);
  const [reps,   setReps]   = useState(8);
  const initRef = useRef(false);
  useEffect(() => {
    if (!open) { initRef.current = false; return; }
    if (initRef.current || !verdict) return;
    initRef.current = true;
    setWeight(roundToPlate(kgToLb(verdict.targetWeight), 2.5));
    setReps(verdict.targetReps);
  }, [open, verdict]);

  // Phase state
  const [phase,      setPhase]      = useState<Phase>("working");
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [now,        setNow]        = useState(() => Date.now());
  const [busy,       setBusy]       = useState(false);
  const [prBurst,    setPrBurst]    = useState(0);
  const [completeBurst, setCompleteBurst] = useState(0);
  const tenSecWarn = useRef(false);
  const zeroDone   = useRef(false);

  // Rest tick
  useEffect(() => {
    if (phase !== "resting" || restEndsAt == null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [phase, restEndsAt]);

  // Rest audio + haptic
  useEffect(() => {
    if (phase !== "resting" || restEndsAt == null) return;
    const remain = restEndsAt - now;
    if (!tenSecWarn.current && remain <= 10_000 && remain > 9_500) {
      tenSecWarn.current = true;
      haptic("tap");
      ping(660, 90);
    }
    if (!zeroDone.current && remain <= 0) {
      zeroDone.current = true;
      haptic("milestone");
      ping(880, 140);
      setTimeout(() => ping(1175, 160), 160);
    }
  }, [now, phase, restEndsAt]);

  if (!open) return null;
  if (!activeExercise || !verdict) {
    return (
      <Shell onClose={onClose}>
        <div className="flex-1 flex items-center justify-center text-center px-6">
          <p className="text-sm text-zinc-400">Pick an exercise on the coach card before going live.</p>
        </div>
      </Shell>
    );
  }

  const currentSetNum = Math.min(todaySets.length + 1, verdict.targetSets);
  const totalSets     = verdict.targetSets;
  const setsDone      = todaySets.length;
  const allDone       = setsDone >= totalSets;
  const protocol      = verdict.setProtocol?.[setsDone];
  const exType        = activeExercise.exercise_type ?? "Secondary";

  async function handleLogSet() {
    setBusy(true);
    const newEst1rm = Math.round(lbToKg(weight) * (1 + reps / 30));
    const prevBest  = pastSessions.reduce((m, s) => Math.max(m, s.topEst1rm), 0);
    const isPr      = newEst1rm > prevBest && prevBest > 0;

    await logSet(lbToKg(weight), reps);
    setBusy(false);

    if (isPr) {
      haptic("milestone");
      setPrBurst((n) => n + 1);
    } else {
      haptic("success");
    }

    // After logging, jump to rest unless this was the last set.
    const nextSetsDone = setsDone + 1;
    if (nextSetsDone >= totalSets) {
      setPhase("complete");
      setCompleteBurst((n) => n + 1);
      haptic("milestone");
      ping(880, 140);
      setTimeout(() => ping(1175, 200), 180);
    } else {
      const rec = recommendRest({
        exerciseType: exType,
        justCompletedProtocol: protocol,
        recoveryBand: recovery?.band ?? null,
        isDeloadWeek: mesoState?.isDeloadWeek ?? false,
      });
      tenSecWarn.current = false;
      zeroDone.current   = false;
      setRestEndsAt(Date.now() + rec.seconds * 1000);
      setPhase("resting");
    }
  }

  function startNextSet() {
    setRestEndsAt(null);
    setPhase("working");
    setNow(Date.now());
    haptic("tap");
  }

  function exitWorkout() {
    setPhase("working");
    setRestEndsAt(null);
    initRef.current = false;
    onClose();
  }

  // ────── RESTING ──────
  if (phase === "resting" && restEndsAt != null) {
    const remainMs = Math.max(0, restEndsAt - now);
    const totalMs  = restEndsAt - (now - (now - restEndsAt + remainMs));
    const initialMs = Math.max(remainMs, 60_000);
    const pct = 1 - Math.min(1, remainMs / Math.max(1, initialMs));
    const remainS = Math.ceil(remainMs / 1000);
    const done    = remainMs <= 0;
    const R = 110, C2 = 2 * Math.PI * R;
    const dash = C2 * pct;
    const accent = done ? PALETTE.success : remainMs <= 10_000 ? PALETTE.celebration : PALETTE.info;

    return (
      <Shell onClose={exitWorkout} title={activeExercise.name} subtitle={`Set ${setsDone}/${totalSets} logged · resting`}>
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="relative">
            <svg width={280} height={280} viewBox="0 0 280 280">
              <circle cx={140} cy={140} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
              <circle
                cx={140} cy={140} r={R}
                fill="none"
                stroke={accent}
                strokeWidth={12}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${C2 - dash}`}
                strokeDashoffset={C2 / 4}
                transform="rotate(-90 140 140)"
                style={{ transition: "stroke-dasharray 250ms linear, stroke 300ms ease" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-7xl font-black tabular-nums text-white tracking-tight">
                {done ? "GO" : formatRest(remainS)}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 mt-2">
                {done ? "next set" : "rest"}
              </span>
            </div>
          </div>

          <div className="mt-10 flex items-center gap-3">
            {!done && (
              <button
                onClick={() => { setRestEndsAt((c) => c == null ? null : c + 30_000); haptic("tap"); }}
                className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-sm font-bold flex items-center gap-1"
              >
                <Plus size={14} /> 30s
              </button>
            )}
            <button
              onClick={startNextSet}
              className={`px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 ${
                done
                  ? "bg-emerald-500 text-zinc-900"
                  : "bg-zinc-100 text-zinc-900"
              }`}
            >
              {done ? <Check size={16} /> : <SkipForward size={14} />}
              {done ? "Start next set" : "Skip rest"}
            </button>
          </div>
        </div>
        <SetStrip total={totalSets} done={setsDone} current={setsDone + 1} resting />
      </Shell>
    );
  }

  // ────── COMPLETE ──────
  if (phase === "complete" || allDone) {
    const volume = todaySets.reduce((s, x) => s + x.weight_kg * x.reps, 0);
    const bestEst = todaySets.length > 0 ? Math.max(...todaySets.map((x) => x.est_1rm)) : 0;
    return (
      <Shell onClose={exitWorkout} title={activeExercise.name} subtitle="Workout complete">
        <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
          <ConfettiBurst trigger={completeBurst} count={60} spread={260} />
          <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(16,185,129,0.15)", border: `2px solid ${PALETTE.success}` }}>
            <Check size={36} style={{ color: PALETTE.success }} strokeWidth={3} />
          </div>
          <p className="text-2xl font-black text-white mb-1">Done.</p>
          <p className="text-sm text-zinc-400 mb-8 text-center">
            {todaySets.length} {todaySets.length === 1 ? "set" : "sets"} logged · {kgToLb(volume).toFixed(0)} lb volume
            {bestEst > 0 && ` · best ${kgToLb(bestEst).toFixed(0)} lb est-1RM`}
          </p>
          <button
            onClick={exitWorkout}
            className="px-8 py-3 rounded-xl bg-zinc-100 text-zinc-900 text-sm font-bold"
          >
            Close
          </button>
        </div>
        <SetStrip total={totalSets} done={todaySets.length} current={null} />
      </Shell>
    );
  }

  // ────── WORKING ──────
  const isFailure = protocol?.rir === 0 || protocol?.rir === null;
  const protocolColor = protocol?.technique
    ? PALETTE.celebration
    : isFailure ? PALETTE.danger : PALETTE.info;
  return (
    <Shell onClose={exitWorkout} title={activeExercise.name} subtitle={`Set ${currentSetNum} of ${totalSets}`}>
      <div className="flex-1 flex flex-col px-6 pt-2 pb-4 overflow-y-auto relative">
        <ConfettiBurst trigger={prBurst} count={40} spread={180} />

        {/* Protocol pill */}
        {protocol && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <span
              className="text-[10px] uppercase tracking-[0.18em] font-bold px-3 py-1.5 rounded-full"
              style={{ color: protocolColor, background: `${protocolColor}1a`, border: `1px solid ${protocolColor}55` }}
            >
              {protocol.label}
            </span>
          </div>
        )}

        {/* Weight — giant number with big +/− pills */}
        <div className="mb-6">
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Weight</div>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => { setWeight((w) => Math.max(0, w - 5)); haptic("tap"); }}
              className="w-14 h-14 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
              aria-label="−5 lb"
            >
              <Minus size={22} className="text-zinc-200" />
            </button>
            <div className="flex items-baseline">
              <span className="text-7xl font-black tabular-nums text-white tracking-tight">{weight}</span>
              <span className="text-base text-zinc-500 ml-2 font-medium">lb</span>
            </div>
            <button
              onClick={() => { setWeight((w) => w + 5); haptic("tap"); }}
              className="w-14 h-14 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
              aria-label="+5 lb"
            >
              <Plus size={22} className="text-white" />
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 mt-3">
            <button
              onClick={() => { setWeight((w) => Math.max(0, w - 2.5)); haptic("tap"); }}
              className="text-xs text-zinc-500 hover:text-zinc-200 px-3 py-1 rounded-md border border-zinc-800"
            >
              −2.5
            </button>
            <button
              onClick={() => { setWeight((w) => w + 2.5); haptic("tap"); }}
              className="text-xs text-zinc-500 hover:text-zinc-200 px-3 py-1 rounded-md border border-zinc-800"
            >
              +2.5
            </button>
          </div>
        </div>

        {/* Reps — big number + horizontal scroll */}
        <div className="mb-6">
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-3">Reps</div>
          <div className="flex items-center justify-center gap-4 mb-3">
            <button
              onClick={() => { setReps((r) => Math.max(1, r - 1)); haptic("tap"); }}
              className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center"
            >
              <Minus size={18} className="text-zinc-200" />
            </button>
            <span className="text-6xl font-black tabular-nums text-white tracking-tight w-24 text-center">{reps}</span>
            <button
              onClick={() => { setReps((r) => r + 1); haptic("tap"); }}
              className="w-12 h-12 rounded-full bg-zinc-700 hover:bg-zinc-600 flex items-center justify-center"
            >
              <Plus size={18} className="text-white" />
            </button>
          </div>
          <p className="text-center text-[10px] text-zinc-600 tabular-nums">target {verdict.repRange.min}–{verdict.repRange.max}</p>
        </div>

        {/* Protocol note */}
        {protocol?.note && (
          <p className="text-sm text-zinc-300 leading-relaxed text-center max-w-md mx-auto mb-6">
            {protocol.note}
          </p>
        )}
      </div>

      {/* HUGE log button — full width sticky bottom */}
      <div className="px-6 pb-4">
        <button
          onClick={handleLogSet}
          disabled={busy}
          className="w-full py-5 rounded-2xl bg-white text-zinc-900 text-base font-black tracking-wide hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {busy ? "Logging…" : `Log set ${currentSetNum}`}
        </button>
      </div>
      <SetStrip total={totalSets} done={setsDone} current={currentSetNum} />
    </Shell>
  );
}

// ── Layout primitives ──

function Shell({
  children, onClose, title, subtitle,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex flex-col anim-fade" style={{ background: "#050506", paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-between px-6 pt-4 pb-2">
        <div className="flex-1 min-w-0">
          {title && <h2 className="text-lg font-bold text-zinc-100 truncate">{title}</h2>}
          {subtitle && <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{subtitle}</p>}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 w-10 h-10 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center"
          aria-label="Exit live workout"
        >
          <X size={18} className="text-zinc-400" />
        </button>
      </div>
      {children}
    </div>
  );
}

function SetStrip({ total, done, current, resting }: { total: number; done: number; current: number | null; resting?: boolean }) {
  return (
    <div className="px-6 pb-6 flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, i) => {
        const idx = i + 1;
        const isDone    = idx <= done;
        const isCurrent = current != null && idx === current && !resting;
        const isResting = current != null && idx === current && resting;
        return (
          <span
            key={i}
            className="h-2 flex-1 max-w-[40px] rounded-full transition-all"
            style={{
              background: isDone ? PALETTE.success
                : isCurrent ? "#ffffff"
                : isResting ? PALETTE.info
                : "rgba(255,255,255,0.08)",
              boxShadow: isCurrent || isResting ? "0 0 12px rgba(255,255,255,0.25)" : "none",
            }}
          />
        );
      })}
    </div>
  );
}
