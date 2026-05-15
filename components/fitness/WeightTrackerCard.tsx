"use client";

import { useState } from "react";
import { useWeight } from "@/hooks/useWeight";
import Card from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Minus, Scale } from "lucide-react";
import { kgToLb, lbToKg } from "@/lib/units";

// Color per verdict tag — green for clear positives (lean-bulk, recomp,
// clean-cut), amber for "watch out", red for clear negatives, zinc neutral.
const TAG_COLOR: Record<string, string> = {
  "lean-bulk":  "#34d399",
  "recomp":     "#34d399",
  "clean-cut":  "#34d399",
  "maintain":   "#a1a1aa",
  "fat-gain":   "#fbbf24",
  "lossy-cut":  "#fbbf24",
  "regression": "#f87171",
  "insufficient": "#a1a1aa",
};

// Minimal inline SVG sparkline. Domain is min..max of the window so even
// tiny daily swings look readable.
function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="32" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts.join(" ")} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WeightTrackerCard() {
  const { points, verdict, currentKg, delta7, logWeight, loading } = useWeight(30);
  const [draft,     setDraft]     = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLog() {
    // User types pounds; stored as kg in DB.
    const lb = parseFloat(draft);
    if (!isFinite(lb) || lb <= 0) return;
    setSubmitting(true);
    await logWeight(lbToKg(lb));
    setDraft("");
    setSubmitting(false);
  }

  // Convert the kg-stored signals to lb for display. Thresholds adjusted
  // (~0.22 lb is the equivalent of the old 0.1 kg trend tolerance).
  const currentLb = currentKg != null ? kgToLb(currentKg) : null;
  const delta7Lb  = delta7    != null ? kgToLb(delta7)    : null;

  const tagColor = verdict ? TAG_COLOR[verdict.tag] ?? "#a1a1aa" : "#a1a1aa";
  const TrendIcon =
    delta7Lb == null ? Minus :
    delta7Lb >  0.25 ? TrendingUp :
    delta7Lb < -0.25 ? TrendingDown :
                       Minus;
  const deltaColor =
    delta7Lb == null ? "text-zinc-500" :
    delta7Lb >  0.25 ? "text-orange-400" :
    delta7Lb < -0.25 ? "text-sky-400" :
                       "text-zinc-400";

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Body Weight</span>
        <span className="text-[10px] text-zinc-600 tabular-nums">{points.length}d logged</span>
      </div>

      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-4xl font-bold tabular-nums text-zinc-100">
          {currentLb != null ? currentLb.toFixed(1) : "—"}
        </span>
        <span className="text-base text-zinc-500">lb</span>
        {delta7Lb != null && (
          <span className={`flex items-center gap-1 text-xs tabular-nums ${deltaColor}`}>
            <TrendIcon size={12} />
            {delta7Lb >= 0 ? "+" : ""}{delta7Lb.toFixed(1)} 7d
          </span>
        )}
      </div>

      {points.length >= 2 && (
        <div className="mb-3">
          <Sparkline values={points.map((p) => kgToLb(p.weight_kg))} color={tagColor} />
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Scale size={14} className="text-zinc-500" />
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="Log weigh-in"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 flex-1 outline-none tabular-nums"
          />
          <span className="text-xs text-zinc-500">lb</span>
        </div>
        <button
          onClick={handleLog}
          disabled={submitting || draft.length === 0}
          className="px-4 py-2 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-900 disabled:opacity-40 disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {submitting ? "…" : "Log"}
        </button>
      </div>

      {!loading && verdict && (
        <div className="rounded-lg p-3" style={{ background: `${tagColor}10`, border: `1px solid ${tagColor}33` }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-widest" style={{ color: tagColor }}>
              Recomp Read
            </span>
            {verdict.tag !== "insufficient" && (
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {verdict.weightRateLbWk >= 0 ? "+" : ""}{verdict.weightRateLbWk.toFixed(2)} lb/wk
                {" · "}
                1RM {verdict.strengthDeltaPct >= 0 ? "+" : ""}{verdict.strengthDeltaPct.toFixed(1)}%
                {" · "}
                P {Math.round(verdict.proteinAdherence * 100)}%
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-zinc-100 mb-1">{verdict.headline}</div>
          <div className="text-xs text-zinc-400 leading-relaxed">{verdict.detail}</div>
        </div>
      )}
    </Card>
  );
}
