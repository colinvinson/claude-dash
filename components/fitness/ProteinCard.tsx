"use client";

import { useProtein } from "@/hooks/useProtein";
import Card from "@/components/ui/Card";

// Protein progress strip — lives on the Gym tab (training nutrition lives with
// training). The +LOG sheet is still the way to log a new entry; this card is
// read-only.

export default function ProteinCard() {
  const { totalToday, target, pctOfTarget } = useProtein();
  const color =
    pctOfTarget >= 80 ? "#34d399" :
    pctOfTarget >= 50 ? "#fbbf24" :
                        "#a1a1aa";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Protein</span>
        <span className="text-xs tabular-nums text-zinc-500">Tap + to log</span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-4xl font-bold tabular-nums" style={{ color }}>
          {Math.round(totalToday)}
        </span>
        <span className="text-base text-zinc-500">/ {target}g</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, pctOfTarget)}%`,
            background: color,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1), background 400ms ease",
          }}
        />
      </div>
    </Card>
  );
}
