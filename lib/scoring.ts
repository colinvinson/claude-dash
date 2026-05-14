// Daily score. Pre-rewrite this was a flat 100-point sum with hard-coded
// weights and a free 12.5-point fallback for missing Oura data. That made
// scores hard to interpret (was 75 a good day or a half-broken sensor?)
// and ignored real signals like protein and routine adherence.
//
// New shape: each component reports {earned, max}; a component IS EXCLUDED
// from BOTH the numerator and denominator when its underlying data isn't
// available. The final score is renormalized to 0-100. No free credit for
// missing data; no penalty for it either.

export type ScoreInputs = {
  goalsComplete: number;
  goalsTotal: number;
  readinessScore: number | null;          // Oura 0-100; null = no sync yet today
  workoutDoneToday: boolean;
  supplementsTaken: number;               // # routine items checked off today
  supplementsTotal: number;               // # routine items scheduled today
  checkedIn: boolean;                     // morning check-in submitted
  proteinPct?: number | null;             // 0..(>=1); 1.0 = at target. Null = no entries yet.
  proteinTarget?: number | null;          // null/0 = no target configured → component excluded
};

export type ScoreResult = {
  score: number;
  accent: "red" | "amber" | "emerald";
  headline: "LOCK IN" | "STEADY" | "CRUSHING IT";
};

// Component weights (relative — they're renormalized to 100 after exclusions).
const W = {
  goals:        20,
  readiness:    20,
  workout:      10,
  adherence:    25,    // any routine items: supps + meds + habits + skincare + exercise + meals
  protein:      15,
  checkin:      10,
} as const;

export function computeDailyScore(inputs: ScoreInputs): ScoreResult {
  const components: Array<{ earned: number; max: number }> = [];

  // Goals — excluded when there are no goals set for today (no false 0).
  if (inputs.goalsTotal > 0) {
    components.push({
      earned: (inputs.goalsComplete / inputs.goalsTotal) * W.goals,
      max:    W.goals,
    });
  }

  // Readiness — excluded when Oura hasn't synced. NO 12.5-point free credit anymore.
  if (inputs.readinessScore != null) {
    components.push({
      earned: Math.max(0, Math.min(100, inputs.readinessScore)) / 100 * W.readiness,
      max:    W.readiness,
    });
  }

  // Workout — binary, always counts. Lower weight than before so a rest day
  // doesn't tank the score.
  components.push({
    earned: inputs.workoutDoneToday ? W.workout : 0,
    max:    W.workout,
  });

  // Routine adherence — covers ALL active items, not just supplements.
  if (inputs.supplementsTotal > 0) {
    components.push({
      earned: (inputs.supplementsTaken / inputs.supplementsTotal) * W.adherence,
      max:    W.adherence,
    });
  }

  // Protein — excluded when no target configured. Capped at 100% (going over
  // target shouldn't earn bonus points — it should encourage actually hitting it).
  if (inputs.proteinTarget && inputs.proteinTarget > 0 && inputs.proteinPct != null) {
    const ratio = Math.max(0, Math.min(1, inputs.proteinPct));
    components.push({
      earned: ratio * W.protein,
      max:    W.protein,
    });
  }

  // Check-in — always counts.
  components.push({
    earned: inputs.checkedIn ? W.checkin : 0,
    max:    W.checkin,
  });

  const totalEarned = components.reduce((s, c) => s + c.earned, 0);
  const totalMax    = components.reduce((s, c) => s + c.max,    0);
  const score       = totalMax === 0 ? 0 : Math.round((totalEarned / totalMax) * 100);

  // Thresholds stay 34 / 67. They map intuitively to red/amber/green and the
  // existing headlines on the Home tab.
  const accent: ScoreResult["accent"] =
    score >= 67 ? "emerald" : score >= 34 ? "amber" : "red";
  const headline: ScoreResult["headline"] =
    score >= 67 ? "CRUSHING IT" : score >= 34 ? "STEADY" : "LOCK IN";

  return { score, accent, headline };
}
