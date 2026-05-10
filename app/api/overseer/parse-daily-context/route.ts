import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { contextText } = await req.json() as { contextText: string };
  if (!contextText) return NextResponse.json({ ok: true });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 300,
    messages: [{
      role: "user",
      content: `Parse this daily plan and extract time-sensitive reminders. Return JSON only, no prose.

Plan: "${contextText}"

Return: {"reminders": [{"text": "string (max 15 words)", "severity": "green"|"yellow"|"red"}]}

Examples:
- "cubs game at 8pm drinking" → {"text": "Take supplements before 6pm — Cubs game tonight, won't remember later", "severity": "yellow"}
- "gym at 6am" → {"text": "Early gym session — prep clothes and pre-workout tonight", "severity": "green"}

Max 2 reminders. If nothing time-sensitive, return {"reminders": []}.`,
    }],
  });

  const raw = (message.content[0] as { text: string }).text.trim();

  try {
    const parsed = JSON.parse(raw) as { reminders: Array<{ text: string; severity: string }> };
    if (parsed.reminders?.length > 0) {
      const service = createServiceClient();
      await Promise.all(
        parsed.reminders.map((r) =>
          service.from("overseer_insights").insert({
            user_id: user.id,
            body: r.text,
            severity: r.severity ?? "green",
          })
        )
      );
    }
  } catch { /* ignore parse errors */ }

  return NextResponse.json({ ok: true });
}
