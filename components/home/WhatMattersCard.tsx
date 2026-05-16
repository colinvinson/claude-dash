"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Target, Sparkles, Zap, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import CompletionToggle from "@/components/ui/CompletionToggle";
import { useGoals } from "@/hooks/useGoals";
import { useLongTermGoals } from "@/hooks/useLongTermGoals";
import { useStack, type StackItem } from "@/hooks/useStack";
import { createClient } from "@/lib/supabase/client";
import { PALETTE, TYPE } from "@/lib/design-tokens";

// "What matters" — composite. Three sections, in order of importance for an
// ADHD brain trying to take action:
//
//   1. RIGHT NOW   — single most-urgent action (next overdue stack item OR
//                    next imminent scheduled item OR top incomplete daily
//                    goal). One tap to complete, one tap to skip. Zero
//                    decision fatigue.
//   2. FOCUS GOAL  — top-starred long-term goal (where Sir's actually
//                    heading). Tap to open Life/Businesses.
//   3. INSIGHT     — most recent undismissed jarvis_insight.
//
// Replaces RightNowCard + LongTermGoalsCard + PriorityFocusCard +
// DailyInsightStrip with a single coherent surface.

type Insight = { id: string; kind: string; body: string };

const BUCKET_TIME: Record<string, number> = {
  "pre-workout": 6 * 60 + 30,
  "morning":     7 * 60,
  "lunch":       12 * 60,
  "afternoon":   15 * 60,
  "evening":     19 * 60,
  "pre-bed":     22 * 60,
  "bedtime":     22 * 60 + 30,
};

function timeToMin(t: string | null | undefined): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function effectiveTimeMin(item: StackItem): number | null {
  const direct = timeToMin(item.scheduled_at);
  if (direct != null) return direct;
  const key = (item.timing ?? "").toLowerCase();
  return BUCKET_TIME[key] ?? null;
}

function pickRightNowStack(items: StackItem[], skipped: Set<string>): StackItem | null {
  const todayDow = new Date().getDay();
  const todayItems = items
    .filter((i) => !skipped.has(i.id) && !i.taken)
    .filter((i) => {
      if (!i.days_of_week || i.days_of_week.length === 0 || i.days_of_week.length === 7) return true;
      return i.days_of_week.includes(todayDow);
    });
  if (todayItems.length === 0) return null;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  // 1. Overdue scheduled items (past time by 5+ min)
  const overdue = todayItems.filter((i) => {
    const t = effectiveTimeMin(i);
    return t != null && t < nowMin - 5;
  }).sort((a, b) => (effectiveTimeMin(a)! - effectiveTimeMin(b)!));
  if (overdue.length > 0) return overdue[0];
  // 2. Imminent (within next 60 min)
  const imminent = todayItems.filter((i) => {
    const t = effectiveTimeMin(i);
    return t != null && t >= nowMin - 5 && t <= nowMin + 60;
  }).sort((a, b) => (effectiveTimeMin(a)! - effectiveTimeMin(b)!));
  if (imminent.length > 0) return imminent[0];
  // 3. Untimed (no scheduled_at, no recognized bucket → "Anytime today")
  const anytime = todayItems.filter((i) => effectiveTimeMin(i) == null);
  if (anytime.length > 0) return anytime[0];
  // 4. Otherwise: next future scheduled
  const future = todayItems.filter((i) => {
    const t = effectiveTimeMin(i);
    return t != null && t > nowMin + 60;
  }).sort((a, b) => (effectiveTimeMin(a)! - effectiveTimeMin(b)!));
  return future[0] ?? null;
}

export default function WhatMattersCard() {
  const { goals: dailyGoals, toggleGoal } = useGoals();
  const { goals: ltGoals } = useLongTermGoals();
  const { items: stackItems, toggle: toggleStack } = useStack();
  const [insight, setInsight] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Fire detectors in the background (server-gated). WhatMatters is
      // the trigger surface for these now that DailyInsightStrip is gone.
      void fetch("/api/jarvis/daily-insights", { method: "POST" }).catch(() => {});
      void fetch("/api/jarvis/correlations",    { method: "POST" }).catch(() => {});

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (!cancelled) setLoading(false); return; }

      const wkAgo = new Date(); wkAgo.setDate(wkAgo.getDate() - 7);
      const { data } = await supabase
        .from("jarvis_insights")
        .select("id, kind, body, severity, triggered_at")
        .eq("user_id", user.id)
        .gte("triggered_at", wkAgo.toISOString())
        .is("dismissed_at", null)
        .order("triggered_at", { ascending: false })
        .limit(1);
      if (!cancelled) {
        setInsight(((data ?? [])[0] as Insight) ?? null);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // RIGHT NOW priority: stack item > top daily goal
  const stackPick = useMemo(() => pickRightNowStack(stackItems, skipped), [stackItems, skipped]);
  const topGoal = dailyGoals.find((g) => !g.is_complete) ?? null;
  const rightNowAction = stackPick
    ? { kind: "stack" as const, item: stackPick }
    : topGoal
      ? { kind: "goal" as const, goal: topGoal }
      : null;

  const focusGoal = ltGoals.find((g) => g.is_focus) ?? ltGoals[0] ?? null;

  if (loading) return null;

  // Nothing to surface at all — skip rendering. WelcomeCard handles
  // truly-first-time empty state.
  if (!rightNowAction && !focusGoal && !insight) return null;

  async function dismissInsight() {
    if (!insight) return;
    setInsight(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("jarvis_insights").update({ dismissed_at: new Date().toISOString() }).eq("id", insight.id);
  }

  return (
    <Card>
      <span className={`${TYPE.label} block mb-3`}>— What matters</span>

      {/* ── RIGHT NOW — single most-urgent action ── */}
      {rightNowAction && (
        <div className="mb-4 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={11} style={{ color: PALETTE.info }} />
            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: PALETTE.info }}>
              Right now
            </span>
          </div>
          <div className="flex items-center gap-3">
            {rightNowAction.kind === "stack" ? (
              <>
                <CompletionToggle
                  done={false}
                  onToggle={() => toggleStack(rightNowAction.item.id, rightNowAction.item.taken, rightNowAction.item.log_id)}
                  mode="small"
                  celebrate
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{rightNowAction.item.name}</p>
                  {rightNowAction.item.dose && (
                    <p className="text-[11px] text-zinc-500 truncate">{rightNowAction.item.dose}</p>
                  )}
                </div>
                <button
                  onClick={() => setSkipped((prev) => new Set(prev).add(rightNowAction.item.id))}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300"
                >
                  Skip
                </button>
              </>
            ) : (
              <>
                <CompletionToggle
                  done={false}
                  onToggle={() => toggleGoal(rightNowAction.goal.id, true)}
                  mode="small"
                  celebrate
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-100 truncate">{rightNowAction.goal.title}</p>
                  <p className="text-[11px] text-zinc-500">today's goal</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── FOCUS — top long-term goal ── */}
      {focusGoal && (
        <div className="mb-4 pb-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 mb-1.5">
            <Target size={11} style={{ color: PALETTE.celebration }} />
            <span className="text-[9px] uppercase tracking-widest font-bold" style={{ color: PALETTE.celebration }}>
              Focus
            </span>
          </div>
          <Link
            href={focusGoal.bucket === "business" ? "/businesses" : "/life"}
            className="block group"
          >
            <p className="text-sm font-semibold text-zinc-100 group-hover:text-white truncate">
              {focusGoal.title}
            </p>
            {focusGoal.goal_type === "quantitative" && focusGoal.target_value != null && (
              <p className="text-[11px] text-zinc-500 tabular-nums">
                → {focusGoal.target_value}{focusGoal.metric_unit ? ` ${focusGoal.metric_unit}` : ""}
                {focusGoal.target_date && ` · ${focusGoal.target_date}`}
              </p>
            )}
            {focusGoal.current_state && (
              <p className="text-[11px] text-zinc-500 italic truncate">{focusGoal.current_state}</p>
            )}
          </Link>
        </div>
      )}

      {/* ── INSIGHT — latest Jarvis observation ── */}
      {insight && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Sparkles size={11} style={{ color: PALETTE.dim }} />
              <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">
                Insight
              </span>
            </div>
            <button
              onClick={dismissInsight}
              className="text-zinc-700 hover:text-zinc-400 text-[10px]"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="text-[12px] text-zinc-300 leading-relaxed">{insight.body}</p>
        </div>
      )}

      {!rightNowAction && (
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <Check size={13} style={{ color: PALETTE.success }} strokeWidth={3} />
          Nothing urgent. Caught up.
        </p>
      )}
    </Card>
  );
}
