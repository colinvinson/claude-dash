// Daily score. Components self-EXCLUDE from both numerator and denominator
// when their underlying data isn't available — no free credit, no false penalty.
// Final score renormalizes to 0-100.
//
// READINESS now uses personal-baseline normalization when a baseline is
// available: today's value is mapped against the user's 30-day mean/stddev
// rather than against an absolute 100-point scale. That makes a "great day for
// you" earn full credit even when your absolute norm sits below population
// average (or vice versa).

import type { Baseline } from "@/lib/jarvis/baselines";
import { zScoreToFactor } from "@/lib/jarvis/baselines";

export type ScoreInputs = {
  goalsComplete: number;
  goalsTotal: number;
  readinessScore: number | null;          // Oura 0-100; null = no sync yet today
  readinessBaseline?: Baseline | null;    // 30d personal baseline; null/missing → falls back to absolute /100
  workoutDoneToday: boolean;
  supplementsTaken: number;               // # routine items checked off today
  supplementsTotal: number;               // # routine items scheduled today
  checkedIn: boolean;                     // morning check-in submitted
  proteinPct?: number | null;             // 0..(>=1); 1.0 = at target. Null = no entries yet.
  proteinTarget?: number | null;          // null/0 = no target configured → component excluded
  wakeOnTime?: boolean | null;            // true=on-time, false=late, null=no wake_log today (component excluded)
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
  wakeOnTime:   10,    // NFC-tap by wake target. Volitional, scoring-eligible.
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

  // Readiness — excluded when Oura hasn't synced. NO free credit for missing data.
  // Prefers personal-baseline z-score mapping when we have ≥7 days of history;
  // falls back to absolute /100 when the baseline isn't established yet.
  if (inputs.readinessScore != null) {
    const v = Math.max(0, Math.min(100, inputs.readinessScore));
    const zFactor = inputs.readinessBaseline ? zScoreToFactor(v, inputs.readinessBaseline) : null;
    const factor  = zFactor ?? (v / 100);
    components.push({ earned: factor * W.readiness, max: W.readiness });
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

  // Wake-on-time — excluded when no wake_log for today (no NFC tap yet,
  // no manual confirm). Self-excludes rather than penalizing — Sir might
  // simply not have walked to the kitchen yet at 6am.
  if (inputs.wakeOnTime != null) {
    components.push({
      earned: inputs.wakeOnTime ? W.wakeOnTime : 0,
      max:    W.wakeOnTime,
    });
  }

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
