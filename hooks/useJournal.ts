"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type JournalCategory = "personal" | "business";

export type JournalEntry = {
  id: string;
  content: string;
  ai_summary: string | null;
  category: JournalCategory;
  created_at: string;
};

export type LongTermGoal = {
  id: string;
  title: string;
  category: string;
  target_date: string | null;
  ai_action_plan: string | null;
  is_active: boolean;
  created_at: string;
};

export function useJournal(opts?: { entryCategory?: JournalCategory; goalCategories?: string[] }) {
  const supabase = createClient();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [longTermGoals, setLongTermGoals] = useState<LongTermGoal[]>([]);
  const [loading, setLoading] = useState(true);

  const entryCategory  = opts?.entryCategory;
  const goalCategories = opts?.goalCategories;

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let journalQuery = supabase.from("journal_entries")
      .select("id, content, ai_summary, category, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (entryCategory) journalQuery = journalQuery.eq("category", entryCategory);

    let goalsQuery = supabase.from("long_term_goals")
      .select("id, title, category, target_date, ai_action_plan, is_active, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (goalCategories && goalCategories.length > 0) goalsQuery = goalsQuery.in("category", goalCategories);

    const [journalRes, goalsRes] = await Promise.all([journalQuery, goalsQuery]);

    setEntries((journalRes.data ?? []) as JournalEntry[]);
    setLongTermGoals((goalsRes.data ?? []) as LongTermGoal[]);
    setLoading(false);
  }, [supabase, entryCategory, goalCategories]);

  const addEntry = useCallback(async (content: string, category: JournalCategory = "personal") => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .insert({ user_id: user.id, content, category })
      .select("id, content, ai_summary, category, created_at")
      .single();
    if (data) {
      // Only add to local state if it matches our category filter (or no filter)
      if (!entryCategory || (data as JournalEntry).category === entryCategory) {
        setEntries((prev) => [data as JournalEntry, ...prev]);
      }
      fetch("/api/overseer/parse-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, entryId: data.id }),
      }).then((r) => r.json()).then((json) => {
        if (json?.summary) {
          setEntries((prev) =>
            prev.map((e) => e.id === data.id ? { ...e, ai_summary: json.summary } : e)
          );
        }
      }).catch(() => {});
    }
  }, [supabase, entryCategory]);

  const addLongTermGoal = useCallback(async (
    title: string,
    category: string,
    targetDate?: string,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("long_term_goals")
      .insert({ user_id: user.id, title, category, target_date: targetDate ?? null })
      .select("id, title, category, target_date, ai_action_plan, is_active, created_at")
      .single();
    if (data) {
      setLongTermGoals((prev) => [data as LongTermGoal, ...prev]);
      fetch("/api/overseer/action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: data.id, title, category }),
      }).then((r) => r.json()).then((json) => {
        if (json?.plan) {
          setLongTermGoals((prev) =>
            prev.map((g) => g.id === data.id ? { ...g, ai_action_plan: json.plan } : g)
          );
        }
      }).catch(() => {});
    }
  }, [supabase]);

  const archiveGoal = useCallback(async (id: string) => {
    await supabase.from("long_term_goals").update({ is_active: false }).eq("id", id);
    setLongTermGoals((prev) => prev.filter((g) => g.id !== id));
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  return { entries, longTermGoals, loading, addEntry, addLongTermGoal, archiveGoal };
}
