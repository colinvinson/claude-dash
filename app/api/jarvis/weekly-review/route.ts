import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Returns the most recent Sunday on/before today (YYYY-MM-DD)
function sundayStart(): string {
  const d = new Date();
  const day = d.getDay();  // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().split("T")[0];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const weekStart = sundayStart();

  const { data: existing } = await service
    .from("weekly_reviews")
    .select("body, highlights")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .single();

  if (existing?.body) return NextResponse.json({ body: existing.body, highlights: existing.highlights, cached: true });

  const context = await buildContext(user.id);

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    messages: [{
      role: "user",
      content: `You are Jarvis writing this user's weekly review letter. You have access to a 21-day daily snapshot, performance correlations, and recovery trends in the context below.

Write a 5-8 sentence letter covering:
1. The week's training output — specific PRs by exercise name from performance.prsThisWeek, specific stalled lifts from performance.stalled, and overall volume trend
2. Recovery patterns — readiness trend, HRV trajectory, sleep adherence
3. Protein adherence — average daily protein, average meal_score
4. Faith + habit consistency (prayer/bible/church days from the snapshot)
5. Mood trajectory if it moved
6. ONE big focus for the coming week, framed as a specific behavioral change

Rules:
- Direct, second person ("you").
- Use real numbers from the context, name specific exercises and habits.
- No greeting/salutation. Start with the most important observation.
- No hedging. Don't say "consider" or "you might want to."
- Output plain text only, no JSON, no markdown headers.

Dashboard context:
${JSON.stringify(context, null, 2)}`,
    }],
  });

  const body = (message.content[0] as { text: string }).text.trim();

  // Extract simple highlights structure
  const ctx = context as { performance?: { prsThisWeek?: string[]; stalled?: string[] } };
  const highlights = {
    prs:     ctx.performance?.prsThisWeek ?? [],
    stalled: ctx.performance?.stalled    ?? [],
  };

  await service.from("weekly_reviews").upsert({
    user_id:    user.id,
    week_start: weekStart,
    body,
    highlights,
  }, { onConflict: "user_id,week_start" });

  return NextResponse.json({ body, highlights, cached: false });
}
