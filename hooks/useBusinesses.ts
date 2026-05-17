"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type BusinessStatus = "idea" | "building" | "live" | "growing" | "paused";

export type Business = {
  id:              string;
  user_id:         string;
  name:            string;
  status:          BusinessStatus;
  category:        string | null;
  monthly_revenue: number;
  customer_count:  number;
  next_action:     string | null;
  notes:           string | null;
  started_at:      string | null;
  archived_at:     string | null;
  created_at:      string;
};

export type AddBusinessArgs = {
  name:     string;
  status?:  BusinessStatus;
  category?: string;
};

const STALE_THRESHOLD_MS = 7 * 24 * 3600 * 1000;

export function useBusinesses() {
  const [businesses, setBusinesses]     = useState<Business[]>([]);
  const [loading, setLoading]           = useState(true);
  const [userId, setUserId]             = useState<string | null>(null);
  const [staleIds, setStaleIds]         = useState<Set<string>>(new Set());
  // Top open task per business — drives the "Next" line on BusinessCard.
  // Falls back to legacy next_action only if no tasks exist.
  const [topTasks, setTopTasks]         = useState<Map<string, string>>(new Map());
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    // Each query wrapped in a per-table Promise.resolve so a missing
    // table (migration not applied yet) returns empty instead of
    // poisoning the whole load via Promise.all rejection. Defensive
    // against the deploy-ahead-of-migrations scenario.
    const safe = <T,>(p: PromiseLike<{ data: T[] | null }>) =>
      Promise.resolve(p).then((r) => r).catch(() => ({ data: [] as T[] }));

    const [bizRes, revRes, agentRes, doneTaskRes, openTaskRes] = await Promise.all([
      safe(supabase
        .from("businesses")
        .select("*")
        .eq("user_id", user.id)
        .is("archived_at", null)
        .order("monthly_revenue", { ascending: false })
        .order("created_at",      { ascending: false })),
      // Three sources feed the "is this stale" check — most recent of each
      // per business is enough.
      safe(supabase.from("business_revenue_log").select("business_id, log_date").eq("user_id", user.id).order("log_date", { ascending: false })),
      safe(supabase.from("business_agents").select("business_id, last_run_at").eq("user_id", user.id).not("last_run_at", "is", null)),
      safe(supabase.from("business_tasks").select("business_id, completed_at").eq("user_id", user.id).eq("is_complete", true).not("completed_at", "is", null)),
      // Open tasks — sorted same way the per-business hook sorts so the
      // first row per business is what the card should display.
      safe(supabase.from("business_tasks").select("business_id, title, priority, created_at").eq("user_id", user.id).eq("is_complete", false).order("priority", { ascending: false }).order("created_at", { ascending: true })),
    ]);

    const rows = ((bizRes.data ?? []) as Business[]).map((b) => ({
      ...b,
      monthly_revenue: Number(b.monthly_revenue) || 0,
      customer_count:  Number(b.customer_count)  || 0,
    }));

    // Compute "last activity" per business across all three sources.
    const lastByBiz = new Map<string, number>();
    function bump(bid: string, ts: number) {
      const prev = lastByBiz.get(bid);
      if (prev == null || prev < ts) lastByBiz.set(bid, ts);
    }
    for (const r of (revRes.data ?? []) as Array<{ business_id: string; log_date: string }>) {
      bump(r.business_id, new Date(r.log_date + "T00:00:00").getTime());
    }
    for (const r of (agentRes.data ?? []) as Array<{ business_id: string; last_run_at: string }>) {
      bump(r.business_id, new Date(r.last_run_at).getTime());
    }
    for (const r of (doneTaskRes.data ?? []) as Array<{ business_id: string; completed_at: string }>) {
      bump(r.business_id, new Date(r.completed_at).getTime());
    }

    // First open task per business (rows already pre-sorted).
    const topByBiz = new Map<string, string>();
    for (const r of (openTaskRes.data ?? []) as Array<{ business_id: string; title: string }>) {
      if (!topByBiz.has(r.business_id)) topByBiz.set(r.business_id, r.title);
    }
    setTopTasks(topByBiz);
    const now = Date.now();
    const stale = new Set<string>();
    for (const b of rows) {
      const last = lastByBiz.get(b.id);
      // Brand-new businesses (created in the last 7d, no activity yet) aren't
      // "stale" — they just haven't built history. Use created_at as fallback.
      const createdAt = new Date(b.created_at).getTime();
      const lastTs    = last ?? createdAt;
      if (now - lastTs > STALE_THRESHOLD_MS) stale.add(b.id);
    }

    setBusinesses(rows);
    setStaleIds(stale);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime — UI tiles update when revenue logged on another surface.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`businesses:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "businesses", filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  const addBusiness = useCallback(async (args: AddBusinessArgs): Promise<Business | null> => {
    if (!userId || !args.name.trim()) return null;
    const { data, error } = await supabase
      .from("businesses")
      .insert({
        user_id:  userId,
        name:     args.name.trim(),
        status:   args.status ?? "idea",
        category: args.category?.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as Business;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  const updateBusiness = useCallback(async (
    id: string,
    patch: Partial<Pick<Business, "name" | "status" | "category" | "monthly_revenue" | "customer_count" | "next_action" | "notes" | "started_at">>,
  ) => {
    await supabase.from("businesses").update(patch).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const archiveBusiness = useCallback(async (id: string) => {
    await supabase.from("businesses").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Aggregate snapshot — what the page-header hero needs.
  const totalMRR        = businesses.reduce((s, b) => s + b.monthly_revenue, 0);
  const totalCustomers  = businesses.reduce((s, b) => s + b.customer_count,  0);
  const liveCount       = businesses.filter((b) => b.status === "live" || b.status === "growing").length;

  return {
    businesses,
    loading,
    totalMRR,
    totalCustomers,
    liveCount,
    staleIds,
    topTasks,
    addBusiness,
    updateBusiness,
    archiveBusiness,
    reload: load,
  };
}
