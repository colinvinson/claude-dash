// Curated optimization knowledge base for the hypertrophy coach.
//
// PHILOSOPHY: only flag swaps when the evidence delta is clear and
// meaningful. "Marginally better" doesn't justify Sir changing his routine.
// Each rule lands somewhere a real hypertrophy coach (Israetel, Helms,
// Nippard) would actually call an upgrade.
//
// Two rule types:
//   - ExerciseSwap: "you're doing X, Y is a clear upgrade given your gym"
//   - SplitIssue:   structural problem with weekly volume / frequency
//
// Anything outside these rules → silent (don't invent recommendations).

export type SwapConfidence = "strong" | "moderate";

export type ExerciseSwap = {
  id: string;
  // Substring patterns matched (case-insensitive) against the user's
  // exercise name. ANY match triggers the rule. Keep these tight enough
  // that "Romanian deadlift" doesn't accidentally match "deadlift".
  matches: string[];
  // Name of the better exercise. Used as the swap target.
  betterName: string;
  // Equipment ids required from lib/fitness/equipment.ts. Engine filters
  // out rules whose equipment Sir doesn't have.
  requiresEquipment: string[];
  // 1-sentence evidence-anchored "why". Quantify when known.
  rationale: string;
  confidence: SwapConfidence;
  // Optional: muscle group affected (for grouping in UI). Pulled from
  // the user's exercise row when present.
  muscleHint?: string;
};

// Evidence basis tags inline in the rationale where they matter.
// Sources lean on: Schoenfeld stretch-mediated meta-analyses (2020-2023),
// Nippard exercise-selection breakdowns, Israetel RP curriculum, Helms PSL.
export const EXERCISE_SWAPS: ExerciseSwap[] = [
  // ── HAMSTRINGS ────────────────────────────────────────────────
  {
    id: "seated-leg-curl-over-lying",
    matches: ["lying leg curl", "leg curl lying"],
    betterName: "Seated Leg Curl",
    requiresEquipment: ["leg-curl-seated"],
    rationale: "Seated leg curl loads the hamstring at its longer (lengthened) position. ~30% more hypertrophy than lying leg curl in the Maeo 2021 RCT for the same effort.",
    confidence: "strong",
    muscleHint: "Hamstrings",
  },
  {
    id: "rdl-over-stiff-leg-deadlift",
    matches: ["good morning", "back extension", "hyperextension"],
    betterName: "Romanian Deadlift",
    requiresEquipment: ["barbell"],
    rationale: "RDL trains hamstrings through a deeper stretch under load. Same hip-hinge pattern as Good Mornings with measurably more lower-body hypertrophy stimulus.",
    confidence: "moderate",
    muscleHint: "Hamstrings",
  },

  // ── QUADS ─────────────────────────────────────────────────────
  {
    id: "hack-squat-over-leg-press-partials",
    matches: ["leg press"],
    betterName: "Hack Squat (full ROM)",
    requiresEquipment: ["hack-squat"],
    rationale: "Hack squat enforces a deeper knee-flexion ROM than the leg press, which research consistently shows produces more quad growth per set. Use it when prioritizing quads.",
    confidence: "moderate",
    muscleHint: "Quads",
  },

  // ── CHEST ─────────────────────────────────────────────────────
  {
    id: "cable-fly-over-pec-deck",
    matches: ["pec deck", "machine fly"],
    betterName: "Cable Fly (low-to-high)",
    requiresEquipment: ["cable-stack-dual"],
    rationale: "Cable allows full chest stretch at the bottom of the rep AND maintains tension through lockout. Pec deck loses tension at end-range. Stretch-mediated growth advantage.",
    confidence: "strong",
    muscleHint: "Chest",
  },
  {
    id: "incline-press-over-flat-only",
    matches: ["flat bench", "bench press"],
    betterName: "Incline Dumbbell Press (15-30°)",
    requiresEquipment: ["dumbbells-heavy"],
    rationale: "Add or sub one chest day to incline DB. Incline biases the underdeveloped clavicular head most lifters lag in. Flat alone leaves the upper chest under-stimulated.",
    confidence: "moderate",
    muscleHint: "Chest",
  },

  // ── SHOULDERS (side delts) ────────────────────────────────────
  {
    id: "cable-lateral-over-db-lateral",
    matches: ["dumbbell lateral", "db lateral", "side raise", "lateral raise"],
    betterName: "Cable Lateral Raise (single arm)",
    requiresEquipment: ["cable-stack-single"],
    rationale: "DB lateral raise has near-zero tension at the bottom. Cable keeps the side delt loaded across the FULL ROM — meaningfully more growth per set at the same effort.",
    confidence: "strong",
    muscleHint: "Shoulders",
  },

  // ── BACK ──────────────────────────────────────────────────────
  {
    id: "chest-supported-row-over-bent-row",
    matches: ["bent over row", "barbell row", "pendlay row"],
    betterName: "Chest-Supported Row",
    requiresEquipment: ["chest-supported-row"],
    rationale: "Removing the lower-back stability tax lets you push the working set closer to failure cleanly. Same lat / mid-back recruitment, less systemic fatigue cost.",
    confidence: "moderate",
    muscleHint: "Back",
  },

  // ── BICEPS ────────────────────────────────────────────────────
  {
    id: "incline-curl-over-standing",
    matches: ["standing barbell curl", "standing dumbbell curl", "ez curl", "standing curl"],
    betterName: "Incline Dumbbell Curl",
    requiresEquipment: ["dumbbells-heavy"],
    rationale: "Incline position lengthens the biceps under load — meaningful stretch-mediated growth bias vs. the standing version which trains the shortened position.",
    confidence: "strong",
    muscleHint: "Biceps",
  },

  // ── TRICEPS ───────────────────────────────────────────────────
  {
    id: "overhead-extension-over-pushdown",
    matches: ["tricep pushdown", "rope pushdown", "tricep press down"],
    betterName: "Overhead Cable Tricep Extension (rope)",
    requiresEquipment: ["cable-stack-single", "tricep-pushdown-rope"],
    rationale: "Overhead position stretches the long head of the triceps (the biggest of the three) under load. Pushdowns train the short head only. Add this; don't necessarily replace.",
    confidence: "strong",
    muscleHint: "Triceps",
  },
];

// ── SPLIT / FREQUENCY RULES ──────────────────────────────────────

export type SplitStats = {
  // For each muscle group: how many separate days this week did Sir train
  // it at all? (Frequency-per-week.)
  freqByMuscle: Record<string, number>;
  // Total weekly sets per muscle (from useWorkout weeklyVolume).
  setsByMuscle: Record<string, number>;
  // Which day strings (Push / Pull / Legs / etc.) does Sir have exercises in?
  splitDays: string[];
};

export type SplitIssue = {
  id: string;
  detect: (s: SplitStats) => boolean;
  // What to surface
  headline: string;
  rationale: string;
  // Optional concrete recommendation
  suggestedStructure?: string;
};

export const SPLIT_ISSUES: SplitIssue[] = [
  {
    id: "one-x-per-week-frequency",
    detect: (s) => {
      // Any major muscle hit exactly once this week (and at all) = bro-split signal
      const majors = ["Chest", "Back", "Quads", "Hamstrings", "Shoulders"];
      return majors.some((m) => (s.freqByMuscle[m] ?? 0) === 1 && (s.setsByMuscle[m] ?? 0) > 0);
    },
    headline: "Hitting muscles only once per week",
    rationale: "Schoenfeld 2016 meta-analysis: 2x/week frequency outperforms 1x for hypertrophy at matched volume. Bro splits leave growth on the table.",
    suggestedStructure: "Upper / Lower (4x/wk) or Push / Pull / Legs run twice (6x/wk)",
  },
  {
    id: "missing-direct-back-work",
    detect: (s) => (s.setsByMuscle["Back"] ?? 0) < 6,
    headline: "Back volume looks low",
    rationale: "Under 6 weekly sets for Back is below MEV (minimum effective volume) for most lifters. Postural imbalance + lagging V-taper if sustained.",
  },
  {
    id: "push-pull-imbalance",
    detect: (s) => {
      const push = (s.setsByMuscle["Chest"] ?? 0) + (s.setsByMuscle["Shoulders"] ?? 0);
      const pull = (s.setsByMuscle["Back"] ?? 0) + (s.setsByMuscle["Rear Delt"] ?? 0);
      return push > 0 && pull > 0 && push >= pull * 1.6;
    },
    headline: "Push volume meaningfully outweighs pull",
    rationale: "Pressing > 1.6× rowing/pulling volume tracks with internally rotated shoulders + anterior dominance over time. Match push:pull closer to 1:1 (or pull-heavy).",
  },
  {
    id: "no-direct-side-delt-work",
    detect: (s) => (s.setsByMuscle["Shoulders"] ?? 0) > 0 && (s.setsByMuscle["Shoulders"] ?? 0) < 8,
    headline: "Side delts under-stimulated",
    rationale: "Compound presses don't grow side delts much. Direct lateral-raise work, 10-15 sets/wk, is what builds shoulder width.",
  },
  {
    id: "no-direct-rear-delt-work",
    detect: (s) => (s.setsByMuscle["Rear Delt"] ?? 0) < 4 && (s.setsByMuscle["Back"] ?? 0) > 0,
    headline: "Rear delts under-stimulated",
    rationale: "Rear delts almost always lag without dedicated work (face pulls, reverse flyes). Adds visible shoulder roundness AND protects shoulder health.",
  },
];
