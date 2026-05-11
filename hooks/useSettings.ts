"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type Profile = {
  full_name:      string | null;
  goal_weight_kg: number | null;
  training_goal:  string | null;
};

export function useSettings() {
  const supabase = createClient();
  const [profile,  setProfile]  = useState<Profile>({ full_name: null, goal_weight_kg: null, training_goal: null });
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [userId,   setUserId]   = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [profileRes, weightRes] = await Promise.all([
      supabase.from("profiles").select("full_name, goal_weight_kg, training_goal").eq("id", user.id).single(),
      supabase.from("weight_logs").select("weight_kg").eq("user_id", user.id).order("logged_at", { ascending: false }).limit(1),
    ]);

    if (profileRes.data) setProfile(profileRes.data as Profile);
    setLatestWeight((weightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const saveProfile = useCallback(async (patch: Partial<Profile>) => {
    if (!userId) return;
    await supabase.from("profiles").upsert({ id: userId, ...patch });
    await load();
  }, [userId, supabase, load]);

  const logWeight = useCallback(async (kg: number) => {
    if (!userId) return;
    await supabase.from("weight_logs").insert({ user_id: userId, weight_kg: kg });
    await load();
  }, [userId, supabase, load]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  return { profile, latestWeight, loading, saveProfile, logWeight, signOut };
}
