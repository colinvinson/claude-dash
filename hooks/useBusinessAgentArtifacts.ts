"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export type BusinessArtifact = {
  id:                string;
  name:              string;
  type:              string;
  content:           string;
  created_at:        string;
  business_id:       string | null;
  business_agent_id: string | null;
};

// Per-business artifact feed. Returns the most recent ~30 artifacts tagged
// to this business, plus a helper to look up the LATEST artifact per
// business_agent_id (what the BusinessAgents UI surfaces inline). Passing
// null pauses the hook — used when the detail sheet is closed.
export function useBusinessAgentArtifacts(businessId: string | null) {
  const [artifacts, setArtifacts] = useState<BusinessArtifact[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userId, setUserId]       = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!businessId) { setArtifacts([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("jarvis_artifacts")
      .select("id, name, type, content, created_at, business_id, business_agent_id")
      .eq("user_id",     user.id)
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(30);
    setArtifacts((data ?? []) as BusinessArtifact[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  useRealtimeSubscription({
    channelBase: businessId ? `biz-artifacts:${businessId}` : "",
    table:       "jarvis_artifacts",
    filter:      businessId ? `business_id=eq.${businessId}` : undefined,
    enabled:     !!userId && !!businessId,
    onChange:    load,
  });

  // Latest artifact per business_agent_id. Used by the BusinessAgents UI
  // to show one inline preview per role.
  const latestByAgent = new Map<string, BusinessArtifact>();
  for (const a of artifacts) {
    if (a.business_agent_id && !latestByAgent.has(a.business_agent_id)) {
      latestByAgent.set(a.business_agent_id, a);
    }
  }

  return { artifacts, loading, latestByAgent };
}
