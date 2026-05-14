import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Categorize a free-text routine item into Sir's schedule taxonomy.
// Returns null fields when uncertain so the UI can leave them user-pickable.
type Classification = {
  category: "supplement" | "medication" | "injection" | "skincare" | "habit" | "exercise" | "meal";
  duration_min: number | null;
  timing_bucket: "Morning" | "Pre-workout" | "Lunch" | "Afternoon" | "Evening" | "Pre-bed";
  suggested_time: string | null;     // "HH:MM" or null
  notes: string | null;              // a short useful note, e.g. "10 min before food"
};

const SYSTEM = `You classify single-line routine items in a personal performance app into one of seven categories. Be decisive and concise.

Categories:
- supplement   — vitamins, minerals, nootropics, adaptogens, fish oil, magnesium, creatine, etc.
- medication   — prescriptions, OTC drugs, hormones, peptides taken orally/sublingually
- injection    — anything injected (insulin, GLP-1s, TRT, peptides via syringe)
- skincare     — topical products (sunscreen, retinoid, moisturizer, serum, cleanser)
- habit        — behaviors with no substance (sunlight exposure, cold plunge, journaling, blue-light glasses, meditation, breathwork, posture check)
- exercise     — workouts, yoga, mobility, walks, runs, bike rides, sports
- meal         — eating events (breakfast, lunch, dinner, protein shake, post-workout meal)

Return STRICT JSON:
{
  "category": "<one of the 7>",
  "duration_min": <integer or null>,        // typical realistic duration; null for instant items like pills
  "timing_bucket": "Morning"|"Pre-workout"|"Lunch"|"Afternoon"|"Evening"|"Pre-bed",
  "suggested_time": "HH:MM" or null,         // optional clock time if obvious
  "notes": "<short, useful, optional>" or null
}

Examples:
- "Magnesium Glycinate"            → category: supplement, duration_min: null, timing_bucket: Pre-bed, suggested_time: "22:00", notes: "400mg ~1h before sleep"
- "Concerta"                       → category: medication, duration_min: null, timing_bucket: Morning, suggested_time: "07:00", notes: null
- "Morning sunlight"               → category: habit, duration_min: 10, timing_bucket: Morning, suggested_time: "07:15", notes: "within 30 min of waking"
- "Yoga"                           → category: exercise, duration_min: 30, timing_bucket: Morning, suggested_time: "08:15", notes: null
- "Blue light glasses"             → category: habit, duration_min: 60, timing_bucket: Pre-bed, suggested_time: "21:30", notes: "1h before bed"
- "Retinol"                        → category: skincare, duration_min: null, timing_bucket: Pre-bed, suggested_time: null, notes: null
- "Breakfast"                      → category: meal, duration_min: 15, timing_bucket: Morning, suggested_time: "08:00", notes: null

NO prose. JSON only.`;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, notes } = await req.json().catch(() => ({ name: "" })) as { name?: string; notes?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "missing name" }, { status: 400 });
  }

  const res = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    system: SYSTEM,
    messages: [{
      role: "user",
      content: notes ? `${name}\n(${notes})` : name,
    }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  try {
    // Strip code fences if Haiku decided to add any
    const json = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
    const parsed = JSON.parse(json) as Classification;
    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json({ error: "classifier returned unparseable output", raw: text.slice(0, 200) }, { status: 502 });
  }
}
