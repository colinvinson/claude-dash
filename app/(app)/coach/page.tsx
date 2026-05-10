"use client";

import { useState } from "react";
import { useOverseerInsights } from "@/hooks/useOverseerInsights";
import OverseerChat from "@/components/overseer/OverseerChat";

const SEVERITY_STYLES = {
  green:  { bg: "rgba(52,211,153,0.12)", color: "#34d399", border: "rgba(52,211,153,0.2)" },
  yellow: { bg: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "rgba(251,191,36,0.2)" },
  red:    { bg: "rgba(239,68,68,0.12)",  color: "#f87171", border: "rgba(239,68,68,0.2)"  },
};

export default function CoachPage() {
  const { insights, dismiss } = useOverseerInsights();
  const [ctxOpen, setCtxOpen] = useState(false);

  return (
    <div className="flex flex-col" style={{ height: "calc(100dvh - 112px)" }}>
      {/* Recent insights */}
      {insights.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-0 pb-2 flex-shrink-0 no-scrollbar">
          {insights.slice(0, 3).map((insight) => {
            const style = SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.green;
            return (
              <div
                key={insight.id}
                className="flex items-start gap-2 px-3 py-2 rounded-2xl flex-shrink-0 max-w-[85vw]"
                style={{
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                }}
              >
                <span className="text-[11px] leading-relaxed flex-1" style={{ color: style.color }}>
                  {insight.body}
                </span>
                <button
                  onClick={() => dismiss(insight.id)}
                  className="text-xs opacity-50 hover:opacity-100 flex-shrink-0 mt-0.5"
                  style={{ color: style.color }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Context transparency */}
      <div className="flex-shrink-0 mb-2">
        <button
          onClick={() => setCtxOpen((v) => !v)}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-widest"
        >
          {ctxOpen ? "▾" : "▸"} What Overseer sees
        </button>
        {ctxOpen && (
          <div
            className="mt-1.5 px-3 py-2 rounded-xl text-[11px] text-zinc-500 leading-relaxed"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            Health (Oura) · Goals & streaks · Supplements & medications · Workouts · Daily check-in · Journal entries · Long-term goals · Water · Faith · Mood
          </div>
        )}
      </div>

      {/* Full-height chat */}
      <div
        className="flex-1 min-h-0 rounded-2xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <OverseerChat />
      </div>
    </div>
  );
}
