"use client";

import { useHealth } from "@/hooks/useHealth";
import { val } from "@/lib/fmt";

export default function TopHeader() {
  const { health } = useHealth();

  const date = new Date();
  const dayStr = date.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  }).toUpperCase();

  const r = health.readiness_score;
  const readinessColor =
    r == null ? "text-zinc-500"
    : r >= 67  ? "text-green-400"
    : r >= 34  ? "text-yellow-400"
    : "text-red-400";

  // Workout split: day of week → split name
  const splits = ["Rest", "Push", "Pull", "Legs", "Push", "Pull", "Legs"];
  const split  = splits[date.getDay()];

  return (
    <div className="sticky top-0 z-50 px-4" style={{ background: "rgba(5,5,6,0.85)", backdropFilter: "blur(24px) saturate(1.2)", WebkitBackdropFilter: "blur(24px) saturate(1.2)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between py-2">
        <span className="text-[11px] font-semibold tracking-[0.18em] text-zinc-300 uppercase">
          {dayStr}&nbsp;&nbsp;{split.toUpperCase()} DAY
        </span>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Live</span>
        </div>
      </div>

      <div className="flex items-center gap-3 pb-2 overflow-x-auto">
        <Stat label="SLEEP"     value={val(health.sleep_score, "%")} />
        <div className="w-px h-3 bg-zinc-700" />
        <Stat label="READINESS" value={val(health.readiness_score)} className={readinessColor} />
        <div className="w-px h-3 bg-zinc-700" />
        <Stat label="HRV"       value={val(health.hrv, "ms")} />
        <div className="w-px h-3 bg-zinc-700" />
        <Stat label="RHR"       value={val(health.rhr, "bpm")} />
        {r != null && r < 34 && (
          <>
            <div className="w-px h-3 bg-zinc-700" />
            <span className="text-[10px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 whitespace-nowrap">
              Watch Out
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, className = "text-zinc-200" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-baseline gap-1 whitespace-nowrap">
      <span className="text-[10px] text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className={`text-[11px] font-semibold ${className}`}>{value}</span>
    </div>
  );
}
