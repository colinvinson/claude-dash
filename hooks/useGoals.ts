"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function getLogDate() {
  const now = new Date();
  if (now.getHours() < 6) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

function getTomorrowDate() {
  const now = new Date();
  // If before 6am the "active today" is yesterday, so "tomorrow" is today's calendar date
  if (now.getHours() < 6) return now.toISOString().split("T")[0];
  const t = new Date(now);
  t.setDate(t.getDate() + 1);
  return t.toISOString().split("T")[0];
}

export type Goal = {
  id: string;
  title: string;
  is_complete: boolean;
  priority: number;
  pushed_from: string | null;
  created_at: string;
};

export function useGoals() {
  const [goals,         setGoals]         = useState<Goal[]>([]);
  const [tomorrowGoals, setTomorrowGoals] = useState<Goal[]>([]);
  const [streak,        setStreak]        = useState(0);
  const [loading,       setLoading]       = useState(true);
  const supabase   = createClient();
  const channelRef = useRef(`goals-${Math.random().toString(36).slice(2)}`);
  const today    = getLogDate();
  const tomorrow = getTomorrowDate();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [goalsRes, tmrRes, streakRes] = await Promise.all([
      supabase.from("goals").select("*").eq("user_id", user.id).eq("goal_date", today).order("created_at"),
      supabase.from("goals").select("*").eq("user_id", user.id).eq("goal_date", tomorrow).order("created_at"),
      supabase.from("goal_streaks").select("current_streak").eq("user_id", user.id).single(),
    ]);

    setGoals(goalsRes.data ?? []);
    setTomorrowGoals(tmrRes.data ?? []);
    setStreak(streakRes.data?.current_streak ?? 0);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "goals" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addGoal = useCallback(async (title: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("goals").insert({ user_id: user.id, title, goal_date: today });
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const addTomorrowGoal = useCallback(async (title: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("goals").insert({ user_id: user.id, title, goal_date: tomorrow });
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tomorrow]);

  const toggleGoal = useCallback(async (id: string, isComplete: boolean) => {
    await supabase.from("goals").update({
      is_complete: !isComplete,
      completed_at: !isComplete ? new Date().toISOString() : null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const deleteGoal = useCallback(async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushToTomorrow = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const incomplete = goals.filter((g) => !g.is_complete);
    await Promise.all(
      incomplete.map((g) =>
        supabase.from("goals").insert({
          user_id: user.id, title: g.title, goal_date: tomorrow,
          priority: g.priority, pushed_from: today,
        }).then(() => supabase.from("goals").delete().eq("id", g.id))
      )
    );
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, today, tomorrow]);

  return {
    goals, tomorrowGoals, streak, loading,
    addGoal, addTomorrowGoal, toggleGoal, deleteGoal, pushToTomorrow,
  };
}
