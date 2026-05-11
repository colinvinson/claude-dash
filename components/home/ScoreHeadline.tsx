"use client";

import type { ScoreResult } from "@/lib/scoring";
import { useAnimatedNumber } from "@/lib/useAnimatedNumber";

const ACCENT_COLORS: Record<ScoreResult["accent"], string> = {
  red: "#f87171",
  amber: "#fb923c",
  emerald: "#34d399",
};

export default function ScoreHeadline({ score, accent, headline }: ScoreResult) {
  const color = ACCENT_COLORS[accent];
  const animated = useAnimatedNumber(score, 900);

  return (
    <div className="px-1">
      <div className="flex items-baseline gap-3 mb-1">
        <span
          className="text-5xl font-black tabular-nums"
          style={{ color, transition: "color 400ms ease" }}
        >
          {animated}
        </span>
        <span
          className="text-[11px] font-bold uppercase tracking-[0.22em]"
          style={{ color, transition: "color 400ms ease" }}
        >
          {headline}
        </span>
      </div>
      {/* Thin gradient bar */}
      <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${score}%`,
            background: `linear-gradient(90deg, ${color}80, ${color})`,
            transition: "width 900ms cubic-bezier(0.22, 1, 0.36, 1), background 400ms ease",
          }}
        />
      </div>
    </div>
  );
}
