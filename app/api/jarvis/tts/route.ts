import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// "Daniel" — British, authoritative news-anchor delivery. Closest pre-made ElevenLabs voice to Paul Bettany's Jarvis.
const VOICE_ID = "onwK4e9ZLuTAKqWW03F9";
const MODEL_ID = "eleven_turbo_v2_5";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });

  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string") return NextResponse.json({ error: "missing text" }, { status: 400 });

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `elevenlabs ${res.status}`, detail: err.slice(0, 500) }, { status: 502 });
  }

  const audio = await res.arrayBuffer();
  return new NextResponse(audio, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
