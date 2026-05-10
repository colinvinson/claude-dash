"use client";

import { useEffect, useState, useCallback } from "react";
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

export type FaithLog = {
  prayed: boolean;
  bible_min: number;
  church_attended: boolean;
};

export type LogState = {
  water: number;
  meditation: number;
  alcoholCount: number;
  faith: FaithLog;
  mood: number | null;
  weight: number | null;
};

const EMPTY_FAITH: FaithLog = { prayed: false, bible_min: 0, church_attended: false };

export function useLog() {
  const supabase = createClient();
  const today = getLogDate();

  const [state, setState] = useState<LogState>({
    water: 0,
    meditation: 0,
    alcoholCount: 0,
    faith: EMPTY_FAITH,
    mood: null,
    weight: null,
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [waterRes, medRes, alcoholRes, faithRes, moodRes, weightRes] = await Promise.all([
      supabase.from("water_logs").select("glasses").eq("user_id", user.id).eq("log_date", today).single(),
      supabase.from("meditation_logs").select("duration_min").eq("user_id", user.id).eq("log_date", today),
      supabase.from("alcohol_logs").select("drink_count").eq("user_id", user.id).eq("log_date", today),
      supabase.from("faith_logs").select("prayed, bible_min, church_attended").eq("user_id", user.id).eq("log_date", today).single(),
      supabase.from("mood_logs").select("score").eq("user_id", user.id).eq("log_date", today).order("logged_at", { ascending: false }).limit(1),
      supabase.from("weight_logs").select("weight_kg").eq("user_id", user.id).order("logged_at", { ascending: false }).limit(1),
    ]);

    setState({
      water: waterRes.data?.glasses ?? 0,
      meditation: (medRes.data ?? []).reduce((s: number, r: { duration_min: number }) => s + r.duration_min, 0),
      alcoholCount: (alcoholRes.data ?? []).reduce((s: number, r: { drink_count: number }) => s + r.drink_count, 0),
      faith: faithRes.data ?? EMPTY_FAITH,
      mood: moodRes.data?.[0]?.score ?? null,
      weight: weightRes.data?.[0]?.weight_kg ?? null,
    });
    setLoading(false);
  }, [supabase, today]);

  useEffect(() => { load(); }, [load]);

  const addWater = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const newGlasses = state.water + 1;
    await supabase.from("water_logs").upsert(
      { user_id: user.id, log_date: today, glasses: newGlasses, updated_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" }
    );
    setState((s) => ({ ...s, water: newGlasses }));
  }, [supabase, today, state.water]);

  const logMeditation = useCallback(async (durationMin: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("meditation_logs").insert({ user_id: user.id, log_date: today, duration_min: durationMin });
    setState((s) => ({ ...s, meditation: s.meditation + durationMin }));
  }, [supabase, today]);

  const logAlcohol = useCallback(async (drinkType: string, count: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("alcohol_logs").insert({ user_id: user.id, log_date: today, drink_type: drinkType, drink_count: count });
    setState((s) => ({ ...s, alcoholCount: s.alcoholCount + count }));
  }, [supabase, today]);

  const updateFaith = useCallback(async (patch: Partial<FaithLog>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updated = { ...state.faith, ...patch };
    await supabase.from("faith_logs").upsert(
      { user_id: user.id, log_date: today, ...updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id,log_date" }
    );
    setState((s) => ({ ...s, faith: updated }));
  }, [supabase, today, state.faith]);

  const logMood = useCallback(async (score: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("mood_logs").insert({ user_id: user.id, log_date: today, score });
    setState((s) => ({ ...s, mood: score }));
  }, [supabase, today]);

  const logWeight = useCallback(async (weightKg: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("weight_logs").insert({ user_id: user.id, weight_kg: weightKg });
    setState((s) => ({ ...s, weight: weightKg }));
  }, [supabase]);

  const brainDump = useCallback(async (text: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("journal_entries")
      .insert({ user_id: user.id, content: text })
      .select("id")
      .single();
    // Fire AI parse async
    if (data?.id) {
      fetch("/api/overseer/parse-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, entryId: data.id }),
      }).catch(() => {});
    }
  }, [supabase]);

  return { state, loading, addWater, logMeditation, logAlcohol, updateFaith, logMood, logWeight, brainDump };
}
