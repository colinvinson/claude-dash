import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { exercise_id, split_day, weight_kg, reps, user_id, api_key } = body;

  if (api_key !== process.env.WORKOUT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!exercise_id || weight_kg == null || reps == null || !user_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const service  = createServiceClient();
  const est_1rm  = Math.round(weight_kg * (1 + reps / 30));
  const log_date = new Date().toISOString().split("T")[0];

  const { error } = await service.from("workout_sets").insert({
    user_id,
    exercise_id,
    split_day: split_day ?? null,
    gym_id:    null,
    weight_kg,
    reps,
    est_1rm,
    log_date,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
