"use client";

import { useWorkout, MuscleVolume, VOLUME_TARGETS } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";

const GROUP_ORDER = Object.keys(VOLUME_TARGETS);

const STATUS_COLOR: Record<MuscleVolume["status"], string> = {
  under:   "bg-zinc-700",
  optimal: "bg-emerald-500",
  over:    "bg-amber-500",
};

const STATUS_LABEL: Record<MuscleVolume["status"], string> = {
  under:   "under",
  optimal: "✓",
  over:    "over",
};

export default function WeeklyVolumeCard() {
  const { weeklyVolume, loading } = useWorkout();

  if (loading) return null;

  const sorted = GROUP_ORDER
    .map((m) => weeklyVolume.find((v) => v.muscle === m))
    .filter(Boolean) as MuscleVolume[];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Weekly Volume</span>
        <span className="text-[10px] text-zinc-600">MEV–MRV targets</span>
      </div>

      {/* Column headers */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-zinc-700 w-24">Muscle</span>
        <span className="text-[10px] text-zinc-700 flex-1 text-right pr-2">Sets (MEV–MRV)</span>
        <span className="text-[10px] text-zinc-700 w-16 text-right">Freq/wk</span>
      </div>

      <div className="space-y-3">
        {sorted.map((v) => {
          const pct    = v.target.max > 0 ? Math.min((v.sets / v.target.max) * 100, 100) : 0;
          const mevPct = (v.target.min / v.target.max) * 100;
          const freqOk = v.frequency >= 2;

          return (
            <div key={v.muscle}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-400 w-24">{v.muscle}</span>
                <span className="text-[10px] text-zinc-600 flex-1 text-right pr-2">
                  {v.sets} / {v.target.min}–{v.target.max}
                </span>
                <div className="flex items-center justify-end gap-1 w-16">
                  <span
                    className={`text-[10px] font-semibold ${
                      v.status === "optimal" ? "text-emerald-400" :
                      v.status === "over"    ? "text-amber-400"   :
                                              "text-zinc-600"
                    }`}
                  >
                    {STATUS_LABEL[v.status]}
                  </span>
                  <span className={`text-[10px] ${freqOk ? "text-emerald-500" : "text-zinc-700"}`}>
                    {v.frequency}×
                  </span>
                </div>
              </div>

              {/* Track */}
              <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 w-px bg-zinc-600 z-10"
                  style={{ left: `${mevPct}%` }}
                />
                <div
                  className={`h-full rounded-full transition-all duration-300 ${STATUS_COLOR[v.status]}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-700 mt-3">
        | = MEV · green bar = optimal · freq target: 2–3×/wk
      </p>
    </Card>
  );
}
