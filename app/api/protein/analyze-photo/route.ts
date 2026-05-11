import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const PROMPT = `You are analyzing a food photo for someone tracking lean aesthetic muscle mass.

Return ONLY a JSON object — no preamble, no markdown fences:
{
  "food_name": "short identifier, e.g. 'grilled chicken thigh + rice'",
  "protein_g": <number, your best estimate of protein grams in the visible portion>,
  "score": <integer 0-100>,
  "reasoning": "one sentence on why this score"
}

Scoring rubric (lean aesthetic muscle):
- 90-100: high protein density (≥7g protein per 100 cal), whole food, minimal added sugar, nutrient-dense (e.g. chicken breast, salmon, Greek yogurt, eggs, lean beef, cottage cheese)
- 70-89: solid protein, moderately processed but clean ingredients (e.g. protein shakes, lean ground turkey + rice, tuna sandwich)
- 50-69: moderate protein, mixed quality (e.g. pasta with meat sauce, pizza with meat toppings)
- 30-49: low protein density OR high added sugar/refined carbs masquerading as a meal (e.g. cereal with milk, granola bars)
- 0-29: junk food or near-zero protein (chips, candy, soda, donuts)

Be honest about portion sizes. If unsure, estimate conservatively.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { image_base64, media_type } = await req.json() as { image_base64: string; media_type?: string };
  if (!image_base64) return NextResponse.json({ error: "Missing image" }, { status: 400 });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (media_type as "image/jpeg" | "image/png" | "image/webp" | "image/gif") ?? "image/jpeg",
              data: image_base64,
            },
          },
          { type: "text", text: PROMPT },
        ],
      }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      food_name: string;
      protein_g: number;
      score: number;
      reasoning: string;
    };

    return NextResponse.json(parsed);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Vision analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
