// Jarvis memory helpers — fact read/write against the jarvis_facts table.
// Supports fact supersession: when a contradicting fact arrives, the old one
// is marked superseded (not deleted) and the new one takes its place. Stale
// facts stop polluting context but remain queryable for history / debugging.

import type { SupabaseClient } from "@supabase/supabase-js";

export type JarvisFact = {
  id:                 string;
  fact:               string;
  source:             "chat" | "worker" | "manual";
  confidence:         number;
  last_referenced_at: string | null;
  created_at:         string;
};

// Only return ACTIVE facts (not superseded). Sorted by confidence + recency.
export async function getRelevantFacts(
  supabase: SupabaseClient,
  userId: string,
  query?: string,
  limit = 30,
): Promise<JarvisFact[]> {
  let q = supabase
    .from("jarvis_facts")
    .select("id, fact, source, confidence, last_referenced_at, created_at")
    .eq("user_id", userId)
    .is("superseded_at", null);

  if (query && query.trim().length > 0) {
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

// Mark one or more existing facts as superseded by a new fact. Used when
// Jarvis writes a fact that contradicts a stored one. The new fact's id
// becomes the `superseded_by` pointer.
export async function supersedeFacts(
  supabase: SupabaseClient,
  staleFactIds: string[],
  replacedByFactId: string,
) {
  if (staleFactIds.length === 0) return;
  await supabase
    .from("jarvis_facts")
    .update({
      superseded_at: new Date().toISOString(),
      superseded_by: replacedByFactId,
    })
    .in("id", staleFactIds);
}

// Write a fact, optionally superseding stale facts in the same conceptual slot.
// `supersedeIds` lets the caller (Jarvis tool) explicitly mark old facts as
// stale when she sees a contradiction. Caller is expected to pass IDs from a
// prior recall_facts query.
export async function writeFact(
  supabase: SupabaseClient,
  userId: string,
  fact: string,
  source: "chat" | "worker" | "manual" = "chat",
  confidence = 0.8,
  supersedeIds: string[] = [],
): Promise<JarvisFact | null> {
  const trimmed = fact.trim();
  if (!trimmed) return null;

  // Dedupe — if an identical ACTIVE fact exists, bump its confidence +
  // last_referenced_at instead of inserting a duplicate.
  const { data: existing } = await supabase
    .from("jarvis_facts")
    .select("id, confidence")
    .eq("user_id", userId)
    .eq("fact", trimmed)
    .is("superseded_at", null)
    .maybeSingle();

  if (existing) {
    const newConf = Math.min(1, Number(existing.confidence) + 0.1);
    await supabase
      .from("jarvis_facts")
      .update({ confidence: newConf, last_referenced_at: new Date().toISOString() })
      .eq("id", existing.id);
    // Even on dedupe, supersede the stale facts the caller flagged.
    if (supersedeIds.length > 0) await supersedeFacts(supabase, supersedeIds, existing.id);
    return {
      id: existing.id, fact: trimmed, source,
      confidence: newConf,
      last_referenced_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  const { data } = await supabase
    .from("jarvis_facts")
    .insert({ user_id: userId, fact: trimmed, source, confidence })
    .select("id, fact, source, confidence, last_referenced_at, created_at")
    .single();

  if (data && supersedeIds.length > 0) {
    await supersedeFacts(supabase, supersedeIds, (data as { id: string }).id);
  }
  return data as JarvisFact | null;
}
