// Goal-alignment matcher — given an action (a dimension log, a workout set,
// a schedule item check), determine which active long-term goals it
// advances. Used by Toast overlays after logging so every action visibly
// ties back to a goal.
//
// Two sources of alignment:
//   1. STRUCTURAL — supplement_stack.linked_goal_id ties a routine item to
//      a goal explicitly. If Sir taps that item, it's a direct goal hit.
//   2. HEURISTIC — for actions that aren't pre-linked (cardio, sun, learn,
//      etc.), match against goal titles / categories using keyword cues.
//
// Returns 0-2 goal titles. Keeps the overlay short ("→ Get tan, Boost T").

export type ActionKind =
  | "stack_item"      // tapped a stack item (already may be linked_goal_id)
  | "workout_set"     // logged a workout set
  | "cardio"
  | "sun"
  | "learning"
  | "social"
  | "focus"
  | "libido"
  | "aesthetic"
  | "caffeine"
  | "money"
  | "protein"
  | "weight"
  | "meditation";

export type AlignmentGoal = {
  id: string;
  title: string;
  category: string | null;
  goal_type: string;
};

// Keyword cues — each action kind has a list of substrings that, when
// found in a goal's title or category (case-insensitive), suggest the
// action advances that goal. Conservative on purpose; misalignment is
// worse than no alignment.
const KIND_KEYWORDS: Partial<Record<ActionKind, string[]>> = {
  cardio:     ["cardio", "endurance", "vo2", "heart", "fat loss", "lose weight", "lean", "tan"],
  sun:        ["tan", "vitamin d", "sun", "skin", "mood", "depression"],
  learning:   ["learn", "skill", "knowledge", "growth", "read", "book", "course", "study"],
  social:     ["relationship", "social", "network", "friend", "dating", "connection"],
  focus:      ["productivity", "deep work", "ship", "build", "launch", "saas", "business", "income", "revenue"],
  libido:     ["test", "testosterone", "hormone", "trt", "vitality", "libido"],
  aesthetic:  ["aesthetic", "look", "muscle", "lean", "tan", "physique", "summer", "hypertrophy"],
  protein:    ["muscle", "hypertrophy", "lean", "bulk", "strength"],
  weight:     ["weight", "lean", "cut", "bulk", "composition", "body fat", "tan"],
  meditation: ["stress", "anxiety", "calm", "mindful", "focus", "mental"],
  caffeine:   [], // intentionally no match — caffeine isn't goal-advancing
  workout_set: ["muscle", "hypertrophy", "strength", "lean", "aesthetic", "physique"],
};

export function matchGoals(actionKind: ActionKind, goals: AlignmentGoal[]): AlignmentGoal[] {
  const cues = KIND_KEYWORDS[actionKind] ?? [];
  if (cues.length === 0) return [];
  const matches: AlignmentGoal[] = [];
  for (const g of goals) {
    const hay = `${g.title} ${g.category ?? ""}`.toLowerCase();
    if (cues.some((c) => hay.includes(c))) matches.push(g);
    if (matches.length >= 2) break; // cap
  }
  return matches;
}

// Format a short overlay string given matched goals. Returns null if no
// matches (caller should skip the toast entirely).
export function formatAlignment(matches: AlignmentGoal[]): string | null {
  if (matches.length === 0) return null;
  if (matches.length === 1) return `→ ${matches[0].title}`;
  return `→ ${matches.map((m) => m.title).join(", ")}`;
}
