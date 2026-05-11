import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SCORING_RUBRIC = `Score 0-100 for "lean aesthetic muscle mass" suitability:
- 90-100: high protein density (≥7g/100cal), whole food, minimal sugar/processing
- 70-89: solid protein, clean processed (protein bars/shakes with quality ingredients)
- 50-69: moderate protein, mixed quality
- 30-49: low protein OR high added sugar / ultra-processed
- 0-29: junk — near-zero protein, mostly sugar/refined carbs

Penalize: added sugar >5g/serving, nova_group 4 (ultra-processed), seed oils as top ingredients.
Reward: whole-food sources, high protein density, fiber, recognizable ingredients.`;

type OFFNutriments = {
  proteins_100g?: number;
  proteins_serving?: number;
  sugars_100g?: number;
  sugars_serving?: number;
  fat_100g?: number;
  "saturated-fat_100g"?: number;
  fiber_100g?: number;
  carbohydrates_100g?: number;
  "energy-kcal_100g"?: number;
  "energy-kcal_serving"?: number;
};

type OFFProduct = {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: OFFNutriments;
  ingredients_text?: string;
  nova_group?: number;
  nutriscore_grade?: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { barcode } = await req.json() as { barcode: string };
  if (!barcode) return NextResponse.json({ error: "Missing barcode" }, { status: 400 });

  // Open Food Facts lookup
  const offUrl = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const offRes = await fetch(offUrl, { next: { revalidate: 86400 } });

  if (!offRes.ok) {
    return NextResponse.json({ error: "Open Food Facts lookup failed" }, { status: 502 });
  }

  const offData = await offRes.json() as { status: number; product?: OFFProduct };
  if (offData.status !== 1 || !offData.product) {
    return NextResponse.json({ error: "Product not in Open Food Facts database. Try manual entry." }, { status: 404 });
  }

  const p = offData.product;
  const n = p.nutriments ?? {};

  // Estimate protein per serving
  const protein_g = (() => {
    if (typeof n.proteins_serving === "number") return Math.round(n.proteins_serving * 10) / 10;
    if (typeof n.proteins_100g === "number") {
      const serving = p.serving_quantity ?? 100;
      return Math.round((n.proteins_100g * serving / 100) * 10) / 10;
    }
    return 0;
  })();

  const food_name = p.product_name
    ? (p.brands ? `${p.brands} — ${p.product_name}` : p.product_name)
    : `Unknown product (${barcode})`;

  const nutritionSummary = JSON.stringify({
    product_name: food_name,
    serving_size: p.serving_size ?? "100g",
    protein_g_per_serving: protein_g,
    sugars_100g: n.sugars_100g ?? null,
    saturated_fat_100g: n["saturated-fat_100g"] ?? null,
    fiber_100g: n.fiber_100g ?? null,
    carbs_100g: n.carbohydrates_100g ?? null,
    calories_100g: n["energy-kcal_100g"] ?? null,
    ingredients: p.ingredients_text?.slice(0, 300) ?? null,
    nova_group: p.nova_group ?? null,
    nutriscore_grade: p.nutriscore_grade ?? null,
  });

  try {
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `${SCORING_RUBRIC}

Product data:
${nutritionSummary}

Return ONLY JSON: {"score": <0-100>, "reasoning": "one sentence"}`,
      }],
    });

    const raw = (message.content[0] as { text: string }).text.trim();
    const cleaned = raw.replace(/^```json\s*|\s*```$/g, "").trim();
    const parsed = JSON.parse(cleaned) as { score: number; reasoning: string };

    return NextResponse.json({
      food_name,
      protein_g,
      score: parsed.score,
      reasoning: parsed.reasoning,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI scoring failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
