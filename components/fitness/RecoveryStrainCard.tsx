"use client";

import { useWorkout } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";

const BAND_COLOR: Record<string, string> = {
  exceptional: "#10b981",  // emerald-500
  primed:      "#22c55e",  // green-500
  adequate:    "#f59e0b",  // amber-500
  compromised: "#f97316",  // orange-500
  low:         "#ef4444",  // red-500
};

const BAND_LABEL: Record<string, string> = {
  exceptional: "EXCEPTIONAL",
  primed:      "PRIMED",
  adequate:    "ADEQUATE",
  compromised: "COMPROMISED",
  low:         "LOW",
};

function Ring({ value, max, color, suffix }: { value: number; max: number; color: string; suffix?: string }) {
  const r = 38;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  const offset = C * (1 - pct);

  return (
    <div className="relative" style={{ width: 96, height: 96 }}>
      <svg viewBox="0 0 100 100" width={96} height={96}>
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <circle
          cx={50} cy={50} r={r}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-white tabular-nums leading-none">{value}</span>
        {suffix && <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">{suffix}</span>}
      </div>
    </div>
  );
}

export default function RecoveryStrainCard() {
  const { recovery, sessionStrain, loading } = useWorkout();

  if (loading) {
    return <div className="h-32 bg-[#111111] border border-[#1f1f1f] rounded-2xl animate-pulse" />;
  }

  if (!recovery) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Recovery</span>
          <span className="text-[10px] text-zinc-600">no Oura data today</span>
        </div>
        <p className="text-xs text-zinc-500 mt-3">Sync your Oura ring to see recovery + strain coaching.</p>
      </Card>
    );
  }

  const color = BAND_COLOR[recovery.band];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Recovery & Strain</span>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
        >
          {BAND_LABEL[recovery.band]}
        </span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center gap-1.5">
          <Ring value={recovery.score} max={100} color={color} suffix="Recovery" />
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <Ring value={Math.round(sessionStrain)} max={21} color="#ffffff" suffix="Strain" />
        </div>

        <div className="flex-1 min-w-0">
          {recovery.drivers.length > 0 ? (
            <ul className="space-y-1">
              {recovery.drivers.slice(0, 4).map((d, i) => (
                <li key={i} className="text-[11px] text-zinc-400 leading-tight">· {d}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-zinc-500">All systems firing.</p>
          )}
        </div>
      </div>
    </Card>
  );
}
