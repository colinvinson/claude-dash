"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import type { ScheduleKind } from "@/lib/businesses/schedule";
import { nextRunAfter } from "@/lib/businesses/schedule";

export type BusinessAgent = {
  id:              string;
  business_id:     string;
  agent_name:      string | null;
  role_label:      string;
  purpose:         string | null;
  last_run_at:     string | null;
  last_session_id: string | null;
  created_at:      string;
  // 0031 schedule fields
  schedule_kind:   ScheduleKind;
  schedule_hour:   number | null;
  schedule_dow:    number | null;
  schedule_dom:    number | null;
  next_run_at:     string | null;
};

export type AssignAgentArgs = {
  agent_name?: string;     // existing .claude/agents/<name>.md or null for pending-define
  role_label:  string;
  purpose?:    string;
};

export type ScheduleArgs = {
  kind:  ScheduleKind;
  hour?: number;
  dow?:  number;
  dom?:  number;
};

// Per-business agent workforce. Passing null/empty pauses the hook —
// used when the detail sheet is closed.
export function useBusinessAgents(businessId: string | null) {
  const [agents, setAgents]   = useState<BusinessAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!businessId) { setAgents([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("business_agents")
      .select("*")
      .eq("user_id",     user.id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: true });
    // Backfill schedule fields with defaults for rows from before
    // migration 0031 (so the UI doesn't have to null-check every place).
    setAgents(((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
      ...a,
      schedule_kind: (a.schedule_kind as ScheduleKind | undefined) ?? "none",
      schedule_hour: (a.schedule_hour as number | null | undefined) ?? null,
      schedule_dow:  (a.schedule_dow  as number | null | undefined) ?? null,
      schedule_dom:  (a.schedule_dom  as number | null | undefined) ?? null,
      next_run_at:   (a.next_run_at   as string | null | undefined) ?? null,
    })) as BusinessAgent[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId || !businessId) return;
    const ch = supabase
      .channel(`biz-agents:${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_agents", filter: `business_id=eq.${businessId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, load]);

  const assignAgent = useCallback(async (args: AssignAgentArgs): Promise<BusinessAgent | null> => {
    if (!userId || !businessId || !args.role_label.trim()) return null;
    const { data, error } = await supabase
      .from("business_agents")
      .insert({
        user_id:     userId,
        business_id: businessId,
        agent_name:  args.agent_name?.trim() || null,
        role_label:  args.role_label.trim(),
        purpose:     args.purpose?.trim()   || null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as BusinessAgent;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, load]);

  const removeAgent = useCallback(async (id: string) => {
    await supabase.from("business_agents").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const markRun = useCallback(async (id: string, sessionId?: string) => {
    await supabase.from("business_agents").update({
      last_run_at:     new Date().toISOString(),
      last_session_id: sessionId ?? null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // Set or clear the schedule. Computes next_run_at server-side from the
  // pure helper so the cron route can pick it up immediately.
  const setSchedule = useCallback(async (id: string, args: ScheduleArgs) => {
    const next = nextRunAfter({
      kind: args.kind,
      hour: args.hour,
      dow:  args.dow,
      dom:  args.dom,
    });
    await supabase.from("business_agents").update({
      schedule_kind: args.kind,
      schedule_hour: args.hour ?? null,
      schedule_dow:  args.dow  ?? null,
      schedule_dom:  args.dom  ?? null,
      next_run_at:   next?.toISOString() ?? null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { agents, loading, assignAgent, removeAgent, markRun, setSchedule };
}
