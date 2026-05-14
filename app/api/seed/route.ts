import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const EXERCISE_LIBRARY = [
  // Push
  { name: "Bench Press",          muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Incline Bench Press",  muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Decline Bench Press",  muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Dumbbell Chest Press", muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Cable Fly",            muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Chest Dips",           muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Machine Chest Press",  muscle_group: "Chest",     split_day: "Push", gym_id: null },
  { name: "Overhead Press",       muscle_group: "Shoulders", split_day: "Push", gym_id: null },
  { name: "Dumbbell OHP",         muscle_group: "Shoulders", split_day: "Push", gym_id: null },
  { name: "Lateral Raises",       muscle_group: "Shoulders", split_day: "Push", gym_id: null },
  { name: "Cable Lateral Raise",  muscle_group: "Shoulders", split_day: "Push", gym_id: null },
  { name: "Front Raises",         muscle_group: "Shoulders", split_day: "Push", gym_id: null },
  { name: "Tricep Pushdown",      muscle_group: "Triceps",   split_day: "Push", gym_id: null },
  { name: "Skull Crushers",       muscle_group: "Triceps",   split_day: "Push", gym_id: null },
  { name: "Overhead Tricep Ext",  muscle_group: "Triceps",   split_day: "Push", gym_id: null },
  { name: "Close-Grip Bench",     muscle_group: "Triceps",   split_day: "Push", gym_id: null },
  // Pull
  { name: "Pull-ups",             muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "Lat Pulldown",         muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "Barbell Row",          muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "Dumbbell Row",         muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "Cable Row",            muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "T-Bar Row",            muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "Chest-Supported Row",  muscle_group: "Back",      split_day: "Pull", gym_id: null },
  { name: "Face Pulls",           muscle_group: "Rear Delt", split_day: "Pull", gym_id: null },
  { name: "Rear Delt Fly",        muscle_group: "Rear Delt", split_day: "Pull", gym_id: null },
  { name: "Barbell Curl",         muscle_group: "Biceps",    split_day: "Pull", gym_id: null },
  { name: "Dumbbell Curl",        muscle_group: "Biceps",    split_day: "Pull", gym_id: null },
  { name: "Hammer Curls",         muscle_group: "Biceps",    split_day: "Pull", gym_id: null },
  { name: "EZ Bar Curl",          muscle_group: "Biceps",    split_day: "Pull", gym_id: null },
  { name: "Cable Curl",           muscle_group: "Biceps",    split_day: "Pull", gym_id: null },
  { name: "Incline Dumbbell Curl",muscle_group: "Biceps",    split_day: "Pull", gym_id: null },
  // Legs
  { name: "Squat",                muscle_group: "Quads",     split_day: "Legs", gym_id: null },
  { name: "Hack Squat",           muscle_group: "Quads",     split_day: "Legs", gym_id: null },
  { name: "Leg Press",            muscle_group: "Quads",     split_day: "Legs", gym_id: null },
  { name: "Leg Extension",        muscle_group: "Quads",     split_day: "Legs", gym_id: null },
  { name: "Bulgarian Split Squat",muscle_group: "Quads",     split_day: "Legs", gym_id: null },
  { name: "Romanian Deadlift",    muscle_group: "Hamstrings",split_day: "Legs", gym_id: null },
  { name: "Leg Curl",             muscle_group: "Hamstrings",split_day: "Legs", gym_id: null },
  { name: "Nordic Curl",          muscle_group: "Hamstrings",split_day: "Legs", gym_id: null },
  { name: "Hip Thrust",           muscle_group: "Glutes",    split_day: "Legs", gym_id: null },
  { name: "Cable Kickback",       muscle_group: "Glutes",    split_day: "Legs", gym_id: null },
  { name: "Calf Raises",          muscle_group: "Calves",    split_day: "Legs", gym_id: null },
  { name: "Seated Calf Raise",    muscle_group: "Calves",    split_day: "Legs", gym_id: null },
];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  // Only seed if stack is empty
  const { data: existing } = await service.from("supplement_stack").select("id").eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) return NextResponse.json({ seeded: false });

  // Gyms
  await service.from("gym_locations").insert([
    { user_id: user.id, name: "Les Roches" },
    { user_id: user.id, name: "Clever Fit" },
  ]);

  // Supplement stack — intentionally empty by default. Sir adds his actual stack
  // from Settings or via the Schedule "+ Add" sheet (with AI classification).
  // Pre-seeding specific items was creating phantom adherence + algorithmic bias.

  // Exercise library (gym_id: null = available at any gym)
  await service.from("exercises").insert(EXERCISE_LIBRARY.map((e) => ({ ...e, user_id: user.id })));

  // Goal streak row
  await service.from("goal_streaks").upsert(
    { user_id: user.id, current_streak: 0, longest_streak: 0 },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  return NextResponse.json({ seeded: true });
}

// Adds missing exercises to an existing account (idempotent — skips names already in DB)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const service = createServiceClient();

  const { data: existing } = await service.from("exercises").select("name").eq("user_id", user.id);
  const existingNames = new Set((existing ?? []).map((e: { name: string }) => e.name));

  const toInsert = EXERCISE_LIBRARY
    .filter((e) => !existingNames.has(e.name))
    .map((e) => ({ ...e, user_id: user.id }));

  if (toInsert.length === 0) return NextResponse.json({ added: 0 });

  await service.from("exercises").insert(toInsert);
  return NextResponse.json({ added: toInsert.length });
}
