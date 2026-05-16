"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MoneyLog = {
  amount:    number;
  kind:      string;   // 'income' | 'expense' | 'business_revenue' | 'savings' | etc
  category:  string | null;
  log_date:  string;   // YYYY-MM-DD
};

export type MoneyFlowSummary = {
  income30d:    number;
  expense30d:   number;
  net30d:       number;
  income90d:    number;
  expense90d:   number;
  net90d:       number;
  byCategory30d: Array<{ category: string; total: number; kind: "income" | "expense" }>;
};

// Reads existing money_logs (migration 0024) and rolls up into 30d/90d
// totals + per-category split. No new logging — uses the LogSheet money
// tile Sir already has. Surfaces the data that's been silently dying on
// entry until now.
export function useMoneyFlow() {
  const [logs, setLogs]       = useState<MoneyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
    const { data } = await supabase
      .from("money_logs")
      .select("amount, kind, category, log_date")
      .eq("user_id", user.id)
      .gte("log_date", cutoff.toISOString().slice(0, 10))
      .order("log_date", { ascending: false });
    setLogs(((data ?? []) as MoneyLog[]).map((m) => ({ ...m, amount: Number(m.amount) || 0 })));
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`money-flow:${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "money_logs", filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load]);

  const summary: MoneyFlowSummary = useMemo(() => {
    const now = Date.now();
    const cutoff30 = now - 30 * 24 * 3600 * 1000;
    const cutoff90 = now - 90 * 24 * 3600 * 1000;
    let income30 = 0, expense30 = 0, income90 = 0, expense90 = 0;
    const cat30 = new Map<string, { total: number; kind: "income" | "expense" }>();
    for (const m of logs) {
      const ts = new Date(m.log_date + "T00:00:00").getTime();
      if (ts < cutoff90) continue;
      const isIncome  = m.kind === "income" || m.kind === "business_revenue";
      const isExpense = m.kind === "expense";
      if (ts >= cutoff30) {
        if (isIncome)  income30  += m.amount;
        if (isExpense) expense30 += m.amount;
        if (isExpense || isIncome) {
          const c = m.category || "uncategorized";
          const prev = cat30.get(c) ?? { total: 0, kind: isIncome ? "income" : "expense" };
          prev.total += m.amount;
          cat30.set(c, prev);
        }
      }
      if (isIncome)  income90  += m.amount;
      if (isExpense) expense90 += m.amount;
    }
    const byCategory30d = [...cat30.entries()]
      .map(([category, v]) => ({ category, total: v.total, kind: v.kind }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    return {
      income30d:  Math.round(income30),
      expense30d: Math.round(expense30),
      net30d:     Math.round(income30 - expense30),
      income90d:  Math.round(income90),
      expense90d: Math.round(expense90),
      net90d:     Math.round(income90 - expense90),
      byCategory30d,
    };
  }, [logs]);

  return { logs, summary, loading };
}
