"use client";

import { useMedications } from "@/hooks/useMedications";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/layout/SectionLabel";

export default function VeloTracker() {
  const { veloCount, veloLimit, adjustVelo } = useMedications();

  return (
    <div>
      <SectionLabel>Velo Tracker</SectionLabel>
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Velo · 10mg</span>
            <p className="text-sm font-semibold text-zinc-100">Daily intake</p>
            <p className="text-[11px] text-zinc-500">Quick-log every pouch. Resets at 6 AM.</p>
          </div>
          <div className="text-right">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Today</span>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{veloCount}</span>
              <span className="text-sm text-zinc-500">/ {veloLimit}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4">
          {Array.from({ length: veloLimit }).map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i < veloCount ? "bg-orange-400" : "bg-zinc-800"}`} />
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => adjustVelo(-1)}
            className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-lg font-bold text-zinc-300 transition-colors"
          >
            −
          </button>
          <button
            onClick={() => adjustVelo(1)}
            className="flex-1 py-2.5 bg-zinc-700 hover:bg-zinc-600 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            Took a Velo ↑
          </button>
        </div>
      </Card>
    </div>
  );
}
