"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export type BusinessTask = {
  id:           string;
  business_id:  string;
  title:        string;
  is_complete:  boolean;
  completed_at: string | null;
  due_date:     string | null;
  priority:     -1 | 0 | 1;
  notes:        string | null;
  created_at:   string;
};

export type AddTaskArgs = {
  title:     string;
  priority?: -1 | 0 | 1;
  due_date?: string | null;
};

// Per-business tasks. Pass null to pause the hook.
export function useBusinessTasks(businessId: string | null) {
  const [tasks, setTasks]     = useState<BusinessTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId]   = useState<string | null>(null);
  const supabase = createClient();

  const load = useCallback(async () => {
    if (!businessId) { setTasks([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);
    const { data } = await supabase
      .from("business_tasks")
      .select("*")
      .eq("user_id",     user.id)
      .eq("business_id", businessId)
      .order("is_complete", { ascending: true })
      .order("priority",    { ascending: false })
      .order("created_at",  { ascending: true });
    setTasks((data ?? []) as BusinessTask[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => { load(); }, [load]);

  useRealtimeSubscription({
    channelBase: businessId ? `biz-tasks:${businessId}` : "",
    table:       "business_tasks",
    filter:      businessId ? `business_id=eq.${businessId}` : undefined,
    enabled:     !!userId && !!businessId,
    onChange:    load,
  });

  const addTask = useCallback(async (args: AddTaskArgs): Promise<BusinessTask | null> => {
    if (!userId || !businessId || !args.title.trim()) return null;
    const { data, error } = await supabase
      .from("business_tasks")
      .insert({
        user_id:     userId,
        business_id: businessId,
        title:       args.title.trim(),
        priority:    args.priority ?? 0,
        due_date:    args.due_date ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as BusinessTask;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, load]);

  const toggleTask = useCallback(async (id: string, next: boolean) => {
    await supabase.from("business_tasks").update({
      is_complete:  next,
      completed_at: next ? new Date().toISOString() : null,
    }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const updateTask = useCallback(async (
    id: string,
    patch: Partial<Pick<BusinessTask, "title" | "priority" | "due_date" | "notes">>,
  ) => {
    await supabase.from("business_tasks").update(patch).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const deleteTask = useCallback(async (id: string) => {
    await supabase.from("business_tasks").delete().eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const openTasks = tasks.filter((t) => !t.is_complete);
  const doneTasks = tasks.filter((t) => t.is_complete);

  return { tasks, openTasks, doneTasks, loading, addTask, toggleTask, updateTask, deleteTask };
}
