import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One-shot protocol drafter for new long-term goals.
//
// Used when Sir picks "Help me build one" during goal creation. Returns a
// structured protocol he can review + accept/edit before the goal is saved
// — substances, habits, and milestones, ranked by effect size per the
// no-cope feedback rule. Bigger lever first. No padding with low-effect
// micro-optimizations.

type ProtocolResponse = {
  plan: string;                       // The "My plan" textarea content (markdown-free, plain prose)
  suggested_items: Array<{            // Habit/supplement candidates to add to the stack
    name: string;
    dose?: string;
    notes?: string;
    timing?: string;
    category: "supplement" | "medication" | "injection" | "skincare" | "habit" | "exercise" | "meal";
    why: string;                      // Effect-size justification, used as the chip subtitle
  }>;
};

const SYSTEM = `You are Jarvis. Sir is creating a long-term goal and needs a protocol drafted that ACTUALLY works.

Non-negotiable rules:
- Lead with the highest-effect-size intervention, not micro-optimizations. The hierarchy for almost every goal: (1) sleep, (2) body composition, (3) training stimulus, (4) cessation of metric-wreckers (alcohol, drugs, sleep debt), (5) targeted pharmacology where evidence is strong, (6) supplements LAST. Do not invert.
- Quantify effect sizes when known: "losing 10kg of fat raises total T 20-30%" beats "weight loss helps."
- Willing to recommend uncomfortable/controversial options when they're what actually works at the magnitude requested. TRT for sub-300 total T, GLP-1s for stubborn body fat, peptides where evidence is strong. State the option; Sir weighs the trade.
- If a popular intervention has weak evidence (ashwagandha bumps T ~10%, tongkat ali evidence is thin), SAY SO or omit it entirely.
- Suggested stack items: 4-8 max. Don't pad. Each one needs a concrete effect-size justification in the "why" field.
- Plan field: 3-6 sentences of plain prose. What Sir is doing / taking / measuring to get there. No markdown headers, no bullets — flowing prose he can paste into the "My plan" textarea as-is.

Return STRICT JSON ONLY:
{
  "plan": "<3-6 sentence plain-prose plan>",
  "suggested_items": [
    {
      "name": "<short name>",
      "dose": "<optional dose string>",
      "notes": "<optional usage note>",
      "timing": "Morning" | "Day" | "Night" | "Anytime",
      "category": "supplement" | "medication" | "injection" | "skincare" | "habit" | "exercise" | "meal",
      "why": "<one-line effect-size justification>"
    }
  ]
}

NO prose outside the JSON. NO code fences. NO greetings.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, category, bucket } = (await req.json().catch(() => ({}))) as { title?: string; category?: string; bucket?: string };
  if (!title?.trim()) return NextResponse.json({ error: "missing title" }, { status: 400 });

  const userMsg = [
    `Goal: ${title}`,
    category ? `Tag: ${category}` : null,
    bucket ? `Bucket: ${bucket}` : null,
    "",
    "Draft Sir's protocol. Return JSON only.",
  ].filter(Boolean).join("\n");

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 800,
    system: SYSTEM,
    messages: [{ role: "user", content: userMsg }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  try {
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(json) as ProtocolResponse;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "drafter returned unparseable JSON", raw: text.slice(0, 300) }, { status: 502 });
  }
}
