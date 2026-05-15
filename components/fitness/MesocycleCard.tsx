"use client";

import { useState } from "react";
import { useMesocycle, type MusclePriority } from "@/hooks/useMesocycle";
import { VOLUME_TARGETS } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";
import { Calendar, ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const MUSCLES = Object.keys(VOLUME_TARGETS);

export default function MesocycleCard() {
  const { active, state, loading, start, end, setPriority } = useMesocycle();
  const [expanded, setExpanded] = useState(false);
  const [busy,     setBusy]     = useState(false);

  if (loading) return null;

  // No active meso → CTA to start one.
  if (!active || !state) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Mesocycle</span>
          <span className="text-[10px] text-zinc-600">5-week block · auto deload</span>
        </div>
        <div className="text-sm text-zinc-300 mb-3">
          No active block. Hypertrophy programs work in 4–6 week mesocycles — volume ramps weekly, then a forced deload to bank recovery.
        </div>
        <button
          onClick={async () => { setBusy(true); await start(); setBusy(false); }}
          disabled={busy}
          className="w-full py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-900 disabled:opacity-40"
        >
          {busy ? "…" : "Start 5-week block"}
        </button>
      </Card>
    );
  }

  const totalWeeks = active.planned_weeks;
  const w          = state.currentWeek;
  const isDeload   = state.isDeloadWeek;
  const isComplete = state.phase === "complete";

  const phaseColor = isComplete
    ? "#a1a1aa"
    : isDeload
      ? "#60a5fa"
      : "#34d399";
  const phaseLabel = isComplete
    ? "BLOCK COMPLETE"
    : isDeload
      ? `DELOAD · Week ${w}/${totalWeeks}`
      : `Week ${w}/${totalWeeks} · accumulate`;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Mesocycle</span>
        <span className="text-[10px] tabular-nums" style={{ color: phaseColor }}>
          {phaseLabel}
        </span>
      </div>

      {/* Week dots */}
      <div className="flex items-center gap-1.5 mb-3">
        {Array.from({ length: totalWeeks }).map((_, i) => {
          const wk = i + 1;
          const isCurrent = wk === w;
          const isDone    = wk < w;
          const isThisDeload = wk === totalWeeks;
          const bg = isCurrent ? phaseColor :
                     isDone    ? "#3f3f46" :
                                 "transparent";
          const border = isCurrent ? phaseColor :
                         isThisDeload ? "#60a5fa55" :
                                        "#3f3f46";
          return (
            <div
              key={wk}
              title={isThisDeload ? `Week ${wk} — deload` : `Week ${wk}`}
              className="h-2 flex-1 rounded-full"
              style={{ background: bg, border: `1px solid ${border}` }}
            />
          );
        })}
      </div>

      {/* This week guidance */}
      <div className="text-sm text-zinc-100 mb-1">
        {isComplete
          ? "Block done. Start a new one to keep adapting."
          : isDeload
            ? "Half volume, RIR 3 on everything, no failure. Bank fatigue."
            : `Push toward MRV. Lagging muscles → mark as ★ specialize below.`}
      </div>
      <div className="text-[11px] text-zinc-500 mb-3">
        Started {active.start_date} · {state.daysIntoWeek + 1}/7 days into the week
      </div>

      {/* Expand for specialization + actions */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-200 py-1"
      >
        <span>{expanded ? "Hide settings" : "Settings · weak points · end block"}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-zinc-800/60 pt-3">
          {/* Weak-point specialization */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
              <Sparkles size={10} /> Bring-up priorities
            </div>
            <div className="text-[10px] text-zinc-600 mb-2">
              Tap to cycle: normal → ★ specialize (hold near MRV) → · maintain (stay at MEV) → normal.
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {MUSCLES.map((m) => {
                const current = active.muscle_priorities?.[m] as MusclePriority | undefined;
                const next: MusclePriority | null =
                  current == null         ? "specialize" :
                  current === "specialize" ? "maintenance" :
                                             null;
                const label = current === "specialize" ? "★ specialize" :
                              current === "maintenance" ? "· maintain" :
                                                          m;
                const color = current === "specialize" ? "text-amber-300 border-amber-500/40 bg-amber-500/10" :
                              current === "maintenance" ? "text-zinc-500 border-zinc-700 bg-zinc-800/40" :
                                                          "text-zinc-300 border-zinc-700/60 bg-transparent";
                return (
                  <button
                    key={m}
                    onClick={async () => { setBusy(true); await setPriority(m, next); setBusy(false); }}
                    disabled={busy}
                    className={`text-[11px] px-2 py-1.5 rounded-md border ${color} text-left truncate`}
                  >
                    <span className="text-zinc-600 mr-1">{m}:</span>{label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Block actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={async () => { setBusy(true); await start(); setBusy(false); }}
              disabled={busy}
              className="flex-1 py-1.5 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-900 disabled:opacity-40"
            >
              <Calendar size={11} className="inline mr-1" /> Start new block
            </button>
            <button
              onClick={async () => { setBusy(true); await end(); setBusy(false); }}
              disabled={busy}
              className="flex-1 py-1.5 rounded-md text-[11px] font-semibold border border-zinc-700 text-zinc-400 disabled:opacity-40"
            >
              End block
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
