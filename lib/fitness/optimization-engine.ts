// Pure recommendation engine. Given the user's current exercises +
// available equipment + weekly volume stats, returns a deduplicated list
// of optimization suggestions to surface in the UI.
//
// Conservative bias by design: nothing here invents alternatives. Every
// recommendation references either an EXERCISE_SWAPS or SPLIT_ISSUES
// entry. If a user's setup doesn't match any rule → empty result (no
// recommendation churn for the sake of looking helpful).

import { EXERCISE_SWAPS, SPLIT_ISSUES, type ExerciseSwap, type SplitStats } from "./optimization-rules";
import { hasEquipment } from "./equipment";

export type Recommendation =
  | {
      kind: "swap";
      exerciseId: string;     // current exercise row id
      currentName: string;
      swap: ExerciseSwap;
    }
  | {
      kind: "split";
      issueId: string;
      headline: string;
      rationale: string;
      suggestedStructure?: string;
    };

export type EvaluateArgs = {
  exercises: Array<{ id: string; name: string; muscle_group?: string }>;
  availableEquipment: string[];
  splitStats: SplitStats;
  // Sir can dismiss specific recommendations; the engine filters them out.
  dismissedRecIds?: Set<string>;
};

export function evaluateOptimizations({ exercises, availableEquipment, splitStats, dismissedRecIds }: EvaluateArgs): Recommendation[] {
  const recs: Recommendation[] = [];
  const dismissed = dismissedRecIds ?? new Set<string>();

  // Gate everything on "has Sir actually trained in the last 7 days." Without
  // this, split rules like "back volume < 6 sets/wk" fire on a fresh account
  // (0 < 6 is always true), spamming bogus recommendations before he's ever
  // logged a single set. Coach should be silent until there's real signal.
  const totalWeeklySets = Object.values(splitStats.setsByMuscle).reduce((s, n) => s + n, 0);
  if (totalWeeklySets === 0) return [];

  // Per-exercise swaps. We match the FIRST rule that fires for each
  // exercise so we don't stack multiple swap suggestions on one entry.
  for (const ex of exercises) {
    const lower = ex.name.toLowerCase();
    for (const swap of EXERCISE_SWAPS) {
      // The "betterName" itself shouldn't trigger its own rule (avoid
      // suggesting Sir swap Cable Lateral for Cable Lateral).
      if (lower.includes(swap.betterName.toLowerCase())) continue;
      if (!swap.matches.some((m) => lower.includes(m.toLowerCase()))) continue;
      if (!hasEquipment(availableEquipment, swap.requiresEquipment)) continue;
      const recId = `swap:${ex.id}:${swap.id}`;
      if (dismissed.has(recId)) continue;
      recs.push({ kind: "swap", exerciseId: ex.id, currentName: ex.name, swap });
      break; // one swap per exercise
    }
  }

  // Split / volume issues. Each rule is global, fires once.
  for (const issue of SPLIT_ISSUES) {
    const recId = `split:${issue.id}`;
    if (dismissed.has(recId)) continue;
    if (issue.detect(splitStats)) {
      recs.push({
        kind: "split",
        issueId: issue.id,
        headline: issue.headline,
        rationale: issue.rationale,
        suggestedStructure: issue.suggestedStructure,
      });
    }
  }

  return recs;
}
