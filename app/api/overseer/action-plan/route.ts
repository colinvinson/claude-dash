import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { goalId, title, category } = await req.json() as {
    goalId: string; title: string; category: string;
  };
  if (!goalId || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages: [{
      role: "user",
      content: `Generate a concrete 3-step action plan for this ${category} goal: "${title}". Keep it under 80 words. Be specific and actionable. Format as a numbered list.`,
    }],
  });

  const plan = (message.content[0] as { text: string }).text.trim();

  const service = createServiceClient();
  await service.from("long_term_goals").update({ ai_action_plan: plan }).eq("id", goalId);

  return NextResponse.json({ plan });
}
