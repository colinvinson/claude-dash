"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type RevenueLog = {
  id:          string;
  business_id: string;
  amount:      number;
  log_date:    string;
  note:        string | null;
  created_at:  string;
};

// Per-business revenue history. Drives the MoM % surfaced in BusinessCard +
// the sparkline inside the detail sheet. Passing null/empty as businessId
// pauses the hook — used when the detail sheet is closed.
export function useBusinessRevenue(businessId: string | null) {
  const [logs, setLogs]       = useState<RevenueLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!businessId) { setLogs([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("business_revenue_log")
      .select("*")
      .eq("user_id",     user.id)
      .eq("business_id", businessId)
      .order("log_date", { ascending: true });
    setLogs(((data ?? []) as RevenueLog[]).map((r) => ({ ...r, amount: Number(r.amount) || 0 })));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId || !businessId) return;
    const ch = supabase
      .channel(`biz-rev:${businessId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "business_revenue_log", filter: `business_id=eq.${businessId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, load]);

  const logRevenue = useCallback(async (amount: number, note?: string) => {
    if (!userId || !businessId) return;
    await supabase.from("business_revenue_log").insert({
      user_id:     userId,
      business_id: businessId,
      amount,
      note:        note?.trim() || null,
    });
    // Also write through to the business's current MRR so the card stays
    // in sync without forcing the user to edit two places.
    await supabase.from("businesses").update({ monthly_revenue: amount }).eq("id", businessId);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, load]);

  const deleteRevenue = useCallback(async (id: string) => {
    await supabase.from("business_revenue_log").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  // MoM change vs ~30d ago. Returns null if there aren't two data points
  // at least 14 days apart.
  const momPct = useMemo(() => {
    if (logs.length < 2) return null;
    const latest = logs[logs.length - 1];
    const cutoff = new Date(latest.log_date); cutoff.setDate(cutoff.getDate() - 21);
    const prior  = [...logs].reverse().find((r) => new Date(r.log_date) <= cutoff);
    if (!prior || prior.amount <= 0) return null;
    return Math.round(((latest.amount - prior.amount) / prior.amount) * 100);
  }, [logs]);

  return {
    logs,
    loading,
    momPct,
    logRevenue,
    deleteRevenue,
  };
}
