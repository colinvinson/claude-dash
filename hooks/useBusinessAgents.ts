"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type BusinessAgent = {
  id:              string;
  business_id:     string;
  agent_name:      string | null;
  role_label:      string;
  purpose:         string | null;
  last_run_at:     string | null;
  last_session_id: string | null;
  created_at:      string;
};

export type AssignAgentArgs = {
  agent_name?: string;     // existing .claude/agents/<name>.md or null for pending-define
  role_label:  string;
  purpose?:    string;
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
    setAgents((data ?? []) as BusinessAgent[]);
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

  return { agents, loading, assignAgent, removeAgent, markRun };
}
