"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type GoalMilestone = {
  id:           string;
  user_id:      string;
  goal_id:      string;
  title:        string;
  target_date:  string | null;
  target_value: number | null;
  is_complete:  boolean;
  completed_at: string | null;
  sort_order:   number;
  created_at:   string;
};

export function useGoalMilestones(goalId: string | null) {
  const supabase = createClient();
  const [milestones, setMilestones] = useState<GoalMilestone[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userId, setUserId]         = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    if (!goalId) { setMilestones([]); setLoading(false); return; }
    const { data } = await supabase
      .from("goal_milestones")
      .select("*")
      .eq("goal_id", goalId)
      .order("sort_order")
      .order("target_date", { ascending: true, nullsFirst: false });
    setMilestones((data ?? []) as GoalMilestone[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  useEffect(() => { load(); }, [load]);

  const addMilestone = useCallback(async (args: {
    title:        string;
    target_date?: string | null;
    target_value?: number | null;
  }) => {
    if (!userId || !goalId || !args.title.trim()) return null;
    const maxSort = Math.max(0, ...milestones.map((m) => m.sort_order));
    const { data, error } = await supabase
      .from("goal_milestones")
      .insert({
        user_id:      userId,
        goal_id:      goalId,
        title:        args.title.trim(),
        target_date:  args.target_date ?? null,
        target_value: args.target_value ?? null,
        sort_order:   maxSort + 1,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as GoalMilestone;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, goalId, milestones, load]);

  const toggleComplete = useCallback(async (id: string) => {
    const m = milestones.find((x) => x.id === id);
    if (!m) return;
    const willBeComplete = !m.is_complete;
    await supabase.from("goal_milestones").update({
      is_complete:  willBeComplete,
      completed_at: willBeComplete ? new Date().toISOString() : null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestones, load]);

  const deleteMilestone = useCallback(async (id: string) => {
    await supabase.from("goal_milestones").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { milestones, loading, addMilestone, toggleComplete, deleteMilestone };
}
