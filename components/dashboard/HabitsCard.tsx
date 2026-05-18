"use client";

import { useMemo } from "react";
import { useStack } from "@/hooks/useStack";
import MilesCard from "@/components/dashboard/MilesCard";
import { PALETTE } from "@/lib/design-tokens";

// 03 // HABITS — center column middle card.
// Top: big circular score (0-N done) + "Start with one." caption.
// Bottom: grid of habit toggles (3 cols × 2 rows = 6 items max).
//
// In Rowan, "habits" = today's routine items (supplements / meds /
// habits / skincare / exercise) from supplement_stack. Tap to toggle
// taken. Same data as the existing Schedule tab — Home just surfaces
// the first 6 for one-click adherence.

export default function HabitsCard() {
  const { items, toggle, loading } = useStack();

  // Filter to today's day-of-week, take first 6
  const todayDow = new Date().getDay();
  const todayItems = useMemo(() => {
    return items.filter((i) => {
      if (!i.days_of_week || i.days_of_week.length === 0 || i.days_of_week.length === 7) return true;
      return i.days_of_week.includes(todayDow);
    });
  }, [items, todayDow]);
  const display = todayItems.slice(0, 6);

  const done   = display.filter((i) => i.taken).length;
  const total  = display.length;
  const pct    = total === 0 ? 0 : Math.round((done / total) * 100);

  // Ring math
  const R = 28, C = 2 * Math.PI * R;
  const dash = C * (total > 0 ? done / total : 0);

  return (
    <MilesCard
      number="03"
      label="HABITS"
      right={
        <span className="tabular-nums">
          {done}/{total || 6} · {pct}%
        </span>
      }
    >
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-[70px] h-[70px] flex-shrink-0">
          <svg width={70} height={70}>
            <circle cx={35} cy={35} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
            <circle
              cx={35} cy={35} r={R}
              fill="none"
              stroke={done > 0 ? PALETTE.success : "rgba(255,255,255,0.10)"}
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={C / 4}
              transform="rotate(-90 35 35)"
              style={{ transition: "stroke-dasharray 700ms cubic-bezier(0.22,1,0.36,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-black tabular-nums tracking-tight text-zinc-100">
              {done}
            </span>
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600 font-semibold">
            Daily score · resets 00:00
          </div>
          <div className="text-zinc-400 text-[13px] italic mt-1">
            {done === 0 ? "Start with one." : done === total ? "Day owned." : `${total - done} to go.`}
          </div>
        </div>
      </div>

      {/* Habit grid */}
      {loading && display.length === 0 ? (
        <div className="text-[11px] text-zinc-600 py-4 text-center">…</div>
      ) : display.length === 0 ? (
        <div className="text-[11px] text-zinc-600 py-4 text-center italic">
          No routine items today. Add some in Schedule.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {display.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item.id, item.taken, item.log_id)}
              className="text-left rounded-md px-2.5 py-2 transition-colors"
              style={{
                background: item.taken ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)",
                border:     `1px solid ${item.taken ? "rgba(52,211,153,0.20)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-start gap-2">
                {/* Checkbox */}
                <span
                  className="mt-0.5 w-3 h-3 flex-shrink-0 rounded-sm flex items-center justify-center"
                  style={{
                    background: item.taken ? "#fafafa" : "transparent",
                    border:     `1px solid ${item.taken ? "#fafafa" : "rgba(255,255,255,0.20)"}`,
                  }}
                >
                  {item.taken && (
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4 L3 5.5 L6.5 2" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold text-zinc-200 leading-snug line-clamp-2">
                    {item.name}
                  </div>
                  <div className="text-[9px] uppercase tracking-[0.18em] text-zinc-600 font-semibold mt-0.5">
                    {(item.timing ?? "anytime").toLowerCase()}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </MilesCard>
  );
}
