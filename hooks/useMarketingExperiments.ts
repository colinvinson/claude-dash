"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export type MarketingExperiment = {
  id:                 string;
  business_id:        string | null;
  variant_label:      string;
  variant_text:       string;
  channel:            string;
  posted_at:          string | null;
  link:               string | null;
  notes:              string | null;
  impressions:        number | null;
  clicks:             number | null;
  conversions:        number | null;
  revenue_attributed: number | null;
  archived_at:        string | null;
  created_at:         string;
};

export type AddExperimentArgs = {
  variant_label: string;
  variant_text:  string;
  channel:       string;
  posted_at?:    string | null;
  link?:         string | null;
};

export type ExperimentMetrics = {
  impressions?:        number | null;
  clicks?:             number | null;
  conversions?:        number | null;
  revenue_attributed?: number | null;
};

// Per-business marketing experiments. Pass null to pause the hook.
// (Pass undefined to fetch across ALL businesses — used for a future
// cross-business marketing dashboard.)
export function useMarketingExperiments(businessId: string | null | undefined) {
  const [experiments, setExperiments] = useState<MarketingExperiment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [userId, setUserId]           = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (businessId === null) { setExperiments([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    let q = supabase
      .from("marketing_experiments")
      .select("*")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("posted_at",  { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(50);
    if (businessId) q = q.eq("business_id", businessId);
    const { data } = await q;
    setExperiments(((data ?? []) as MarketingExperiment[]).map((e) => ({
      ...e,
      revenue_attributed: e.revenue_attributed != null ? Number(e.revenue_attributed) : null,
    })));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  useRealtimeSubscription({
    channelBase: userId ? `mkt-exp:${userId}:${businessId ?? "all"}` : "",
    table:       "marketing_experiments",
    filter:      userId ? `user_id=eq.${userId}` : undefined,
    enabled:     !!userId && businessId !== null,
    onChange:    load,
  });

  const addExperiment = useCallback(async (args: AddExperimentArgs): Promise<MarketingExperiment | null> => {
    if (!userId || !args.variant_text.trim() || !args.channel.trim()) return null;
    const { data, error } = await supabase
      .from("marketing_experiments")
      .insert({
        user_id:       userId,
        business_id:   businessId === undefined ? null : businessId,
        variant_label: args.variant_label.trim() || "Variant",
        variant_text:  args.variant_text.trim(),
        channel:       args.channel.trim().toLowerCase(),
        posted_at:     args.posted_at ?? null,
        link:          args.link ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as MarketingExperiment;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, load]);

  const updateMetrics = useCallback(async (id: string, m: ExperimentMetrics) => {
    await supabase.from("marketing_experiments").update({
      impressions:        m.impressions        ?? null,
      clicks:             m.clicks             ?? null,
      conversions:        m.conversions        ?? null,
      revenue_attributed: m.revenue_attributed ?? null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const markPosted = useCallback(async (id: string, link?: string) => {
    await supabase.from("marketing_experiments").update({
      posted_at: new Date().toISOString(),
      link:      link ?? null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const archiveExperiment = useCallback(async (id: string) => {
    await supabase.from("marketing_experiments").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { experiments, loading, addExperiment, updateMetrics, markPosted, archiveExperiment };
}

// Helper: compute conversion rate as a percentage (clicks→conversions
// or impressions→clicks depending on what's available). Returns null
// if not enough data.
export function conversionRate(e: MarketingExperiment): number | null {
  if (e.conversions != null && e.clicks != null && e.clicks > 0) {
    return Math.round((e.conversions / e.clicks) * 1000) / 10;  // CVR % with one decimal
  }
  if (e.clicks != null && e.impressions != null && e.impressions > 0) {
    return Math.round((e.clicks / e.impressions) * 1000) / 10;  // CTR % with one decimal
  }
  return null;
}
