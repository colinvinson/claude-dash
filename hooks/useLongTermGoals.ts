"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GoalBucket = "personal" | "business";

// Goal types — drives the widget rendering + how progress is computed.
//   - quantitative: tracks a number (T level, body fat %, MRR, etc.)
//   - behavioral:   tracks consistency of linked routines
//   - project:      tracks milestone completion
//   - aesthetic:    soft target, mostly milestone-driven
export type GoalType = "quantitative" | "behavioral" | "project" | "aesthetic";

export type LongTermGoal = {
  id:                     string;
  user_id:                string;
  title:                  string;
  category:               string | null;
  target_date:            string | null;
  ai_action_plan:         string | null;
  bucket:                 GoalBucket;
  current_state:          string | null;
  next_steps:             string | null;
  metrics:                Record<string, unknown> | null;
  sort_order:             number;
  ai_summary:             string | null;
  ai_summary_updated_at:  string | null;
  is_active:              boolean;
  created_at:             string;
  // New (migration 0023)
  goal_type:              GoalType;
  target_value:           number | null;
  starting_value:         number | null;
  metric_unit:            string | null;
  is_focus:               boolean;
};

export type AddGoalArgs = {
  title:          string;
  bucket:         GoalBucket;
  category?:      string;
  target_date?:   string;
  goal_type?:     GoalType;
  target_value?:  number | null;
  starting_value?: number | null;
  metric_unit?:   string | null;
};

export function useLongTermGoals(bucket?: GoalBucket) {
  const [goals, setGoals]     = useState<LongTermGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // SELECT * so unapplied migrations (e.g. 0023's new columns) don't
    // crash the query. Defaults filled in at the merge step below.
    let q = supabase
      .from("long_term_goals")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true);
    if (bucket) q = q.eq("bucket", bucket);
    const { data } = await q.order("sort_order").order("created_at", { ascending: false });
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map((g) => ({
      ...g,
      goal_type:      (g.goal_type as GoalType | undefined)     ?? "project",
      target_value:   (g.target_value as number | null | undefined)   ?? null,
      starting_value: (g.starting_value as number | null | undefined) ?? null,
      metric_unit:    (g.metric_unit as string | null | undefined)    ?? null,
      is_focus:       (g.is_focus as boolean | undefined)             ?? false,
    })) as LongTermGoal[];
    setGoals(rows);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bucket]);

  useEffect(() => { load(); }, [load]);

  const addGoal = useCallback(async (args: AddGoalArgs): Promise<LongTermGoal | null> => {
    if (!userId || !args.title.trim()) return null;
    const { data, error } = await supabase
      .from("long_term_goals")
      .insert({
        user_id:        userId,
        title:          args.title.trim(),
        bucket:         args.bucket,
        category:       args.category?.trim() || null,
        target_date:    args.target_date || null,
        goal_type:      args.goal_type ?? "project",
        target_value:   args.target_value ?? null,
        starting_value: args.starting_value ?? null,
        metric_unit:    args.metric_unit?.trim() || null,
        is_active:      true,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    // No auto-AI plan. Sir writes his own plan; opt-in suggestion via
    // `suggestPlan(id)` if he wants Jarvis to draft something.
    return data as LongTermGoal;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  const updateGoal = useCallback(async (
    id: string,
    patch: Partial<Pick<LongTermGoal,
      | "title" | "bucket" | "category" | "target_date" | "current_state"
      | "next_steps" | "metrics" | "sort_order" | "ai_action_plan"
      | "goal_type" | "target_value" | "starting_value" | "metric_unit" | "is_focus"
    >>,
  ) => {
    await supabase.from("long_term_goals").update(patch).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Toggle focus flag — drives which goals surface on the Home dashboard.
  const toggleFocus = useCallback(async (id: string) => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return;
    await supabase.from("long_term_goals").update({ is_focus: !goal.is_focus }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, load]);

  // Opt-in: ask Jarvis to draft a plan. Same Haiku call we used to fire on
  // goal creation, just no longer automatic. The drafted text writes
  // straight into ai_action_plan; Sir can then edit it like any plan.
  const suggestPlan = useCallback(async (id: string): Promise<string | null> => {
    const goal = goals.find((g) => g.id === id);
    if (!goal) return null;
    const res = await fetch("/api/jarvis/action-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId: id, title: goal.title, category: goal.category }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { plan?: string };
    await load();
    return json.plan ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, load]);

  const archiveGoal = useCallback(async (id: string) => {
    await supabase.from("long_term_goals").update({ is_active: false }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Link a routine item (supplement_stack row) to this goal.
  const linkItem = useCallback(async (itemId: string, goalId: string | null) => {
    await supabase.from("supplement_stack").update({ linked_goal_id: goalId }).eq("id", itemId);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Server-side Haiku call to refresh this goal's summary. 1-hour cooldown
  // unless `force` is set — server enforces, but we also gate UI to avoid spam.
  const refreshAiSummary = useCallback(async (id: string, force = false): Promise<string | null> => {
    const res = await fetch(`/api/jarvis/goal-summary${force ? "?force=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goalId: id }),
    });
    if (!res.ok) return null;
    const json = await res.json() as { summary?: string };
    await load();
    return json.summary ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return {
    goals, loading,
    addGoal, updateGoal, archiveGoal,
    linkItem, refreshAiSummary, suggestPlan,
    toggleFocus,
  };
}
