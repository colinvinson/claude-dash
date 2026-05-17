"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

function getLogDate() {
  const now = new Date();
  if (now.getHours() < 6) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

// Categories are stored as TEXT in Postgres so new ones can be added without
// a migration. The common set:
//   supplement | medication | injection | skincare | habit | exercise | meal
export type StackCategory =
  | "supplement" | "medication" | "injection" | "skincare"
  | "habit" | "exercise" | "meal" | string;

export type StackItem = {
  id: string;
  name: string;
  dose: string;
  notes: string | null;
  timing: string;
  category: StackCategory;
  sort_order: number;
  taken: boolean;
  log_id: string | null;
  // New: real clock time + duration. Both nullable.
  scheduled_at: string | null;   // "HH:MM:SS" or null
  duration_min: number | null;
  icon: string | null;           // Lucide icon name override
  color: string | null;          // hex/hsl color override
  // null OR [0..6] (Sunday=0). null = daily.
  days_of_week: number[] | null;
  // Optional FK linking this routine to a long-term goal so the Goals tab can
  // compute per-goal adherence. null = unlinked (counts toward nothing).
  linked_goal_id: string | null;
  // User-toggled flag — drives the "running low" badge on the Schedule row.
  // Reset manually after reordering. Only meaningful for supplies (supplement,
  // medication, injection, skincare); ignored on habits / exercise.
  is_running_low: boolean;
};

export type CreateItemArgs = {
  name: string;
  dose?: string;
  notes?: string;
  timing?: string;
  category?: StackCategory;
  scheduled_at?: string | null;   // "HH:MM"
  duration_min?: number | null;
  days_of_week?: number[] | null;
  linked_goal_id?: string | null;
  icon?: string | null;           // lucide name from the curated set; resolveItemStyle uses this directly
};

export function useStack() {
  const [items,   setItems]   = useState<StackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId,  setUserId]  = useState<string | null>(null);
  const supabase   = createClient();
  const channelRef = useRef(`stack-${Math.random().toString(36).slice(2)}`);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const today = getLogDate();

    // SELECT * so a not-yet-applied migration (e.g. is_running_low) doesn't
    // crash the whole query and hide every item. New columns gracefully
    // default to false/null at the merge step below.
    const [stackRes, logsRes] = await Promise.all([
      supabase.from("supplement_stack").select("*").eq("user_id", user.id).eq("is_active", true).order("sort_order"),
      supabase.from("supplement_logs").select("id, supplement_id").eq("user_id", user.id).eq("log_date", today),
    ]);

    const logs = (logsRes.data ?? []) as Array<{ id: string; supplement_id: string }>;
    const merged = (stackRes.data ?? []).map((s: Record<string, unknown>) => {
      const log = logs.find((l: { supplement_id: string }) => l.supplement_id === (s.id as string));
      return {
        ...s,
        // Defaults for columns that may not exist in the user's DB yet.
        is_running_low: (s.is_running_low as boolean | undefined) ?? false,
        linked_goal_id: (s.linked_goal_id as string | null | undefined) ?? null,
        icon:           (s.icon as string | null | undefined) ?? null,
        color:          (s.color as string | null | undefined) ?? null,
        days_of_week:   (s.days_of_week as number[] | null | undefined) ?? null,
        scheduled_at:   (s.scheduled_at as string | null | undefined) ?? null,
        duration_min:   (s.duration_min as number | null | undefined) ?? null,
        taken:          !!log,
        log_id:         log?.id ?? null,
      } as StackItem;
    });
    setItems(merged);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel(channelRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "supplement_logs" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = useCallback(async (supplementId: string, taken: boolean, logId: string | null) => {
    if (!userId) return;
    const today = getLogDate();

    // Optimistic flip in local state
    setItems((prev) => prev.map((item) =>
      item.id === supplementId
        ? { ...item, taken: !taken, log_id: !taken ? "optimistic" : null }
        : item
    ));

    try {
      if (taken && logId) {
        await supabase.from("supplement_logs").delete().eq("id", logId);
      } else {
        await supabase.from("supplement_logs").insert({
          user_id: userId, supplement_id: supplementId,
          log_date: today, taken_at: new Date().toISOString(),
        });
      }
      await load();
    } catch {
      // Roll back on error
      await load();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const addToStack = useCallback(async (name: string, dose: string, timing: string) => {
    if (!userId) return;
    const maxOrder = Math.max(0, ...items.map((i) => i.sort_order));
    await supabase.from("supplement_stack").insert({
      user_id: userId, name, dose, timing, sort_order: maxOrder + 1,
    });
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, items]);

  // Edit an existing stack item. Pass a partial — only the fields you provide
  // get updated. Used by the Schedule sheet's edit mode.
  const updateItem = useCallback(async (id: string, patch: Partial<CreateItemArgs>) => {
    if (!userId) return false;
    // Translate the CreateItemArgs-shaped patch to the actual column shape.
    const dbPatch: Record<string, unknown> = {};
    if (patch.name !== undefined)           dbPatch.name           = patch.name.trim();
    if (patch.dose !== undefined)           dbPatch.dose           = patch.dose?.trim() || null;
    if (patch.notes !== undefined)          dbPatch.notes          = patch.notes?.trim() || null;
    if (patch.timing !== undefined)         dbPatch.timing         = patch.timing ?? null;
    if (patch.category !== undefined)       dbPatch.category       = patch.category ?? "habit";
    if (patch.scheduled_at !== undefined)   dbPatch.scheduled_at   = patch.scheduled_at || null;
    if (patch.duration_min !== undefined)   dbPatch.duration_min   = patch.duration_min ?? null;
    if (patch.days_of_week !== undefined)   dbPatch.days_of_week   = patch.days_of_week ?? null;
    if (patch.linked_goal_id !== undefined) dbPatch.linked_goal_id = patch.linked_goal_id ?? null;
    if (patch.icon !== undefined)           dbPatch.icon           = patch.icon ?? null;
    if (Object.keys(dbPatch).length === 0) return true;
    const { error } = await supabase.from("supplement_stack").update(dbPatch).eq("id", id);
    if (error) return false;
    await load();
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Soft-delete: mark inactive instead of removing. Preserves historical logs.
  const archiveItem = useCallback(async (id: string) => {
    if (!userId) return false;
    const { error } = await supabase.from("supplement_stack").update({ is_active: false }).eq("id", id);
    if (error) return false;
    await load();
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Toggle the "running low" badge. Optimistic — the realtime channel will
  // sync if anything else updates it concurrently.
  const toggleRunningLow = useCallback(async (id: string) => {
    if (!userId) return;
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const next = !current.is_running_low;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, is_running_low: next } : i)));
    await supabase.from("supplement_stack").update({ is_running_low: next }).eq("id", id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, items]);

  // createItem — the richer add path used by the Schedule "+ Add" sheet.
  // If `category` is omitted, the caller is expected to have already classified
  // the item (via /api/jarvis/classify-item). We don't auto-classify here so
  // that the user can preview / override the classification before saving.
  const createItem = useCallback(async (args: CreateItemArgs) => {
    if (!userId) return null;
    const maxOrder = Math.max(0, ...items.map((i) => i.sort_order));
    const payload = {
      user_id:        userId,
      name:           args.name.trim(),
      dose:           args.dose?.trim() || null,
      notes:          args.notes?.trim() || null,
      // timing / scheduled_at / duration_min are all OPTIONAL. Untimed items
      // render in the "Anytime" section of the Schedule tab.
      timing:         args.timing ?? null,
      category:       args.category ?? "habit",
      scheduled_at:   args.scheduled_at || null,
      duration_min:   args.duration_min ?? null,
      days_of_week:   args.days_of_week ?? null,
      linked_goal_id: args.linked_goal_id ?? null,
      icon:           args.icon ?? null,
      sort_order:     maxOrder + 1,
      is_active:      true,
    };
    const { data, error } = await supabase
      .from("supplement_stack")
      .insert(payload)
      .select("id")
      .single();
    if (error) return null;
    await load();
    return data?.id ?? null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, items]);

  return { items, loading, toggle, addToStack, createItem, updateItem, archiveItem, toggleRunningLow };
}
