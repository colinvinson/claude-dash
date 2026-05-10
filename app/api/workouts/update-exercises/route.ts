import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Exercise type + primary muscle targets for all 43 exercises
const EXERCISE_META: Record<string, { type: string; targets: string[] }> = {
  // PUSH — Chest
  "Bench Press":          { type: "Compound",   targets: ["Chest", "Triceps", "Shoulders"] },
  "Incline Bench Press":  { type: "Compound",   targets: ["Chest", "Triceps", "Shoulders"] },
  "Decline Bench Press":  { type: "Secondary",  targets: ["Chest", "Triceps"] },
  "Dumbbell Chest Press": { type: "Secondary",  targets: ["Chest", "Triceps"] },
  "Cable Fly":            { type: "Isolation",  targets: ["Chest"] },
  "Chest Dips":           { type: "Secondary",  targets: ["Chest", "Triceps"] },
  "Machine Chest Press":  { type: "Secondary",  targets: ["Chest"] },
  // PUSH — Shoulders
  "Overhead Press":       { type: "Compound",   targets: ["Shoulders", "Triceps"] },
  "Dumbbell OHP":         { type: "Secondary",  targets: ["Shoulders", "Triceps"] },
  "Lateral Raises":       { type: "Isolation",  targets: ["Shoulders"] },
  "Cable Lateral Raise":  { type: "Isolation",  targets: ["Shoulders"] },
  "Front Raises":         { type: "Isolation",  targets: ["Shoulders"] },
  // PUSH — Triceps
  "Tricep Pushdown":      { type: "Isolation",  targets: ["Triceps"] },
  "Skull Crushers":       { type: "Secondary",  targets: ["Triceps"] },
  "Overhead Tricep Ext":  { type: "Isolation",  targets: ["Triceps"] },
  "Close-Grip Bench":     { type: "Secondary",  targets: ["Triceps", "Chest"] },
  // PULL — Back
  "Pull-ups":             { type: "Compound",   targets: ["Back", "Biceps", "Rear Delt"] },
  "Lat Pulldown":         { type: "Secondary",  targets: ["Back", "Biceps"] },
  "Barbell Row":          { type: "Compound",   targets: ["Back", "Rear Delt", "Biceps"] },
  "Dumbbell Row":         { type: "Secondary",  targets: ["Back", "Biceps"] },
  "Cable Row":            { type: "Secondary",  targets: ["Back", "Biceps"] },
  "T-Bar Row":            { type: "Secondary",  targets: ["Back", "Rear Delt"] },
  "Chest-Supported Row":  { type: "Secondary",  targets: ["Back", "Rear Delt"] },
  // PULL — Rear Delt
  "Face Pulls":           { type: "Isolation",  targets: ["Rear Delt"] },
  "Rear Delt Fly":        { type: "Isolation",  targets: ["Rear Delt"] },
  // PULL — Biceps
  "Barbell Curl":         { type: "Secondary",  targets: ["Biceps"] },
  "Dumbbell Curl":        { type: "Isolation",  targets: ["Biceps"] },
  "Hammer Curls":         { type: "Isolation",  targets: ["Biceps"] },
  "EZ Bar Curl":          { type: "Secondary",  targets: ["Biceps"] },
  "Cable Curl":           { type: "Isolation",  targets: ["Biceps"] },
  "Incline Dumbbell Curl":{ type: "Isolation",  targets: ["Biceps"] },
  // LEGS — Quads
  "Squat":                { type: "Compound",   targets: ["Quads", "Glutes", "Hamstrings"] },
  "Hack Squat":           { type: "Secondary",  targets: ["Quads", "Glutes"] },
  "Leg Press":            { type: "Secondary",  targets: ["Quads", "Glutes"] },
  "Leg Extension":        { type: "Isolation",  targets: ["Quads"] },
  "Bulgarian Split Squat":{ type: "Compound",   targets: ["Quads", "Glutes", "Hamstrings"] },
  // LEGS — Hamstrings
  "Romanian Deadlift":    { type: "Compound",   targets: ["Hamstrings", "Glutes"] },
  "Leg Curl":             { type: "Isolation",  targets: ["Hamstrings"] },
  "Nordic Curl":          { type: "Secondary",  targets: ["Hamstrings"] },
  // LEGS — Glutes / Calves
  "Hip Thrust":           { type: "Secondary",  targets: ["Glutes", "Hamstrings"] },
  "Cable Kickback":       { type: "Isolation",  targets: ["Glutes"] },
  "Calf Raises":          { type: "Isolation",  targets: ["Calves"] },
  "Seated Calf Raise":    { type: "Isolation",  targets: ["Calves"] },
};

// Idempotent — safe to call multiple times
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();
  const { data: exercises } = await service
    .from("exercises")
    .select("id, name")
    .eq("user_id", user.id);

  if (!exercises?.length) return NextResponse.json({ updated: 0 });

  const updates = await Promise.allSettled(
    exercises.map(async (ex) => {
      const meta = EXERCISE_META[ex.name];
      if (!meta) return null;
      return service
        .from("exercises")
        .update({ exercise_type: meta.type, muscle_targets: meta.targets })
        .eq("id", ex.id);
    })
  );

  const updated = updates.filter((r) => r.status === "fulfilled" && r.value !== null).length;
  return NextResponse.json({ updated, total: exercises.length });
}
