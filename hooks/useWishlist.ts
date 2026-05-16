"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type WishlistStatus = "wanted" | "bought" | "dismissed";
export type WishlistKind   = "leverage" | "consumption";

export type WishlistItem = {
  id:          string;
  goal_id:     string | null;
  business_id: string | null;
  title:       string;
  url:         string | null;
  price:       number | null;
  kind:        WishlistKind;
  priority:    -1 | 0 | 1;
  status:      WishlistStatus;
  notes:       string | null;
  category:    string | null;
  bought_at:   string | null;
  cost_actual: number | null;
  archived_at: string | null;
  created_at:  string;
};

export type AddWishlistArgs = {
  title:        string;
  price?:       number | null;
  url?:         string | null;
  kind?:        WishlistKind;
  priority?:    -1 | 0 | 1;
  category?:    string | null;
  goal_id?:     string | null;
  business_id?: string | null;
};

// Entity-agnostic wishlist. Pass scope to filter; pass nothing for
// the full list (used by the Finances tab). Goals + businesses are
// optional backlinks — most items will have one, some none.
//
// scope.businessId / scope.goalId === undefined → don't filter on that field.
// scope.businessId / scope.goalId === null      → only items with that field null.
// scope.businessId / scope.goalId === <uuid>    → only items with that exact id.
export function useWishlist(scope: {
  businessId?: string | null;
  goalId?:     string | null;
} = {}) {
  const [items, setItems]     = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    let q = supabase
      .from("wishlist_items")
      .select("*")
      .eq("user_id", user.id)
      .is("archived_at", null);
    if (scope.businessId === null)         q = q.is("business_id", null);
    else if (scope.businessId !== undefined) q = q.eq("business_id", scope.businessId);
    if (scope.goalId === null)             q = q.is("goal_id", null);
    else if (scope.goalId !== undefined)     q = q.eq("goal_id", scope.goalId);

    const { data } = await q
      .order("status",     { ascending: true })
      .order("priority",   { ascending: false })
      .order("created_at", { ascending: true });

    const raw = ((data ?? []) as WishlistItem[]).map((i) => ({
      ...i,
      price:       i.price       != null ? Number(i.price)       : null,
      cost_actual: i.cost_actual != null ? Number(i.cost_actual) : null,
    }));
    const statusRank: Record<WishlistStatus, number> = { wanted: 0, bought: 1, dismissed: 2 };
    raw.sort((a, b) => {
      const s = statusRank[a.status] - statusRank[b.status];
      if (s !== 0) return s;
      if (a.status === "wanted") {
        const p = b.priority - a.priority;
        if (p !== 0) return p;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    setItems(raw);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.businessId, scope.goalId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`wishlist:${userId}:${scope.businessId ?? "x"}:${scope.goalId ?? "x"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wishlist_items", filter: `user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, scope.businessId, scope.goalId, load]);

  const addItem = useCallback(async (args: AddWishlistArgs): Promise<WishlistItem | null> => {
    if (!userId || !args.title.trim()) return null;
    const { data, error } = await supabase
      .from("wishlist_items")
      .insert({
        user_id:     userId,
        goal_id:     args.goal_id     ?? scope.goalId     ?? null,
        business_id: args.business_id ?? scope.businessId ?? null,
        title:       args.title.trim(),
        url:         args.url?.trim()      || null,
        price:       args.price ?? null,
        kind:        args.kind     ?? "consumption",
        priority:    args.priority ?? 0,
        category:    args.category?.trim() || null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as WishlistItem;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, scope.businessId, scope.goalId, load]);

  const updateItem = useCallback(async (id: string, patch: Partial<Pick<WishlistItem, "title" | "url" | "price" | "kind" | "priority" | "category" | "notes" | "cost_actual">>) => {
    await supabase.from("wishlist_items").update(patch).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const markBought = useCallback(async (id: string, costActual?: number | null) => {
    await supabase.from("wishlist_items").update({
      status:      "bought",
      bought_at:   new Date().toISOString(),
      cost_actual: costActual ?? null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const markWanted = useCallback(async (id: string) => {
    await supabase.from("wishlist_items").update({ status: "wanted", bought_at: null }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const dismissItem = useCallback(async (id: string) => {
    await supabase.from("wishlist_items").update({ status: "dismissed" }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const archiveItem = useCallback(async (id: string) => {
    await supabase.from("wishlist_items").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const wantedItems  = items.filter((i) => i.status === "wanted");
  const boughtItems  = items.filter((i) => i.status === "bought");

  // Asymmetry the Strategy surface uses — leverage vs consumption split.
  // If consumption is growing faster than leverage, that's the flag.
  const wantedLeverage    = wantedItems.filter((i) => i.kind === "leverage")   .reduce((s, i) => s + (i.price ?? 0), 0);
  const wantedConsumption = wantedItems.filter((i) => i.kind === "consumption").reduce((s, i) => s + (i.price ?? 0), 0);
  const totalWanted       = wantedLeverage + wantedConsumption;
  const totalSpent        = boughtItems.reduce((s, i) => s + (i.cost_actual ?? i.price ?? 0), 0);

  return {
    items, wantedItems, boughtItems, loading,
    totalWanted, totalSpent, wantedLeverage, wantedConsumption,
    addItem, updateItem, markBought, markWanted, dismissItem, archiveItem,
  };
}
