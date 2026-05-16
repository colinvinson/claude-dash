"use client";

// Unified streak-state surface. Replaces both the old red "at risk" card
// AND the StreakForgivenessCard. ONE card with three variants chosen by
// signal priority:
//
//   1. AT-RISK   — after 8pm, streak ≥3, zero goals done today (loss-aversion)
//   2. PAUSED    — any active stack item with a ≥7-day longest streak that
//                  broke today (reframes as "paused, restart tomorrow")
//   3. RESTART   — partial progress today (positive reframing, no shame)
//
// Returns null when none of these fire, so Home stays quiet on a clean day.

import { useMemo } from "react";
import { Flame, Pause, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import { useGoals } from "@/hooks/useGoals";
import { useStack } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import { PALETTE, TINT, BORDER, TYPE } from "@/lib/design-tokens";

export default function StreakAlert() {
  const { items } = useStack();
  const { goals, streak } = useGoals();
  const { insights } = useStackInsights(items);

  const now = new Date();
  const isLate = now.getHours() >= 20;
  const goalsDone = goals.filter((g) => g.is_complete).length;

  const todayDow   = new Date().getDay();
  const todayItems = useMemo(
    () => items.filter((i) => !i.days_of_week || i.days_of_week.length === 0 || i.days_of_week.length === 7 || i.days_of_week.includes(todayDow)),
    [items, todayDow],
  );
  const doneItems = todayItems.filter((i) => i.taken).length;

  const recentlyPaused = useMemo(() => {
    const out: Array<{ name: string; lifetimeBest: number }> = [];
    for (const item of todayItems) {
      const ins = insights[item.id];
      if (!ins) continue;
      if (ins.longestStreak >= 7 && ins.streak === 0 && !item.taken) {
        out.push({ name: item.name, lifetimeBest: ins.longestStreak });
      }
    }
    return out.slice(0, 3);
  }, [todayItems, insights]);

  // ── Variant selection ──
  // Priority: at-risk (load-bearing for streak retention) → paused (reframe)
  // → restart (positive momentum). Returns null if no signal.
  const variant: "at-risk" | "paused" | "restart" | null = (() => {
    if (isLate && streak >= 3 && goalsDone === 0) return "at-risk";
    if (recentlyPaused.length > 0)                return "paused";
    if (doneItems > 0 || goalsDone > 0)           return null; // momentum exists, no friction needed — let other cards carry the signal
    if (isLate && todayItems.length > 0)          return "restart"; // late + nothing done → soft prompt
    return null;
  })();

  if (!variant) return null;

  if (variant === "at-risk") {
    return (
      <Card style={{ background: TINT.danger, border: `1px solid ${BORDER.danger}` }}>
        <div className="flex items-center gap-3">
          <Flame size={20} style={{ color: PALETTE.danger }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold" style={{ color: PALETTE.danger }}>
              {streak}-day streak at risk
            </p>
            <p className={TYPE.label} style={{ textTransform: "none", letterSpacing: 0, color: "rgb(161 161 170)" }}>
              Knock one goal out before midnight to hold it.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (variant === "paused") {
    return (
      <Card style={{ background: TINT.warning, border: `1px solid ${BORDER.warning}` }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Pause size={11} style={{ color: PALETTE.warning }} />
          <span className={TYPE.label} style={{ color: PALETTE.warning }}>Paused, not broken</span>
        </div>
        <p className="text-sm text-zinc-100 font-medium">
          {recentlyPaused.length === 1
            ? `${recentlyPaused[0].name} — ${recentlyPaused[0].lifetimeBest}d run paused.`
            : `${recentlyPaused.length} streaks paused today.`}
        </p>
        <p className="text-[11px] text-zinc-400 mt-1">Pick it back up tomorrow. Long-term consistency beats unbroken counts.</p>
      </Card>
    );
  }

  // restart
  return (
    <Card>
      <div className="flex items-center gap-1.5 mb-1.5">
        <Sparkles size={11} className="text-zinc-500" />
        <span className={TYPE.label}>One before bed?</span>
      </div>
      <p className="text-sm text-zinc-200 font-medium">One item, one tap. End on a win.</p>
    </Card>
  );
}
