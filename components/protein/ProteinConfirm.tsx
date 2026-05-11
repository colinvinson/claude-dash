"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ProteinSource } from "@/hooks/useProtein";

type Props = {
  initial: {
    food_name: string;
    protein_g: number;
    score: number;
    reasoning: string;
    source: ProteinSource;
    barcode?: string | null;
  };
  onLog: (final: {
    protein_g: number;
    food_name: string;
    ai_score: number;
    ai_reasoning: string;
    source: ProteinSource;
    barcode?: string | null;
  }) => Promise<void> | void;
  onCancel: () => void;
};

function scoreColor(score: number): string {
  if (score >= 85) return "#10b981";  // emerald
  if (score >= 70) return "#22c55e";  // green
  if (score >= 50) return "#f59e0b";  // amber
  if (score >= 30) return "#f97316";  // orange
  return "#ef4444";                    // red
}

function scoreLabel(score: number): string {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "OKAY";
  if (score >= 30) return "POOR";
  return "JUNK";
}

export default function ProteinConfirm({ initial, onLog, onCancel }: Props) {
  const [foodName, setFoodName] = useState(initial.food_name);
  const [proteinG, setProteinG] = useState(initial.protein_g);
  const [submitting, setSubmitting] = useState(false);

  const color = scoreColor(initial.score);
  const r = 36;
  const C = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, initial.score / 100));
  const offset = C * (1 - pct);

  async function handleSubmit() {
    setSubmitting(true);
    await onLog({
      protein_g:    Number(proteinG),
      food_name:    foodName,
      ai_score:     initial.score,
      ai_reasoning: initial.reasoning,
      source:       initial.source,
      barcode:      initial.barcode ?? null,
    });
    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#0f0f0f] border border-zinc-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Review & log</span>
          <button onClick={onCancel} className="text-zinc-500 hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-5">
          <div className="relative" style={{ width: 88, height: 88 }}>
            <svg viewBox="0 0 100 100" width={88} height={88}>
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
              <span className="text-2xl font-bold text-white tabular-nums leading-none">{initial.score}</span>
              <span className="text-[9px] uppercase tracking-widest text-zinc-500 mt-0.5">/ 100</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full inline-block mb-2"
              style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
            >
              {scoreLabel(initial.score)}
            </span>
            <p className="text-xs text-zinc-400 leading-snug">{initial.reasoning}</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Food</label>
            <input
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Protein (g)</label>
            <input
              type="number"
              inputMode="decimal"
              value={proteinG}
              onChange={(e) => setProteinG(Number(e.target.value))}
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-2xl font-bold tabular-nums outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-semibold text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || proteinG <= 0}
            className="flex-1 py-3 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-xl text-sm font-bold text-zinc-900 transition-colors"
          >
            {submitting ? "Logging…" : "Log it"}
          </button>
        </div>
      </div>
    </div>
  );
}
