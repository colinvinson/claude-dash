// Jarvis memory helpers — fact read/write against the jarvis_facts table.

import type { SupabaseClient } from "@supabase/supabase-js";

export type JarvisFact = {
  id:                 string;
  fact:               string;
  source:             "chat" | "worker" | "manual";
  confidence:         number;
  last_referenced_at: string | null;
  created_at:         string;
};

export async function getRelevantFacts(
  supabase: SupabaseClient,
  userId: string,
  query?: string,
  limit = 30,
): Promise<JarvisFact[]> {
  let q = supabase
    .from("jarvis_facts")
    .select("id, fact, source, confidence, last_referenced_at, created_at")
    .eq("user_id", userId);

  if (query && query.trim().length > 0) {
    // Simple ILIKE search — escape underscores and percent signs
    const escaped = query.replace(/[%_]/g, (m) => `\\${m}`);
    q = q.ilike("fact", `%${escaped}%`);
  }

  const { data } = await q
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []) as JarvisFact[];
}

export async function bumpReferences(supabase: SupabaseClient, factIds: string[]) {
  if (factIds.length === 0) return;
  await supabase
    .from("jarvis_facts")
    .update({ last_referenced_at: new Date().toISOString() })
    .in("id", factIds);
}

export async function writeFact(
  supabase: SupabaseClient,
  userId: string,
  fact: string,
  source: "chat" | "worker" | "manual" = "chat",
  confidence = 0.8,
): Promise<JarvisFact | null> {
  const trimmed = fact.trim();
  if (!trimmed) return null;

  // Dedupe — if an identical fact exists, bump its confidence + last_referenced_at instead
  const { data: existing } = await supabase
    .from("jarvis_facts")
    .select("id, confidence")
    .eq("user_id", userId)
    .eq("fact", trimmed)
    .maybeSingle();

  if (existing) {
    const newConf = Math.min(1, Number(existing.confidence) + 0.1);
    await supabase
      .from("jarvis_facts")
      .update({ confidence: newConf, last_referenced_at: new Date().toISOString() })
      .eq("id", existing.id);
    return { id: existing.id, fact: trimmed, source, confidence: newConf, last_referenced_at: new Date().toISOString(), created_at: new Date().toISOString() };
  }

  const { data } = await supabase
    .from("jarvis_facts")
    .insert({ user_id: userId, fact: trimmed, source, confidence })
    .select("id, fact, source, confidence, last_referenced_at, created_at")
    .single();

  return data as JarvisFact | null;
}
