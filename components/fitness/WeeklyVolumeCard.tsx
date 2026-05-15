"use client";

import { useEffect, useState } from "react";
import { useWorkout, MuscleVolume, VOLUME_TARGETS } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";

const GROUP_ORDER = Object.keys(VOLUME_TARGETS);

// Track color picks the BAR color. Status keys here line up with the
// mesocycle-aware `weekStatus` from useWorkout.
const WEEK_STATUS_COLOR: Record<MuscleVolume["weekStatus"], string> = {
  "below":       "bg-zinc-700",
  "near":        "bg-amber-500",
  "at-or-over":  "bg-emerald-500",
};

const WEEK_STATUS_LABEL: Record<MuscleVolume["weekStatus"], string> = {
  "below":       "below",
  "near":        "near",
  "at-or-over":  "✓",
};

const PRIORITY_BADGE: Record<MuscleVolume["priority"], string | null> = {
  "normal":       null,
  "specialize":   "★",   // pushing — at MRV
  "maintenance":  "·",  // holding — at MEV
};

export default function WeeklyVolumeCard() {
  const { weeklyVolume, mesoState, loading } = useWorkout();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (loading) return null;

  const sorted = GROUP_ORDER
    .map((m) => weeklyVolume.find((v) => v.muscle === m))
    .filter(Boolean) as MuscleVolume[];

  const headerTag = mesoState?.isDeloadWeek
    ? "Deload week — half volume"
    : mesoState
      ? `Week ${mesoState.currentWeek} target`
      : "MEV–MRV envelope";

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Weekly Volume</span>
        <span className="text-[10px] text-zinc-600">{headerTag}</span>
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-700 w-24">Muscle</span>
        <span className="text-[10px] text-zinc-700 flex-1 text-right pr-2">Sets / target</span>
        <span className="text-[10px] text-zinc-700 w-16 text-right">Freq/wk</span>
      </div>

      <div className="space-y-3">
        {sorted.map((v) => {
          // The track length scales to MRV so the same visual envelope works
          // across muscles. The week-target marker shows where the user should
          // BE this week, the MEV marker is the absolute floor.
          const mrv = v.target.max;
          const mevPct       = (v.target.min / mrv) * 100;
          const weekTargetPct = Math.min(100, (v.weekTarget / mrv) * 100);
          const setsPct      = Math.min(100, (v.sets / mrv) * 100);
          const freqOk = v.frequency >= 2;
          const priorityBadge = PRIORITY_BADGE[v.priority];

          return (
            <div key={v.muscle}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 w-24 flex items-center gap-1">
                  {v.muscle}
                  {priorityBadge && (
                    <span className={v.priority === "specialize" ? "text-amber-400" : "text-zinc-600"}>
                      {priorityBadge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-zinc-600 flex-1 text-right pr-2 tabular-nums">
                  {v.sets} / {v.weekTarget}
                  <span className="text-zinc-700"> ({v.target.min}-{v.target.max})</span>
                </span>
                <div className="flex items-center justify-end gap-1 w-16">
                  <span
                    className={`text-[10px] font-semibold ${
                      v.weekStatus === "at-or-over" ? "text-emerald-400" :
                      v.weekStatus === "near"       ? "text-amber-400"   :
                                                      "text-zinc-600"
                    }`}
                  >
                    {WEEK_STATUS_LABEL[v.weekStatus]}
                  </span>
                  <span className={`text-[10px] ${freqOk ? "text-emerald-500" : "text-zinc-700"}`}>
                    {v.frequency}×
                  </span>
                </div>
              </div>

              <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                {/* MEV marker (faint) */}
                <div className="absolute top-0 bottom-0 w-px bg-zinc-700 z-10" style={{ left: `${mevPct}%` }} />
                {/* Week target marker (brighter) */}
                <div className="absolute top-0 bottom-0 w-px bg-zinc-400 z-20" style={{ left: `${weekTargetPct}%` }} />
                <div
                  className={`h-full rounded-full ${WEEK_STATUS_COLOR[v.weekStatus]}`}
                  style={{
                    width: `${mounted ? setsPct : 0}%`,
                    transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1), background-color 300ms ease",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-700 mt-3">
        bright tick = this week&apos;s target · faint = MEV · ★ = specialize · · = maintenance · target: 2+ sessions/wk
      </p>
    </Card>
  );
}
