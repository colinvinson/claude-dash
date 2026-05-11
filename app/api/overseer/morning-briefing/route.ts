import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function getLogDate() {
  const now = new Date();
  if (now.getHours() < 6) {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const today = getLogDate();

  // Already generated today?
  const { data: existing } = await service
    .from("morning_briefings")
    .select("body")
    .eq("user_id", user.id)
    .eq("log_date", today)
    .single();

  if (existing?.body) return NextResponse.json({ body: existing.body, cached: true });

  const context = await buildContext(user.id);

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,
    messages: [{
      role: "user",
      content: `You are the Overseer writing this user's morning briefing.

Write EXACTLY 3 sentences:
1. State of recovery/sleep in concrete numbers (cite readiness, HRV, sleep hours).
2. The ONE highest-priority focus for today (training intensity, missed habit to catch, declining trend).
3. A specific, concrete call-to-action they can do in the next hour.

Rules:
- Direct, no fluff, no greeting ("Good morning" etc).
- Use real numbers from the context.
- If recovery is low, lead with that. If a goal pattern is failing, name it.
- No hedging. No "consider" / "maybe" / "you might want to."
- Output plain text only — no JSON, no markdown.

Dashboard context:
${JSON.stringify(context, null, 2)}`,
    }],
  });

  const body = (message.content[0] as { text: string }).text.trim();

  await service.from("morning_briefings").upsert({
    user_id:  user.id,
    log_date: today,
    body,
  }, { onConflict: "user_id,log_date" });

  return NextResponse.json({ body, cached: false });
}
