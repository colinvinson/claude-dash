"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type Subscription = {
  id: string; service_name: string; amount: number;
  currency: string; billing_cycle: string; next_renewal: string | null;
};
export type BudgetItem  = { id: string; label: string; amount_chf: number; category: string };
export type Order       = { id: string; item_name: string };

export function useFinances() {
  const [subs,    setSubs]    = useState<Subscription[]>([]);
  const [budget,  setBudget]  = useState<BudgetItem[]>([]);
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(null);
  const supabase = createClient();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [subsRes, budgetRes, ordersRes] = await Promise.all([
      supabase.from("subscriptions").select("*").eq("user_id", user.id).order("amount", { ascending: false }),
      supabase.from("budget_items").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("incoming_orders").select("*").eq("user_id", user.id).is("arrived_at", null).order("created_at"),
    ]);

    setSubs(subsRes.data ?? []);
    setBudget(budgetRes.data ?? []);
    setOrders(ordersRes.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addSub = useCallback(async (name: string, amount: number, currency = "USD", cycle = "Monthly") => {
    if (!userId) return;
    await supabase.from("subscriptions").insert({ user_id: userId, service_name: name, amount, currency, billing_cycle: cycle });
    await load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeSub = useCallback(async (id: string) => {
    await supabase.from("subscriptions").delete().eq("id", id);
    await load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addOrder = useCallback(async (name: string) => {
    if (!userId) return;
    await supabase.from("incoming_orders").insert({ user_id: userId, item_name: name });
    await load();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const markArrived = useCallback(async (id: string) => {
    await supabase.from("incoming_orders").update({ arrived_at: new Date().toISOString() }).eq("id", id);
    await load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const monthlyBurn = subs
    .reduce((sum, s) => sum + (s.billing_cycle === "Yearly" ? s.amount / 12 : s.amount), 0);

  return { subs, budget, orders, loading, monthlyBurn, addSub, removeSub, addOrder, markArrived };
}
