"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Unified hook for the 9 new dimension-tracking tables. Each table follows
// the same shape (id, user_id, log_date, logged_at, plus dimension-specific
// fields), so one hook can CRUD all of them via a `dimension` arg instead
// of nine separate hooks.

export type Dimension =
  | "focus_sessions" | "social_logs"   | "cardio_logs"
  | "libido_logs"    | "aesthetic_logs" | "caffeine_logs"
  | "sun_logs"       | "learning_logs"  | "money_logs";

export type DimensionRow = Record<string, unknown> & {
  id: string;
  user_id: string;
  log_date: string;
  logged_at: string;
};

// Returns today's rows for the given dimension + a logger. `lookbackDays`
// controls how much history to fetch (defaults to today only).
export function useDimensionLogs(dimension: Dimension, lookbackDays = 0) {
  const supabase = createClient();
  const [rows,    setRows]    = useState<DimensionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - lookbackDays);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const { data } = await supabase
      .from(dimension)
      .select("*")
      .eq("user_id", user.id)
      .gte("log_date", cutoffStr)
      .order("logged_at", { ascending: false });
    setRows((data ?? []) as DimensionRow[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimension, lookbackDays]);

  useEffect(() => { load(); }, [load]);

  const logEntry = useCallback(async (payload: Record<string, unknown>) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from(dimension)
      .insert({ user_id: userId, ...payload })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as DimensionRow;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dimension, load]);

  const deleteEntry = useCallback(async (id: string) => {
    if (!userId) return;
    await supabase.from(dimension).delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dimension, load]);

  return { rows, loading, logEntry, deleteEntry };
}
