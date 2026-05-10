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

  // Supplement stack
  await service.from("supplement_stack").insert([
    { user_id: user.id, name: "Caffeine",           dose: "coffee or monster",    timing: "Morning", notes: "Cutoff 12 PM",                                           sort_order: 1 },
    { user_id: user.id, name: "L-theanine",          dose: "100–200mg",            timing: "Morning", notes: "Take WITH the caffeine — same drink, same minute",        sort_order: 2 },
    { user_id: user.id, name: "Concerta 18mg",       dose: "1 capsule",            timing: "Morning", notes: "After breakfast / with food",                             sort_order: 3 },
    { user_id: user.id, name: "Vitamin C",           dose: "500mg–1g",             timing: "Morning", notes: "With breakfast",                                          sort_order: 4 },
    { user_id: user.id, name: "Omega-3",             dose: "2–3g EPA+DHA",         timing: "Lunch",   notes: "Needs fat to absorb — biggest meal of the day",           sort_order: 5 },
    { user_id: user.id, name: "Creatine",            dose: "5g Monohydrate",       timing: "Lunch",   notes: "Timing doesn't matter, just be consistent",               sort_order: 6 },
    { user_id: user.id, name: "Zinc",                dose: "15–30mg",              timing: "Evening", notes: "With small snack — keep +2hrs from magnesium",            sort_order: 7 },
    { user_id: user.id, name: "Ashwagandha",         dose: "300–600mg",            timing: "Evening", notes: "At night — calms cortisol before bed",                   sort_order: 8 },
    { user_id: user.id, name: "Magnesium glycinate", dose: "300–400mg",            timing: "Evening", notes: "30–60 min before bed — sleep helper",                    sort_order: 9 },
  ]);

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
