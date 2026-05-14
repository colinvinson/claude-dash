import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Generate (or refresh) a goal's AI summary. Reads the goal's linked routine
// items + their last 7 days of supplement_logs adherence + current_state +
// next_steps + the last 7 days of journal entries matching the goal's bucket.
//
// Cost ceiling: ~1k input + 250 output tokens per call, Haiku 4.5 →
// pennies even at high volume. 1-hour cooldown enforced server-side unless
// ?force=1 is passed.
//
// POST /api/jarvis/goal-summary[?force=1]
// Body: { goalId: string }
// Returns: { summary: string }  |  { error, status }

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const force = new URL(req.url).searchParams.get("force") === "1";
  const { goalId } = await req.json().catch(() => ({})) as { goalId?: string };
  if (!goalId) return NextResponse.json({ error: "missing goalId" }, { status: 400 });

  const service = createServiceClient();

  // Load the goal (must belong to this user).
  const { data: goal } = await service
    .from("long_term_goals")
    .select("id, title, bucket, category, target_date, current_state, next_steps, ai_summary_updated_at")
    .eq("id", goalId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!goal) return NextResponse.json({ error: "goal not found" }, { status: 404 });

  // 1-hour cooldown (skippable with ?force=1).
  if (!force && goal.ai_summary_updated_at) {
    const ageMin = (Date.now() - new Date(goal.ai_summary_updated_at).getTime()) / 60_000;
    if (ageMin < 60) {
      return NextResponse.json({ error: "cooldown — try again later", ageMin: Math.round(ageMin) }, { status: 429 });
    }
  }

  // Pull linked routine items + their last-7-days adherence.
  const { data: linkedItems } = await service
    .from("supplement_stack")
    .select("id, name, dose, days_of_week, scheduled_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .eq("linked_goal_id", goalId);

  const since = new Date(); since.setDate(since.getDate() - 7);
  const { data: logs } = await service
    .from("supplement_logs")
    .select("supplement_id, log_date")
    .eq("user_id", user.id)
    .gte("log_date", ymd(since));

  const logsByItem = new Map<string, Set<string>>();
  for (const l of logs ?? []) {
    if (!logsByItem.has(l.supplement_id)) logsByItem.set(l.supplement_id, new Set());
    logsByItem.get(l.supplement_id)!.add(l.log_date);
  }

  const itemsSummary = (linkedItems ?? []).map((item) => {
    const dow = item.days_of_week as number[] | null;
    const isScheduledOn = (d: Date) => !dow || dow.length === 0 || dow.length === 7 || dow.includes(d.getDay());
    let expected = 0, done = 0;
    const logged = logsByItem.get(item.id) ?? new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      if (!isScheduledOn(d)) continue;
      expected += 1;
      if (logged.has(ymd(d))) done += 1;
    }
    return { name: item.name as string, dose: item.dose as string | null, done, expected };
  });

  // Last 7 days of journal entries matching the bucket.
  const journalCategory = goal.bucket === "business" ? "business" : "personal";
  const { data: journal } = await service
    .from("journal_entries")
    .select("content, ai_summary, created_at")
    .eq("user_id", user.id)
    .eq("category", journalCategory)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(8);

  // Build the prompt.
  const itemsBlock = itemsSummary.length > 0
    ? itemsSummary.map((i) => `  - ${i.name}${i.dose ? ` (${i.dose})` : ""}: ${i.done}/${i.expected} this week`).join("\n")
    : "  (no routine items linked)";
  const journalBlock = (journal ?? []).length > 0
    ? (journal ?? []).map((j) => `  - ${j.ai_summary ?? j.content.slice(0, 120)}`).join("\n")
    : "  (no recent journal entries in this bucket)";

  const prompt = `You are Jarvis. Write a 3-sentence read on Sir's progress toward this ${goal.bucket} goal. Use the data below. Be specific, use numbers, no fluff, no hedging. If something is drifting, say so. If something is on track, name it. If there isn't enough signal, say "Insufficient data — need at least a week of linked routine logs."

Goal: ${goal.title}${goal.category ? ` (${goal.category})` : ""}${goal.target_date ? ` · target ${goal.target_date}` : ""}

Current state Sir wrote: ${goal.current_state || "(blank)"}
Next steps Sir wrote: ${goal.next_steps || "(blank)"}

Linked routine adherence (last 7 days):
${itemsBlock}

Recent journal entries (last 7 days, ${journalCategory}):
${journalBlock}

Write the 3-sentence read now. No preamble. No "Sir," opener.`;

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,
    messages: [{ role: "user", content: prompt }],
  });

  const summary = (message.content[0] as { text: string }).text.trim();

  await service
    .from("long_term_goals")
    .update({ ai_summary: summary, ai_summary_updated_at: new Date().toISOString() })
    .eq("id", goalId);

  return NextResponse.json({ summary });
}
