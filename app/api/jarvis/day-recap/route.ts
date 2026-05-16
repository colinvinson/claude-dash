import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot end-of-day Jarvis voice line. Reads dashboard context, returns a
// single short sentence designed to be read aloud (≤25 words). Used by the
// TodayWrap card's "Jarvis recap" button.

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let context: object;
  try { context = await buildContext(user.id); }
  catch { context = {}; }

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 120,
    system: `You are Jarvis — British, dry, formal. Generate ONE short sentence (≤25 words) summarizing Sir's day for spoken playback. State the most material number or fact, then a curt approval or nudge. No greetings, no "great job", no "today you". Just the line. Match the voice rules: clipped, specific, third-person about Sir is fine. Examples of register:
- "Three rings closed, twelve-day streak intact. Steady, sir."
- "Goals cleared but protein short. Tomorrow's lever is the kitchen, not the gym."
- "Five sets logged, deload week underway. The CNS will thank Sir on Monday."`,
    messages: [{ role: "user", content: `Context:\n${JSON.stringify(context)}\n\nReply with the spoken line only.` }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim()
    .replace(/^["']|["']$/g, "");

  return NextResponse.json({ recap: text });
}
