"use client";

import { useState } from "react";
import { useOptimization } from "@/hooks/useOptimization";
import Card from "@/components/ui/Card";
import { EQUIPMENT_GROUPS } from "@/lib/fitness/equipment";
import { Sparkles, ChevronDown, ChevronUp, X, Check, Settings } from "lucide-react";

// Combined card: shows Coach optimization suggestions on top + an
// expandable equipment selector underneath. Lives on the Gym tab.
//
// "Conservative bias" is enforced in the engine — this card just renders
// whatever it gets back. If there are no recommendations, the suggestions
// section collapses to a single quiet line ("All clear. No upgrades flagged
// for Sir's current setup.").

export default function OptimizationCard() {
  const {
    loading, recommendations, availableEquipment, activeGymName, hasTrainingHistory,
    setEquipment, dismissRec, applySwap,
  } = useOptimization();

  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading) return null;

  const swaps  = recommendations.filter((r) => r.kind === "swap");
  const splits = recommendations.filter((r) => r.kind === "split");

  async function handleApply(exerciseId: string, newName: string, recId: string) {
    setBusyId(recId);
    await applySwap(exerciseId, newName);
    await dismissRec(recId); // also clear it so it doesn't reshow
    setBusyId(null);
  }

  function toggleEquipment(id: string) {
    const next = availableEquipment.includes(id)
      ? availableEquipment.filter((e) => e !== id)
      : [...availableEquipment, id];
    void setEquipment(next);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
          <Sparkles size={11} /> Coach Optimization
        </span>
        <span className="text-[10px] text-zinc-600">{activeGymName ?? "no gym selected"}</span>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-xs text-zinc-500 leading-relaxed">
          {hasTrainingHistory
            ? "All clear. No clear-upgrade swaps flagged for Sir's current setup. Coach will speak up if it finds one."
            : "Log a workout to start tracking. Coach stays quiet until there's real data — no recommendations from zero history."}
        </p>
      ) : (
        <div className="space-y-2.5 mb-3">
          {/* Exercise swap suggestions */}
          {swaps.map((r) => {
            if (r.kind !== "swap") return null;
            const recId = `swap:${r.exerciseId}:${r.swap.id}`;
            const isBusy = busyId === recId;
            const confColor = r.swap.confidence === "strong" ? "text-emerald-300" : "text-amber-300";
            return (
              <div key={recId} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-baseline justify-between mb-1.5">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className={`text-[9px] uppercase tracking-widest font-bold ${confColor}`}>
                      {r.swap.confidence}
                    </span>
                    {r.swap.muscleHint && (
                      <span className="text-[10px] text-zinc-600">· {r.swap.muscleHint}</span>
                    )}
                  </div>
                </div>
                <div className="text-sm font-semibold text-zinc-100 leading-snug mb-1">
                  <span className="text-zinc-500 line-through font-normal">{r.currentName}</span>
                  <span className="text-zinc-500 mx-1">→</span>
                  {r.swap.betterName}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-2">{r.swap.rationale}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApply(r.exerciseId, r.swap.betterName, recId)}
                    disabled={isBusy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-semibold disabled:opacity-40"
                  >
                    <Check size={11} /> Apply swap
                  </button>
                  <button
                    onClick={() => dismissRec(recId)}
                    disabled={isBusy}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-700 text-zinc-500 hover:text-zinc-200 text-[11px] disabled:opacity-40"
                  >
                    <X size={11} /> Not interested
                  </button>
                </div>
              </div>
            );
          })}

          {/* Split / volume issues */}
          {splits.map((r) => {
            if (r.kind !== "split") return null;
            const recId = `split:${r.issueId}`;
            return (
              <div key={recId} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-amber-300">Structure</span>
                </div>
                <div className="text-sm font-semibold text-zinc-100 leading-snug mb-1">{r.headline}</div>
                <p className="text-[11px] text-zinc-400 leading-relaxed mb-1">{r.rationale}</p>
                {r.suggestedStructure && (
                  <p className="text-[11px] text-amber-200 mb-2">Suggested: {r.suggestedStructure}</p>
                )}
                <button
                  onClick={() => dismissRec(recId)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-zinc-700 text-zinc-500 hover:text-zinc-200 text-[11px]"
                >
                  <X size={11} /> Dismiss
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Equipment selector — collapsible */}
      <button
        onClick={() => setEquipmentOpen((x) => !x)}
        className="w-full mt-3 flex items-center justify-between text-[11px] text-zinc-400 hover:text-zinc-200 py-1 border-t border-zinc-800/60 pt-3"
      >
        <span className="flex items-center gap-1">
          <Settings size={11} />
          {availableEquipment.length > 0
            ? `${availableEquipment.length} equipment items marked`
            : "Tell coach what's at your gym"}
        </span>
        {equipmentOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {equipmentOpen && (
        <div className="mt-3 space-y-3">
          <p className="text-[10px] text-zinc-600">
            Coach only suggests swaps Sir can actually do. More equipment marked → more potential upgrades surfaced.
          </p>
          {EQUIPMENT_GROUPS.map((g) => (
            <div key={g.category}>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">{g.label}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {g.items.map((e) => {
                  const on = availableEquipment.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleEquipment(e.id)}
                      className={`text-[11px] px-2 py-1.5 rounded-md border text-left ${
                        on ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                           : "bg-transparent border-zinc-800 text-zinc-400 hover:border-zinc-700"
                      }`}
                    >
                      {on && <Check size={9} className="inline mr-1" />}
                      {e.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
