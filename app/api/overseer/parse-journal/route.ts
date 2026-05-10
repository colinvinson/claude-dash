import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { content, entryId } = await req.json() as { content: string; entryId: string };
  if (!content || !entryId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Extract the key insight from this journal/brain dump entry in one concise sentence (max 20 words). Return ONLY the sentence, no JSON, no quotes.\n\nEntry: ${content}`,
    }],
  });

  const summary = (message.content[0] as { text: string }).text.trim();

  const service = createServiceClient();
  await service.from("journal_entries").update({ ai_summary: summary }).eq("id", entryId);

  return NextResponse.json({ summary });
}
