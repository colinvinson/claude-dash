"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

export type ChatSource = "claude" | "chatgpt" | "jarvis" | "other";

export type LinkedChat = {
  id:          string;
  title:       string;
  url:         string | null;
  source:      ChatSource;
  summary:     string | null;
  business_id: string | null;
  goal_id:     string | null;
  archived_at: string | null;
  created_at:  string;
};

export type AddChatArgs = {
  title:   string;
  url?:    string | null;
  source?: ChatSource;
  summary?: string | null;
};

// Linked chats scoped to ONE entity at a time — either a business or
// a long-term goal. Pass `businessId` xor `goalId`. Adds default that
// scope (so when you Add a chat from BusinessDetail it auto-links to
// the business you're on). Pass null to pause the hook.
export function useLinkedChats(args: {
  businessId?: string | null;
  goalId?:     string | null;
}) {
  const { businessId, goalId } = args;
  const [chats, setChats]      = useState<LinkedChat[]>([]);
  const [loading, setLoading]  = useState(true);
  const [userId, setUserId]    = useState<string | null>(null);
  const supabase = createClient();

  const paused = businessId === null && goalId === null;

  const load = useCallback(async () => {
    if (paused) { setChats([]); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    let q = supabase
      .from("linked_chats")
      .select("*")
      .eq("user_id", user.id)
      .is("archived_at", null);
    if (businessId) q = q.eq("business_id", businessId);
    if (goalId)     q = q.eq("goal_id",     goalId);
    const { data } = await q.order("created_at", { ascending: false });
    setChats((data ?? []) as LinkedChat[]);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, goalId, paused]);

  useEffect(() => { load(); }, [load]);

  // Realtime — keep the per-business or per-goal list fresh as Sir
  // adds chats from other surfaces.
  useRealtimeSubscription({
    channelBase: userId ? `linked-chats:${userId}:${businessId ?? "-"}:${goalId ?? "-"}` : "",
    table:       "linked_chats",
    filter:      userId ? `user_id=eq.${userId}` : undefined,
    enabled:     !!userId && !paused,
    onChange:    load,
  });

  const addChat = useCallback(async (a: AddChatArgs): Promise<LinkedChat | null> => {
    if (!userId || !a.title.trim()) return null;
    const { data, error } = await supabase
      .from("linked_chats")
      .insert({
        user_id:     userId,
        title:       a.title.trim(),
        url:         a.url?.trim()     || null,
        source:      a.source ?? "claude",
        summary:     a.summary?.trim() || null,
        business_id: businessId ?? null,
        goal_id:     goalId     ?? null,
      })
      .select()
      .single();
    if (error || !data) return null;
    await load();
    return data as LinkedChat;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, businessId, goalId, load]);

  const updateChat = useCallback(async (id: string, patch: Partial<Pick<LinkedChat, "title" | "url" | "source" | "summary">>) => {
    await supabase.from("linked_chats").update(patch).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  const archiveChat = useCallback(async (id: string) => {
    await supabase.from("linked_chats").update({ archived_at: new Date().toISOString() }).eq("id", id);
    await load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { chats, loading, addChat, updateChat, archiveChat };
}
