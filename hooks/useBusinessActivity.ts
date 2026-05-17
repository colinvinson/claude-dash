"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export type ActivityKind = "revenue" | "agent_run" | "artifact" | "task_done";

export type ActivityEntry = {
  id:       string;       // unique enough across sources
  kind:     ActivityKind;
  title:    string;
  subtitle?: string;
  at:       string;       // ISO timestamp
};

// Per-business activity feed. Derived from existing tables — no new
// schema needed. Pulls revenue logs, agent runs, business-tagged
// artifacts, and completed tasks; merges by timestamp desc.
export function useBusinessActivity(businessId: string | null, limit = 20) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!businessId) { setEntries([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [revRes, agentRes, artRes, taskRes] = await Promise.all([
      supabase.from("business_revenue_log").select("id, amount, log_date, note, created_at").eq("user_id", user.id).eq("business_id", businessId).order("created_at", { ascending: false }).limit(limit),
      supabase.from("business_agents").select("id, role_label, last_run_at").eq("user_id", user.id).eq("business_id", businessId).not("last_run_at", "is", null).order("last_run_at", { ascending: false }).limit(limit),
      supabase.from("jarvis_artifacts").select("id, name, created_at").eq("user_id", user.id).eq("business_id", businessId).order("created_at", { ascending: false }).limit(limit),
      supabase.from("business_tasks").select("id, title, completed_at").eq("user_id", user.id).eq("business_id", businessId).eq("is_complete", true).not("completed_at", "is", null).order("completed_at", { ascending: false }).limit(limit),
    ]);

    const merged: ActivityEntry[] = [];

    for (const r of (revRes.data ?? []) as Array<{ id: string; amount: number; log_date: string; note: string | null; created_at: string }>) {
      merged.push({
        id:       `rev:${r.id}`,
        kind:     "revenue",
        title:    `Logged $${Math.round(Number(r.amount))}/mo`,
        subtitle: r.note ?? undefined,
        at:       r.created_at,
      });
    }
    for (const a of (agentRes.data ?? []) as Array<{ id: string; role_label: string; last_run_at: string }>) {
      merged.push({
        id:    `agent:${a.id}:${a.last_run_at}`,
        kind:  "agent_run",
        title: `Dispatched ${a.role_label}`,
        at:    a.last_run_at,
      });
    }
    for (const a of (artRes.data ?? []) as Array<{ id: string; name: string; created_at: string }>) {
      merged.push({
        id:    `art:${a.id}`,
        kind:  "artifact",
        title: a.name,
        at:    a.created_at,
      });
    }
    for (const t of (taskRes.data ?? []) as Array<{ id: string; title: string; completed_at: string }>) {
      merged.push({
        id:    `task:${t.id}`,
        kind:  "task_done",
        title: t.title,
        at:    t.completed_at,
      });
    }

    merged.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
    setEntries(merged.slice(0, limit));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, limit]);

  useEffect(() => { load(); }, [load]);

  // Realtime across all four sources — any insert/update should re-pull.
  // Each call to the helper gets its own useId-stable channel so they
  // don't collide with each other or with other components.
  const enabled = !!userId && !!businessId;
  const filter  = businessId ? `business_id=eq.${businessId}` : undefined;
  const base    = businessId ? `biz-activity:${businessId}` : "";
  useRealtimeSubscription({ channelBase: base, table: "business_revenue_log", filter, enabled, onChange: load });
  useRealtimeSubscription({ channelBase: base, table: "business_agents",      filter, enabled, onChange: load });
  useRealtimeSubscription({ channelBase: base, table: "jarvis_artifacts",     filter, enabled, onChange: load });
  useRealtimeSubscription({ channelBase: base, table: "business_tasks",       filter, enabled, onChange: load });

  return { entries, loading };
}
