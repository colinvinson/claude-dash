// Rest-time recommendation — adaptive to the just-completed set's intent,
// the exercise type, the recovery band, and whether it's a deload week.
//
// Bases come from the hypertrophy literature consensus:
//   - Compound:   3 min baseline (Schoenfeld / RP — ATP-PC restoration so
//                 the next compound set near-maxes output)
//   - Secondary:  2 min baseline
//   - Isolation:  90s baseline (shorter is fine for low-CNS isolation work)
//
// Adjustments stack additively so the user can see the math in the UI tip:
//   +30s if just-completed set was TO FAILURE (rir 0 or null)
//   +60s if just-completed set used an extension technique (drop / partials /
//        rest-pause / myo-reps — these compound metabolic + neural fatigue)
//   +30s if recovery band is "compromised"
//   +60s if recovery band is "low"
//   -30s on a deload week (intensity capped anyway; longer rest is wasted)
//
// Result clamped to [60, 360].

import type { SetProtocol } from "./intensity-protocol";
import type { RecoveryBand } from "./recovery";

const BASE: Record<string, number> = {
  Compound:  180,
  Secondary: 120,
  Isolation: 90,
};

export type RestRecommendation = {
  seconds: number;
  baseSeconds: number;
  adjustments: Array<{ delta: number; reason: string }>;
};

export function recommendRest(opts: {
  exerciseType: string;
  justCompletedProtocol?: SetProtocol;
  recoveryBand?: RecoveryBand | null;
  isDeloadWeek?: boolean;
}): RestRecommendation {
  const base = BASE[opts.exerciseType] ?? BASE.Secondary;
  const adjustments: RestRecommendation["adjustments"] = [];

  const p = opts.justCompletedProtocol;
  if (p) {
    const wentToFailure = p.rir === 0 || p.rir === null;
    if (wentToFailure) adjustments.push({ delta: 30, reason: "failure set" });
    if (p.technique)   adjustments.push({ delta: 60, reason: `extension: ${p.technique}` });
  }

  if (opts.recoveryBand === "compromised") {
    adjustments.push({ delta: 30, reason: "recovery compromised" });
  } else if (opts.recoveryBand === "low") {
    adjustments.push({ delta: 60, reason: "recovery low" });
  }

  if (opts.isDeloadWeek) {
    adjustments.push({ delta: -30, reason: "deload week" });
  }

  const totalDelta = adjustments.reduce((s, a) => s + a.delta, 0);
  const seconds = Math.max(60, Math.min(360, base + totalDelta));

  return { seconds, baseSeconds: base, adjustments };
}

export function formatRest(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
