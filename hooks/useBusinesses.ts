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

export function useBusinesses() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading]       = useState(true);
  const [userId, setUserId]         = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const { data } = await supabase
      .from("businesses")
      .select("*")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("monthly_revenue", { ascending: false })
      .order("created_at",      { ascending: false });

    setBusinesses(((data ?? []) as Business[]).map((b) => ({
      ...b,
      monthly_revenue: Number(b.monthly_revenue) || 0,
      customer_count:  Number(b.customer_count)  || 0,
    })));
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
    addBusiness,
    updateBusiness,
    archiveBusiness,
    reload: load,
  };
}
