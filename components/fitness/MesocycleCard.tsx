"use client";

import { useState } from "react";
import { useMesocycle, type MusclePriority } from "@/hooks/useMesocycle";
import { VOLUME_TARGETS } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";

const MUSCLES = Object.keys(VOLUME_TARGETS);

export default function MesocycleCard() {
  const { active, state, loading, setPriority } = useMesocycle();
  const [expanded, setExpanded] = useState(false);
  const [busy,     setBusy]     = useState(false);

  if (loading) return null;

  // No active meso means no training history yet. The block will auto-spawn
  // on the first logged workout set — no CTA needed.
  if (!active || !state) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Mesocycle</span>
          <span className="text-[10px] text-zinc-600">auto-starts on first lift</span>
        </div>
        <div className="text-sm text-zinc-400">
          A 5-week block will start the moment Sir logs his first working set. Volume ramps weekly, with a forced deload in week 5.
        </div>
      </Card>
    );
  }

  const totalWeeks = active.planned_weeks;
  const w          = state.currentWeek;
  const isDeload   = state.isDeloadWeek;

  const phaseColor = isDeload ? "#60a5fa" : "#34d399";
  const phaseLabel = isDeload
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
        {isDeload
          ? "Half volume, RIR 3 on everything, no failure. Bank fatigue."
          : `Push toward MRV. Lagging muscles → mark as ★ specialize below.`}
      </div>
      <div className="text-[11px] text-zinc-500 mb-3">
        Started {active.start_date} · {state.daysIntoWeek + 1}/7 days into the week · auto-rolls into next block
      </div>

      {/* Expand for specialization */}
      <button
        onClick={() => setExpanded((x) => !x)}
        className="w-full flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-200 py-1"
      >
        <span>{expanded ? "Hide weak-point priorities" : "Mark weak points"}</span>
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-zinc-800/60 pt-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 flex items-center gap-1">
              <Sparkles size={10} /> Bring-up priorities
            </div>
            <div className="text-[10px] text-zinc-600 mb-2">
              Tap to cycle: normal → ★ specialize (hold near MRV) → · maintain (stay at MEV) → normal. Carries forward to future blocks.
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
        </div>
      )}
    </Card>
  );
}
