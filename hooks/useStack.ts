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

export type StackCategory = "supplement" | "medication" | "injection" | "skincare";

export type StackItem = {
  id: string;
  name: string;
  dose: string;
  notes: string | null;
  timing: string;
  category: StackCategory;
  sort_order: number;
  taken: boolean;
  log_id: string | null;
};

export function useStack() {
  const [items,   setItems]   = useState<StackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(null);
  const supabase   = createClient();
  const channelRef = useRef(`stack-${Math.random().toString(36).slice(2)}`);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const today = getLogDate();

    const [stackRes, logsRes] = await Promise.all([
      supabase.from("supplement_stack").select("id, name, dose, notes, timing, sort_order, category").eq("user_id", user.id).eq("is_active", true).order("sort_order"),
      supabase.from("supplement_logs").select("id, supplement_id").eq("user_id", user.id).eq("log_date", today),
    ]);

    const logs = logsRes.data ?? [];
    const merged = (stackRes.data ?? []).map((s) => {
      const log = logs.find((l) => l.supplement_id === s.id);
      return { ...s, taken: !!log, log_id: log?.id ?? null };
    });
    setItems(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "supplement_logs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(async (supplementId: string, taken: boolean, logId: string | null) => {
    if (!userId) return;
    const today = getLogDate();

    // Optimistic flip in local state
    setItems((prev) => prev.map((item) =>
      item.id === supplementId
        ? { ...item, taken: !taken, log_id: !taken ? "optimistic" : null }
        : item
    ));

    try {
      if (taken && logId) {
        await supabase.from("supplement_logs").delete().eq("id", logId);
      } else {
        await supabase.from("supplement_logs").insert({
          user_id: userId, supplement_id: supplementId,
          log_date: today, taken_at: new Date().toISOString(),
        });
      }
      await load();
    } catch {
      // Roll back on error
      await load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addToStack = useCallback(async (name: string, dose: string, timing: string) => {
    if (!userId) return;
    const maxOrder = Math.max(0, ...items.map((i) => i.sort_order));
    await supabase.from("supplement_stack").insert({
      user_id: userId, name, dose, timing, sort_order: maxOrder + 1,
    });
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, items]);

  return { items, loading, toggle, addToStack };
}
