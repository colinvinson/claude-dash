"use client";

import { useEffect, useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useStack } from "@/hooks/useStack";
import { useProtein } from "@/hooks/useProtein";
import Card from "@/components/ui/Card";
import { haptic } from "@/lib/feedback/haptics";
import ConfettiBurst from "@/components/ui/ConfettiBurst";

// Three concentric rings — Apple-Fitness style closure dopamine.
//   GOALS — daily goals done / total
//   STACK — schedule items checked / total
//   FUEL  — protein hit pct of target
//
// When ALL three are at 100% the rings flash and a single confetti burst
// fires (once per day, persisted in localStorage).

const COLOR_GOALS  = "#34d399";
const COLOR_STACK  = "#60a5fa";
const COLOR_FUEL   = "#fb7185";

const RADIUS_OUTER = 70;
const RADIUS_MID   = 56;
const RADIUS_INNER = 42;
const STROKE       = 11;

function Ring({ radius, pct, color }: { radius: number; pct: number; color: string }) {
  const C = 2 * Math.PI * radius;
  const dash = C * Math.max(0, Math.min(1, pct));
  return (
    <g>
      {/* track */}
      <circle
        cx={90} cy={90} r={radius}
        fill="none"
        stroke={`${color}22`}
        strokeWidth={STROKE}
      />
      {/* fill */}
      <circle
        cx={90} cy={90} r={radius}
        fill="none"
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
        strokeDashoffset={C / 4} // start at 12 o'clock
        transform="rotate(-90 90 90)"
        style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
      />
    </g>
  );
}

export default function ActivityRings() {
  const { goals } = useGoals();
  const { items: stack } = useStack();
  const { totalToday: pToday, target: pTarget } = useProtein();

  const goalsTotal = goals.length;
  const goalsDone  = goals.filter((g) => g.is_complete).length;
  const stackTotal = stack.length;
  const stackDone  = stack.filter((s) => s.taken).length;
  const fuelPct    = pTarget > 0 ? pToday / pTarget : 0;

  const pctGoals = goalsTotal > 0 ? goalsDone / goalsTotal : 0;
  const pctStack = stackTotal > 0 ? stackDone / stackTotal : 0;
  const pctFuel  = Math.min(1, fuelPct);

  const allClosed = pctGoals >= 1 && pctStack >= 1 && pctFuel >= 1;

  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!allClosed) return;
    if (typeof window === "undefined") return;
    const today = new Date().toISOString().slice(0, 10);
    const key = "ringsClosedDay";
    if (window.localStorage.getItem(key) === today) return;
    window.localStorage.setItem(key, today);
    setBurst((n) => n + 1);
    haptic("milestone");
  }, [allClosed]);

  return (
    <Card>
      <div className="relative flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <svg width={180} height={180} viewBox="0 0 180 180">
            <Ring radius={RADIUS_OUTER} pct={pctGoals} color={COLOR_GOALS} />
            <Ring radius={RADIUS_MID}   pct={pctStack} color={COLOR_STACK} />
            <Ring radius={RADIUS_INNER} pct={pctFuel}  color={COLOR_FUEL} />
          </svg>
          <ConfettiBurst trigger={burst} count={48} spread={180} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">— Today&apos;s rings</div>
          <RingRow label="Goals" color={COLOR_GOALS} value={`${goalsDone}/${goalsTotal || 0}`} pct={pctGoals} />
          <RingRow label="Stack" color={COLOR_STACK} value={`${stackDone}/${stackTotal || 0}`} pct={pctStack} />
          <RingRow label="Fuel"  color={COLOR_FUEL}  value={`${Math.round(pToday)}/${pTarget}g`} pct={pctFuel} />
          {allClosed && (
            <div className="mt-3 text-[11px] text-emerald-300 font-semibold tracking-wide">
              All three closed. Sir owned the day.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RingRow({ label, color, value, pct }: { label: string; color: string; value: string; pct: number }) {
  return (
    <div className="flex items-center gap-2 mb-1.5 last:mb-0">
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="text-[11px] text-zinc-400 w-12">{label}</span>
      <span className="text-[11px] text-zinc-200 tabular-nums w-16">{value}</span>
      <span className="text-[10px] text-zinc-600 tabular-nums">{Math.round(pct * 100)}%</span>
    </div>
  );
}
