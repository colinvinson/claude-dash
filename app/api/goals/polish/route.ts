import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  const { text } = await req.json().catch(() => ({}));
  if (!text?.trim()) return NextResponse.json({ error: "No text" }, { status: 400 });

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 100,
    messages: [{
      role: "user",
      content: `Rewrite this goal as a clear, concise, action-oriented task. Return ONLY the rewritten goal text — no quotes, no explanation, no preamble.\n\nGoal: ${text}`,
    }],
  });

  const polished = (msg.content[0] as { type: string; text: string }).text?.trim();
  if (!polished) return NextResponse.json({ error: "No output" }, { status: 500 });
  return NextResponse.json({ polished });
}
