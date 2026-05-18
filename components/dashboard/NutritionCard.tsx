"use client";

import { useEffect, useMemo, useState } from "react";
import { useProtein } from "@/hooks/useProtein";
import MilesCard from "@/components/dashboard/MilesCard";
import { PALETTE } from "@/lib/design-tokens";

// 08 // NUTRITION — right column (only card on the right column).
// Big kcal hero, deficit caption, macros row, capture input, cutoff
// timer, and today's meal log.
//
// Rowan currently tracks protein in detail. Carbs / fat / total kcal
// aren't logged yet — for now: kcal estimated from protein + weight,
// carbs/fat target placeholders shown but actual = 0 until a future
// phase adds full macro logging.

const KCAL_TARGET   = 2800;        // TODO: pull from profile when added
const PROTEIN_PER_KG = 2.0;        // 2g/kg target
const CARBS_TARGET  = 300;
const FAT_TARGET    = 80;
const CUTOFF_HOUR   = 17;          // 5pm

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function kcalFromProtein(p: number): number {
  // Rough: protein × 4 + assumed 0 carbs/fat. Underestimates real kcal
  // but matches what Rowan actually KNOWS. User can override later.
  return Math.round(p * 4);
}

export default function NutritionCard() {
  const { logs, totalToday, target } = useProtein();
  const proteinTarget = target > 0 ? target : 180;

  const kcalToday = kcalFromProtein(totalToday);
  const deficit   = KCAL_TARGET - kcalToday;

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const cutoffMsLeft = useMemo(() => {
    const c = new Date(now);
    c.setHours(CUTOFF_HOUR, 0, 0, 0);
    return c.getTime() - now.getTime();
  }, [now]);

  const cutoffLabel = useMemo(() => {
    if (cutoffMsLeft <= 0) return "PAST CUTOFF";
    const totalMin = Math.floor(cutoffMsLeft / 60000);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `CUTOFF IN ${h}h ${m}m` : `CUTOFF IN ${m}m`;
  }, [cutoffMsLeft]);

  return (
    <MilesCard
      number="08"
      label="NUTRITION"
      right={
        <div className="flex items-center gap-2">
          <span className="text-zinc-700">‹</span>
          <span className="px-1.5 py-0.5 rounded text-zinc-200 bg-white/[0.05] border border-white/10">TODAY</span>
          <span className="text-zinc-700">›</span>
          <span className="text-zinc-600">HISTO</span>
        </div>
      }
    >
      {/* Hero kcal */}
      <div className="flex items-end gap-3 mb-1">
        <div className="text-5xl font-black tabular-nums tracking-[-0.04em] leading-none text-zinc-100">
          {kcalToday}
        </div>
        <div className="pb-1">
          <div className="text-[11px] text-zinc-500">of {KCAL_TARGET.toLocaleString()} kcal</div>
          <div className="text-[11px] font-semibold" style={{ color: deficit > 0 ? PALETTE.success : PALETTE.danger }}>
            {deficit > 0 ? "−" : "+"}{Math.abs(deficit).toLocaleString()} {deficit > 0 ? "deficit" : "surplus"}
          </div>
        </div>
      </div>

      {/* Macros */}
      <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-white/[0.04] text-[10px]">
        <MacroStat label="PROTEIN" actual={Math.round(totalToday)} target={proteinTarget} unit="g" accent={PALETTE.success} />
        <MacroStat label="CARBS"   actual={0}                       target={CARBS_TARGET}  unit="g" accent={PALETTE.info} />
        <MacroStat label="FAT"     actual={0}                       target={FAT_TARGET}    unit="g" accent={PALETTE.warning} />
      </div>

      {/* Capture */}
      <div
        className="flex items-center gap-2 rounded-md px-3 py-2 mt-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          border:     "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <input
          placeholder='Log a meal — try "estimate 500 cals"'
          className="flex-1 bg-transparent border-0 outline-none text-[12px] text-zinc-200 placeholder:text-zinc-600"
          disabled
        />
        <span className="text-zinc-700 text-sm">+</span>
      </div>

      {/* Cutoff */}
      <div className="flex items-center justify-between mt-4 text-[10px] uppercase tracking-[0.18em] font-semibold">
        <div className="flex items-center gap-1.5 text-zinc-500">
          <span className="inline-block w-1 h-1 rounded-full bg-zinc-500" />
          <span>CUTOFF · {CUTOFF_HOUR}:00 {CUTOFF_HOUR < 12 ? "AM" : "PM"}</span>
        </div>
        <div className="text-zinc-400">{cutoffLabel}</div>
      </div>

      {/* Meal log */}
      <div className="mt-4">
        <div className="text-[9px] uppercase tracking-[0.22em] text-zinc-600 font-semibold mb-2">
          Today · hover to edit
        </div>
        {logs.length === 0 ? (
          <div className="text-[11px] text-zinc-600 italic py-3 text-center">No meals logged yet.</div>
        ) : (
          <div className="space-y-1.5">
            {logs.slice(0, 5).map((m) => (
              <div key={m.id} className="grid grid-cols-[44px_1fr_auto_auto] gap-2 items-baseline text-[12px]">
                <span className="tabular-nums text-zinc-500 text-[11px]">{fmtTime(m.logged_at)}</span>
                <span className="text-zinc-200 truncate">{m.food_name ?? "Meal"}</span>
                <span className="tabular-nums text-zinc-500 text-[11px]">{kcalFromProtein(Number(m.protein_g))}k</span>
                <span className="tabular-nums text-zinc-500 text-[11px]">{Math.round(Number(m.protein_g))}p</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </MilesCard>
  );
}

function MacroStat({ label, actual, target, unit, accent }: { label: string; actual: number; target: number; unit: string; accent: string }) {
  const pct = target > 0 ? Math.min(1, actual / target) : 0;
  return (
    <div>
      <div className="uppercase tracking-[0.18em] text-zinc-600 font-semibold">{label}</div>
      <div className="text-zinc-300 mt-1 tabular-nums text-[11px]">
        <span className="font-semibold" style={{ color: actual > 0 ? "#fafafa" : "#71717a" }}>{actual}</span>
        <span className="text-zinc-700">/{target}{unit}</span>
      </div>
      <div className="h-0.5 rounded-full mt-1 overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="h-full rounded-full" style={{ width: `${pct * 100}%`, background: accent, transition: "width 600ms ease" }} />
      </div>
    </div>
  );
}
