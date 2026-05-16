"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useStack } from "@/hooks/useStack";
import { useProtein } from "@/hooks/useProtein";
import { useWorkout } from "@/hooks/useWorkout";
import { useHealth } from "@/hooks/useHealth";
import { useHealthBaselines } from "@/hooks/useHealthBaselines";
import { useDailyContext } from "@/hooks/useDailyContext";
import { computeDailyScore } from "@/lib/scoring";
import Card from "@/components/ui/Card";
import { Sparkles, Volume2 } from "lucide-react";
import { haptic } from "@/lib/feedback/haptics";
import { speak, cancelSpeech } from "@/lib/jarvis/voice";
import ConfettiBurst from "@/components/ui/ConfettiBurst";
import { PALETTE, TYPE } from "@/lib/design-tokens";

// THE day-card. Replaces ScoreHeadline + ActivityRings + the old end-of-day
// TodayWrap. Always-on summary surface:
//   - Daily score (number + accent color)
//   - Three closure rings (Goals / Stack / Fuel) inline
//   - Headline that shifts through the day (morning vs. end-of-day)
//   - Recap CTA (audible) when there's something worth recapping
//   - "All three closed" confetti once per day
//
// Compact in the morning when nothing's done yet, rich at end of day.

const COLOR_GOALS = PALETTE.success;
const COLOR_STACK = PALETTE.info;
const COLOR_FUEL  = "#fb7185"; // pink — distinct from success/info, not reused elsewhere

function Ring({ radius, pct, color, stroke = 9 }: { radius: number; pct: number; color: string; stroke?: number }) {
  const C = 2 * Math.PI * radius;
  const dash = C * Math.max(0, Math.min(1, pct));
  return (
    <g>
      <circle cx={70} cy={70} r={radius} fill="none" stroke={`${color}22`} strokeWidth={stroke} />
      <circle
        cx={70} cy={70} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
        strokeDashoffset={C / 4}
        transform="rotate(-90 70 70)"
        style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </g>
  );
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayWrap() {
  const { goals, loading: goalsLoading } = useGoals();
  const { items: stack, loading: stackLoading } = useStack();
  const { totalToday: pToday, target: pTarget, loading: proteinLoading } = useProtein();
  const { todaySets } = useWorkout();
  const { health } = useHealth();
  const { baselines } = useHealthBaselines();
  const { hasCheckedIn } = useDailyContext();

  const isLoading = goalsLoading || stackLoading || proteinLoading;

  const goalsTotal = goals.length;
  const goalsDone  = goals.filter((g) => g.is_complete).length;
  const stackTotal = stack.length;
  const stackDone  = stack.filter((s) => s.taken).length;
  const fuelPct    = pTarget > 0 ? pToday / pTarget : 0;

  const pctGoals = goalsTotal > 0 ? goalsDone / goalsTotal : 0;
  const pctStack = stackTotal > 0 ? stackDone / stackTotal : 0;
  const pctFuel  = Math.min(1, fuelPct);
  const allClosed = pctGoals >= 1 && pctStack >= 1 && pctFuel >= 1;
  const setsLogged = todaySets.length;

  const supplementsTaken = stackDone; // alias for clarity in score call
  const { score, accent, headline } = computeDailyScore({
    goalsComplete:     goalsDone,
    goalsTotal,
    readinessScore:    health.readiness_score,
    readinessBaseline: baselines.readiness_score ?? null,
    workoutDoneToday:  setsLogged > 0,
    supplementsTaken,
    supplementsTotal:  stackTotal,
    checkedIn:         hasCheckedIn,
    proteinPct:        pTarget > 0 ? pToday / pTarget : null,
    proteinTarget:     pTarget,
  });

  // Confetti + haptic on all-closed transition (once per day).
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!allClosed) return;
    if (typeof window === "undefined") return;
    const k = "ringsClosedDay";
    if (window.localStorage.getItem(k) === todayKey()) return;
    window.localStorage.setItem(k, todayKey());
    setBurst((n) => n + 1);
    haptic("milestone");
  }, [allClosed]);

  // Score count-up animation. When the underlying score changes, ease the
  // displayed number over ~700ms so progress feels rewarding instead of
  // jumping. Skips animation on first render (no jarring 0 → score climb
  // on page load).
  const [displayScore, setDisplayScore] = useState(score);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      setDisplayScore(score);
      return;
    }
    if (score === displayScore) return;
    const start = displayScore;
    const delta = score - start;
    const duration = 700;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      // cubic ease-out
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayScore(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score]);

  // Audible recap state.
  const [speaking, setSpeaking]     = useState(false);
  const [recapText, setRecapText]   = useState<string | null>(null);
  async function speakRecap() {
    if (speaking) { cancelSpeech(); setSpeaking(false); return; }
    setSpeaking(true);
    try {
      const res = await fetch("/api/jarvis/day-recap", { method: "POST" });
      if (!res.ok) { setSpeaking(false); return; }
      const j = await res.json() as { recap?: string };
      const text = j.recap ?? "Day logged. Well done, sir.";
      setRecapText(text);
      speak(text, { onEnd: () => setSpeaking(false) });
    } catch { setSpeaking(false); }
  }

  // Recap eligibility — late in the day OR all closed. No need to render the
  // button before there's anything to recap.
  const hour = new Date().getHours();
  const recapEligible = allClosed || hour >= 18;

  // Pull score accent → color mapping.
  const scoreColor =
    accent === "emerald" ? PALETTE.success :
    accent === "amber"   ? PALETTE.celebration :
    accent === "red"     ? PALETTE.danger :
                           PALETTE.dim;

  const wrapHeadline = useMemo(() => {
    if (allClosed) return "All three rings closed. Day owned.";
    return headline;
  }, [allClosed, headline]);

  // Loading skeleton — keeps the card structure stable.
  if (isLoading) {
    return (
      <Card style={{ padding: "28px 22px" }}>
        <div className="flex items-stretch gap-5">
          <div className="relative flex-shrink-0">
            <svg width={180} height={180} viewBox="0 0 180 180">
              <circle cx={90} cy={90} r={72} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={11} />
              <circle cx={90} cy={90} r={58} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={11} />
              <circle cx={90} cy={90} r={44} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={11} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl font-black tabular-nums text-zinc-700">—</span>
              <span className="text-[10px] uppercase tracking-widest text-zinc-700 mt-1">score</span>
            </div>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="h-3 rounded mb-3 w-2/3" style={{ background: "rgba(255,255,255,0.04)" }} />
            <div className="h-2 rounded mb-2 w-3/5" style={{ background: "rgba(255,255,255,0.03)" }} />
            <div className="h-2 rounded mb-2 w-1/2" style={{ background: "rgba(255,255,255,0.03)" }} />
            <div className="h-2 rounded w-2/5" style={{ background: "rgba(255,255,255,0.03)" }} />
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card style={{ padding: "28px 22px" }}>
      <div className="relative flex items-stretch gap-5">
        <div className="relative flex-shrink-0">
          {/* Hero ring — 180px diameter. Significantly bigger than the
              previous 140 so TodayWrap actually anchors Home as THE
              moment, not just another card. */}
          <svg width={180} height={180} viewBox="0 0 180 180">
            <Ring radius={72} pct={pctGoals} color={COLOR_GOALS} stroke={11} />
            <Ring radius={58} pct={pctStack} color={COLOR_STACK} stroke={11} />
            <Ring radius={44} pct={pctFuel}  color={COLOR_FUEL}  stroke={11} />
          </svg>
          {/* Score number in the center of the rings — larger, more confident */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl font-black tabular-nums leading-none" style={{ color: scoreColor }}>
              {displayScore}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mt-1">score</span>
          </div>
          <ConfettiBurst trigger={burst} count={48} spread={180} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-base font-semibold text-zinc-100 leading-snug mb-4">{wrapHeadline}</p>

          <RingRow label="Goals" color={COLOR_GOALS} value={`${goalsDone}/${goalsTotal || 0}`} pct={pctGoals} />
          <RingRow label="Stack" color={COLOR_STACK} value={`${stackDone}/${stackTotal || 0}`} pct={pctStack} />
          <RingRow label="Fuel"  color={COLOR_FUEL}  value={`${Math.round(pToday)}/${pTarget}g`} pct={pctFuel} />
        </div>
      </div>

      {recapEligible && (
        <>
          <button
            onClick={speakRecap}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-100 text-zinc-900 text-xs font-bold hover:opacity-90 transition-opacity"
          >
            <Volume2 size={12} />
            {speaking ? "Stop" : "Jarvis recap"}
            <Sparkles size={11} className="opacity-60" />
          </button>
          {recapText && !speaking && (
            <p className="text-[11px] text-zinc-500 mt-2 italic">&ldquo;{recapText}&rdquo;</p>
          )}
        </>
      )}
    </Card>
  );
}

function RingRow({ label, color, value, pct }: { label: string; color: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 mb-1 last:mb-0">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-[11px] text-zinc-400 w-10">{label}</span>
      <span className="text-[11px] text-zinc-100 tabular-nums flex-1">{value}</span>
      <span className="text-[10px] text-zinc-600 tabular-nums">{Math.round(pct * 100)}%</span>
    </div>
  );
}
