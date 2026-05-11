import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are scoring a food entry for someone tracking lean aesthetic muscle mass.

Scoring rubric (0-100):
- 90-100: high protein density, whole food, minimal sugar (chicken breast, salmon, eggs, Greek yogurt, lean beef, cottage cheese)
- 70-89: solid clean protein source (protein shakes with quality ingredients, lean turkey, tuna)
- 50-69: moderate protein, mixed quality (pasta with meat, pizza)
- 30-49: low protein OR high added sugar / refined carbs
- 0-29: junk, near-zero protein

Return ONLY JSON: {"score": <integer 0-100>, "reasoning": "one short sentence"}`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { food_name, protein_g } = await req.json() as { food_name: string; protein_g: number };
  if (!food_name) return NextResponse.json({ error: "Missing food_name" }, { status: 400 });

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `${PROMPT}\n\nFood: "${food_name}" (${protein_g}g protein logged)`,
      }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { score: number; reasoning: string };

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
