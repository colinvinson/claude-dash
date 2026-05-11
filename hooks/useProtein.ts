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

export type ProteinSource = "manual" | "photo" | "barcode";

export type ProteinLog = {
  id: string;
  log_date: string;
  protein_g: number;
  food_name: string | null;
  source: ProteinSource;
  ai_score: number | null;
  ai_reasoning: string | null;
  barcode: string | null;
  logged_at: string;
};

export type ProteinLogInput = {
  protein_g: number;
  food_name?: string | null;
  source: ProteinSource;
  ai_score?: number | null;
  ai_reasoning?: string | null;
  barcode?: string | null;
};

const DEFAULT_TARGET = 150;
const MULTIPLIER = 2.0;

export function useProtein() {
  const supabase = createClient();
  const [logs,    setLogs]    = useState<ProteinLog[]>([]);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(null);
  const channelRef = useRef(`protein-${Math.random().toString(36).slice(2)}`);

  const today = getLogDate();

  const fetchAll = useCallback(async (uid: string) => {
    const [logsRes, weightRes] = await Promise.all([
      supabase.from("protein_logs").select("*").eq("user_id", uid).eq("log_date", today).order("logged_at", { ascending: false }),
      supabase.from("weight_logs").select("weight_kg").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1),
    ]);
    setLogs((logsRes.data ?? []) as ProteinLog[]);
    const w = (weightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null;
    setWeightKg(w);
  }, [supabase, today]);

  useEffect(() => {
    let uid = "";
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      uid = user.id;
      setUserId(uid);
      await fetchAll(uid);
      setLoading(false);
    }
    init();

    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "protein_logs" }, () => {
        if (uid) fetchAll(uid);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalToday  = logs.reduce((sum, l) => sum + Number(l.protein_g), 0);
  const target      = weightKg ? Math.round(weightKg * MULTIPLIER) : DEFAULT_TARGET;
  const pctOfTarget = target > 0 ? Math.round((totalToday / target) * 100) : 0;

  const logProtein = useCallback(async (input: ProteinLogInput) => {
    if (!userId) return;
    await supabase.from("protein_logs").insert({
      user_id:      userId,
      log_date:     today,
      protein_g:    input.protein_g,
      food_name:    input.food_name ?? null,
      source:       input.source,
      ai_score:     input.ai_score ?? null,
      ai_reasoning: input.ai_reasoning ?? null,
      barcode:      input.barcode ?? null,
    });
    await fetchAll(userId);
  }, [userId, today, supabase, fetchAll]);

  const deleteProtein = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from("protein_logs").delete().eq("id", id);
    await fetchAll(userId);
  }, [userId, supabase, fetchAll]);

  return {
    logs, totalToday, target, pctOfTarget, weightKg, loading,
    logProtein, deleteProtein,
  };
}
