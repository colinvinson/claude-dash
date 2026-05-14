"use client";

// ADHD-optimized: reframes "you broke your streak" as "your streak is paused, restart tomorrow."
// Also celebrates partial-day wins instead of letting a 1-of-8 day feel like a 0-of-8 day.
//
// Surfaces only when there's a meaningful signal — silent otherwise so the
// Home tab doesn't get cluttered.

import { useMemo } from "react";
import { Pause, Sparkles } from "lucide-react";
import { useGoals } from "@/hooks/useGoals";
import { useStack } from "@/hooks/useStack";
import { useStackInsights } from "@/hooks/useStackInsights";
import Card from "@/components/ui/Card";

export default function StreakForgivenessCard() {
  const { items } = useStack();
  const { goals } = useGoals();
  const { insights } = useStackInsights(items);

  const todayDow = new Date().getDay();
  const todayItems = useMemo(() =>
    items.filter((i) => !i.days_of_week || i.days_of_week.length === 0 || i.days_of_week.length === 7 || i.days_of_week.includes(todayDow)),
  [items, todayDow]);

  // ── Signal 1: items that BROKE a long streak today (≥7 day streak, missed today) ─────
  // We check: an item that has a "longestStreak ≥ 7" and 0 done this week's first day → silently dropped.
  // Simpler heuristic: insights.longestStreak >= 7 AND insights.streak === 0 AND item is not yet done today.
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

  // ── Signal 2: partial-day progress (≥1 done, < total) — celebrate the start ──────────
  const doneCount = todayItems.filter((i) => i.taken).length;
  const totalCount = todayItems.length;
  const goalsDone = goals.filter((g) => g.is_complete).length;
  const goalsTotal = goals.length;

  // ── Signal 3: it's a low-progress day late in the day — gentle nudge, not a guilt trip ──
  const now = new Date();
  const isLateInDay = now.getHours() >= 18;
  const lowProgressLate = isLateInDay
    && totalCount > 0
    && doneCount === 0
    && goalsDone === 0;

  // No signals to show → render nothing (don't clutter Home).
  if (recentlyPaused.length === 0 && doneCount === 0 && !lowProgressLate) return null;

  // Partial-progress celebration takes priority over pause-reminder (forward-looking).
  if (doneCount > 0 || goalsDone > 0) {
    const items = doneCount > 0 ? `${doneCount}/${totalCount} routine` : null;
    const g = goalsDone > 0 ? `${goalsDone}/${goalsTotal} goals` : null;
    const summary = [items, g].filter(Boolean).join(" · ");
    const tone = doneCount === totalCount && goalsDone === goalsTotal && (doneCount + goalsDone) > 0
      ? "Sir's day. Cleared."
      : doneCount + goalsDone >= 3
        ? "Solid traction."
        : "Started. That counts.";
    return (
      <Card>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
            <Sparkles size={10} /> Showed up
          </span>
          <span className="text-[10px] text-zinc-600 tabular-nums">{summary}</span>
        </div>
        <p className="text-sm text-zinc-200 font-medium">{tone}</p>
        {recentlyPaused.length > 0 && (
          <p className="text-[11px] text-zinc-500 mt-2">
            Pausing: {recentlyPaused.map((p) => `${p.name} (was ${p.lifetimeBest}d)`).join(", ")}. Restart tomorrow.
          </p>
        )}
      </Card>
    );
  }

  // Paused streaks → reframe (not failure, just a pause).
  if (recentlyPaused.length > 0) {
    return (
      <Card>
        <div className="flex items-center gap-1.5 mb-1.5">
          <Pause size={11} className="text-zinc-500" />
          <span className="text-[10px] uppercase tracking-widest text-zinc-500">Streaks paused</span>
        </div>
        <p className="text-sm text-zinc-200 font-medium">
          {recentlyPaused.length === 1
            ? `${recentlyPaused[0].name}: ${recentlyPaused[0].lifetimeBest}d run paused.`
            : `${recentlyPaused.length} streaks paused.`}
        </p>
        <p className="text-[11px] text-zinc-400 mt-1">
          Not broken — paused. Pick it back up tomorrow.
        </p>
      </Card>
    );
  }

  // Late-day, zero progress → gentle prompt.
  if (lowProgressLate) {
    return (
      <Card>
        <p className="text-sm text-zinc-200 font-medium">One thing before bed?</p>
        <p className="text-[11px] text-zinc-500 mt-1">
          Tap the &quot;Right now&quot; widget above. One item, one tap. End on a win.
        </p>
      </Card>
    );
  }

  return null;
}
