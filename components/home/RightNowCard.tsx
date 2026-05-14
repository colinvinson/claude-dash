"use client";

import { useMemo, useState } from "react";
import { Check, SkipForward, Sparkles } from "lucide-react";
import { useStack, type StackItem } from "@/hooks/useStack";
import { useGoals, type Goal } from "@/hooks/useGoals";
import Card from "@/components/ui/Card";

// "Right Now" widget. ADHD-optimized: ONE action surfaced, single tap to
// complete, single tap to skip to the next ranked item. Zero decision fatigue.
//
// Ranking (highest priority first):
//   1. Overdue scheduled routine items (scheduled time has passed by >5 min)
//   2. Imminent scheduled routine items (within +60 min)
//   3. Highest-priority incomplete goal for today
//   4. Untimed routine items (Anytime today)
//   5. Lower-priority incomplete goals
//   6. Nothing → empty state ("All caught up.")

type Item =
  | { kind: "stack"; item: StackItem; reason: string; urgency: number }
  | { kind: "goal";  goal: Goal;       reason: string; urgency: number };

// JS DOW indices: Sunday=0..Saturday=6
function isScheduledToday(item: StackItem, todayDow: number): boolean {
  if (!item.days_of_week || item.days_of_week.length === 0 || item.days_of_week.length === 7) return true;
  return item.days_of_week.includes(todayDow);
}

// Convert "HH:MM" or "HH:MM:SS" to minutes-since-midnight, or null.
function timeToMinutes(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Bucket fallback for items with no scheduled_at but a `timing` string.
const BUCKET_TIME: Record<string, number> = {
  "pre-workout":  6 * 60 + 30,
  "morning":      7 * 60,
  "lunch":       12 * 60,
  "afternoon":   15 * 60,
  "evening":     19 * 60,
  "pre-bed":     22 * 60,
  "bedtime":     22 * 60 + 30,
};

function effectiveTimeMinutes(item: StackItem): number | null {
  const direct = timeToMinutes(item.scheduled_at);
  if (direct != null) return direct;
  const key = (item.timing ?? "").trim().toLowerCase();
  return BUCKET_TIME[key] ?? null;
}

function formatRelativeTime(targetMin: number, nowMin: number): string {
  const diff = targetMin - nowMin;
  if (diff < -60)  return `${Math.round(-diff / 60)}h overdue`;
  if (diff < -1)   return `${-diff} min overdue`;
  if (diff <= 1)   return "now";
  if (diff < 60)   return `in ${diff} min`;
  return `in ${Math.round(diff / 60)}h`;
}

export default function RightNowCard() {
  const { items, toggle } = useStack();
  const { goals, toggleGoal } = useGoals();
  const [skipCursor, setSkipCursor] = useState(0);

  const ranked = useMemo<Item[]>(() => {
    const now = new Date();
    const todayDow = now.getDay();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const stackCandidates: Item[] = items
      .filter((i) => !i.taken && isScheduledToday(i, todayDow))
      .map((i) => {
        const t = effectiveTimeMinutes(i);
        if (t == null) {
          // Untimed — render in the "Anytime" tier
          return { kind: "stack" as const, item: i, reason: "Anytime today", urgency: 50 };
        }
        const diff = nowMin - t; // positive = overdue
        if (diff > 5) {
          return {
            kind: "stack" as const,
            item: i,
            reason: `${formatRelativeTime(t, nowMin)} · scheduled ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`,
            urgency: 100 + Math.min(50, diff / 2), // older = more urgent, capped
          };
        }
        if (diff > -60) {
          return {
            kind: "stack" as const,
            item: i,
            reason: `Up ${formatRelativeTime(t, nowMin)}`,
            urgency: 90 - Math.abs(diff), // sooner = more urgent
          };
        }
        // Far future today
        return {
          kind: "stack" as const,
          item: i,
          reason: `Later today · ${Math.floor(t/60)}:${String(t%60).padStart(2,'0')}`,
          urgency: 30,
        };
      });

    const goalCandidates: Item[] = goals
      .filter((g) => !g.is_complete)
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
      .map((g, idx) => ({
        kind: "goal" as const,
        goal: g,
        reason: idx === 0 ? "Top priority today" : `Priority ${g.priority ?? "—"}`,
        urgency: idx === 0 ? 85 : 60 - idx * 2,
      }));

    return [...stackCandidates, ...goalCandidates].sort((a, b) => b.urgency - a.urgency);
  }, [items, goals]);

  // Cursor lets the user "skip" through ranked items without losing place.
  // Reset to 0 whenever the underlying list shrinks (item completed).
  const current = ranked[skipCursor % Math.max(1, ranked.length)] ?? null;

  if (!current || ranked.length === 0) {
    return (
      <Card>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2 block">— Right now</span>
        <p className="text-sm text-zinc-300 font-medium">All caught up. Take a breath.</p>
        <p className="text-[11px] text-zinc-500 mt-1">Nothing pressing in your schedule.</p>
      </Card>
    );
  }

  async function markDone() {
    if (current!.kind === "stack") {
      await toggle(current!.item.id, current!.item.taken, current!.item.log_id);
    } else {
      await toggleGoal(current!.goal.id, true);
    }
    setSkipCursor(0); // jump to top of the list (will reflect new state after re-render)
  }

  function skipNext() {
    setSkipCursor((c) => c + 1);
  }

  const title = current.kind === "stack" ? current.item.name : current.goal.title;
  const dose  = current.kind === "stack" ? current.item.dose : null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
          <Sparkles size={10} /> Right now
        </span>
        <span className="text-[10px] text-zinc-600">
          {skipCursor > 0 ? `${skipCursor + 1}/${ranked.length}` : `${ranked.length} pending`}
        </span>
      </div>
      <div className="mb-3">
        <p className="text-xl font-bold text-zinc-100 leading-tight">{title}</p>
        {dose && <p className="text-xs text-zinc-500 mt-0.5">{dose}</p>}
        <p className="text-[11px] text-zinc-400 mt-1">{current.reason}</p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={markDone}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-sm font-semibold transition-colors"
        >
          <Check size={14} strokeWidth={3} /> Done
        </button>
        {ranked.length > 1 && (
          <button
            onClick={skipNext}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-medium transition-colors"
          >
            <SkipForward size={14} /> Skip
          </button>
        )}
      </div>
    </Card>
  );
}
