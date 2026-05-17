"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export type NetWorthSnapshot = {
  id:              string;
  snapshot_date:   string;       // YYYY-MM-DD, typically 1st of month
  cash:            number;
  investments:     number;
  business_equity: number;
  debts:           number;
  notes:           string | null;
  created_at:      string;
};

export type SnapshotInput = {
  snapshot_date:    string;
  cash?:            number;
  investments?:     number;
  business_equity?: number;
  debts?:           number;
  notes?:           string | null;
};

// Monthly net worth snapshots. Sir reads the cash + investments numbers
// from ChatGPT / his bank and types them here; Rowan owns the
// trajectory + the strategic context (business_equity factors in his
// MRR-driven valuation, debts captures the credit card balance).
// Total is computed in-app, not stored.
export function useNetWorth() {
  const [snapshots, setSnapshots] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading]     = useState(true);
  const [userId, setUserId]       = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("net_worth_snapshots")
      .select("*")
      .eq("user_id", user.id)
      .order("snapshot_date", { ascending: true });
    setSnapshots(((data ?? []) as NetWorthSnapshot[]).map((s) => ({
      ...s,
      cash:            Number(s.cash)            || 0,
      investments:     Number(s.investments)     || 0,
      business_equity: Number(s.business_equity) || 0,
      debts:           Number(s.debts)           || 0,
    })));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useRealtimeSubscription({
    channelBase: userId ? `net-worth:${userId}` : "",
    table:       "net_worth_snapshots",
    filter:      userId ? `user_id=eq.${userId}` : undefined,
    enabled:     !!userId,
    onChange:    load,
  });

  // Upsert by (user_id, snapshot_date) — re-entering "this month" updates
  // the existing row instead of creating a duplicate.
  const upsertSnapshot = useCallback(async (input: SnapshotInput) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from("net_worth_snapshots")
      .upsert({
        user_id:         userId,
        snapshot_date:   input.snapshot_date,
        cash:            input.cash            ?? 0,
        investments:     input.investments     ?? 0,
        business_equity: input.business_equity ?? 0,
        debts:           input.debts           ?? 0,
        notes:           input.notes           ?? null,
      }, { onConflict: "user_id,snapshot_date" })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as NetWorthSnapshot;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  const deleteSnapshot = useCallback(async (id: string) => {
    await supabase.from("net_worth_snapshots").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const totals = useMemo(() => snapshots.map((s) => ({
    date: s.snapshot_date,
    total: s.cash + s.investments + s.business_equity - s.debts,
  })), [snapshots]);

  const latest      = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const latestTotal = latest ? latest.cash + latest.investments + latest.business_equity - latest.debts : 0;

  // YoY-ish delta — latest vs first snapshot in the last 365 days.
  const yearAgoCutoff = (() => { const d = new Date(); d.setDate(d.getDate() - 365); return d.toISOString().slice(0, 10); })();
  const yearAgoSnap   = snapshots.find((s) => s.snapshot_date >= yearAgoCutoff) ?? null;
  const yearAgoTotal  = yearAgoSnap ? yearAgoSnap.cash + yearAgoSnap.investments + yearAgoSnap.business_equity - yearAgoSnap.debts : null;
  const deltaPct      = yearAgoTotal != null && yearAgoTotal !== 0
    ? Math.round(((latestTotal - yearAgoTotal) / Math.abs(yearAgoTotal)) * 100)
    : null;

  return { snapshots, loading, latest, latestTotal, totals, deltaPct, upsertSnapshot, deleteSnapshot };
}
