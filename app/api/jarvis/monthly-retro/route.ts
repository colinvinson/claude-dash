import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Monthly retrospective — Jarvis-generated summary of the prior calendar
// month. Lazily generated when:
//   - the current date is in the first ~5 days of a month, AND
//   - no retro exists for the prior month yet
//
// Persisted in monthly_retros (one row per user-year-month). Surfaces on
// Home until ~day 5 of the new month, then quiets. Sir can dismiss to
// hide it earlier.

const SYSTEM = `You are Jarvis. Write a tight retrospective on Sir's prior calendar month using the dashboard context provided.

Constraints:
- Total length under 250 tokens.
- Anchor in actual numbers from the data — what moved, what didn't.
- Three sections: HIGHLIGHTS (2-3 wins, factual), LOWLIGHTS (1-2 drift areas, no shame), NEXT FOCUS (one sentence).
- Voice rules: clipped sentences, no exclamation points, no hedging, "Sir" sparingly.
- If progress on any long-term goal stands out (good or bad), name it.
- No padding ("overall a great month"). Every sentence does work.

Return STRICT JSON:
{
  "summary":    "<2-3 sentence top-line read>",
  "highlights": "<newline-separated bullets, '- ' prefix>",
  "lowlights":  "<newline-separated bullets, '- ' prefix>",
  "next_focus": "<one sentence>"
}`;

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = user.id;

  const service = createServiceClient();

  // Prior month math
  const now = new Date();
  const prior = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const priorYear  = prior.getFullYear();
  const priorMonth = prior.getMonth() + 1;  // 1-indexed for human readability

  // Only fire in the first 7 days of the new month — avoids generating one
  // immediately after the new month starts a single time, then bailing for
  // the rest.
  if (now.getDate() > 7) {
    return NextResponse.json({ skipped: "past-grace-window" });
  }

  // Already exists?
  const existing = await service
    .from("monthly_retros")
    .select("id")
    .eq("user_id", uid)
    .eq("year", priorYear)
    .eq("month", priorMonth)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({ skipped: "already-generated" });
  }

  // Use the same context-builder Jarvis chat uses. The 21d snapshot in
  // context covers most of the prior month already; Jarvis can ground
  // the retro in that.
  let context: object;
  try { context = await buildContext(uid); }
  catch { context = {}; }

  const monthName = prior.toLocaleString("en-US", { month: "long", year: "numeric" });

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Generate the retrospective for ${monthName}.\n\nContext:\n${JSON.stringify(context)}\n\nJSON only.`,
    }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text).join("").trim();

  try {
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(json) as {
      summary: string; highlights?: string; lowlights?: string; next_focus?: string;
    };
    const { data: inserted } = await service.from("monthly_retros").insert({
      user_id:    uid,
      year:       priorYear,
      month:      priorMonth,
      summary:    parsed.summary,
      highlights: parsed.highlights ?? null,
      lowlights:  parsed.lowlights ?? null,
      next_focus: parsed.next_focus ?? null,
    }).select().single();
    return NextResponse.json({ added: true, retro: inserted });
  } catch {
    return NextResponse.json({ error: "drafter returned unparseable JSON", raw: text.slice(0, 300) }, { status: 502 });
  }
}
