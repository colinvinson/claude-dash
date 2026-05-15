// Per-set intensity protocol — tells Sir, set-by-set, exactly how hard to push:
//   - RIR (reps in reserve) target
//   - whether to take it to failure
//   - whether to extend past failure with a technique (lengthened partials,
//     drop-set, rest-pause, myo-reps)
//
// Science basis:
//   - Compounds (squat / deadlift / bench / OHP) have high CNS demand. Failure
//     on these crushes recovery and rarely produces more hypertrophy than
//     RIR 1-2. Almost never train to failure.
//   - Isolations (curls / lateral raises / leg curl) have low CNS demand and
//     respond strongly to failure work + lengthened partials. Push hard.
//   - Secondary lifts (RDL / incline press / rows) sit between — failure
//     on the LAST set, RIR 1-2 on working sets.
//   - On compromised/low recovery, intensity gets gated: RIR ≥2 on every set,
//     no failure, no extension techniques. Better to bank the volume than
//     blow the next 48h of recovery.

import type { RecoveryBand } from "./recovery";
import type { CoachStatus } from "@/hooks/useWorkout";

export type IntensityTechnique = "lengthened-partials" | "drop-set" | "rest-pause" | "myo-reps";

export type SetProtocol = {
  setNum:    number;
  rir:       number | null;          // null = train to failure
  technique: IntensityTechnique | null;
  label:     string;                  // short tag — "RIR 2" / "Failure" / "Failure + partials"
  note:      string;                  // single-line guidance
};

const TECHNIQUE_NOTE: Record<IntensityTechnique, string> = {
  "lengthened-partials": "Failure → 3-5 half-reps from the stretched position",
  "drop-set":            "Failure → drop the weight ~20-30% → immediate AMRAP",
  "rest-pause":          "Failure → 15s rest → AMRAP → 15s rest → AMRAP",
  "myo-reps":            "Activation set → 15s rest → +3-5 reps → repeat 3 rounds",
};

// 3-set baseline protocols, indexed by [exerciseType][status]. If targetSets
// differs, the middle ("working") entry repeats to fill.
const BASELINE: Record<string, Record<CoachStatus, Omit<SetProtocol, "setNum">[]>> = {
  Compound: {
    NEW: [
      { rir: 3, technique: null, label: "RIR 3", note: "Feel out the weight — form first." },
      { rir: 2, technique: null, label: "RIR 2", note: "Working set." },
      { rir: 2, technique: null, label: "RIR 2", note: "Final working set — clean technique." },
    ],
    PROGRESS: [
      { rir: 2, technique: null, label: "RIR 2", note: "Warm into the new weight." },
      { rir: 1, technique: null, label: "RIR 1", note: "Working set — control the descent." },
      { rir: 1, technique: null, label: "RIR 1", note: "Last set. Same intent. Don't grind a missed rep." },
    ],
    GRIND: [
      { rir: 2, technique: null, label: "RIR 2", note: "Build into it." },
      { rir: 1, technique: null, label: "RIR 1", note: "Working set." },
      { rir: 0, technique: null, label: "RIR 0", note: "Last rep is the one you barely finish. Stop there — don't grind a fail." },
    ],
    STALLING: [
      { rir: 2, technique: null, label: "RIR 2", note: "Deload set — back off, prime the pattern." },
      { rir: 2, technique: null, label: "RIR 2", note: "Deload set — sleep + calories are the unlock here, not effort." },
      { rir: 1, technique: null, label: "RIR 1", note: "Final set, controlled. No PR attempts today." },
    ],
    REGRESSION: [
      { rir: 2, technique: null, label: "RIR 2", note: "Rebuild — last week's good weight, easy." },
      { rir: 2, technique: null, label: "RIR 2", note: "Rebuild — log the volume." },
      { rir: 1, technique: null, label: "RIR 1", note: "Last set — feel strong again. No max effort." },
    ],
  },
  Secondary: {
    NEW: [
      { rir: 3, technique: null, label: "RIR 3", note: "Find the pattern. Form > load." },
      { rir: 2, technique: null, label: "RIR 2", note: "Working set." },
      { rir: 1, technique: null, label: "RIR 1", note: "Last set — work into it." },
    ],
    PROGRESS: [
      { rir: 2, technique: null, label: "RIR 2", note: "Warm into the new weight." },
      { rir: 1, technique: null, label: "RIR 1", note: "Working set." },
      { rir: 0, technique: null, label: "Failure", note: "Last set — take it to clean technical failure." },
    ],
    GRIND: [
      { rir: 1, technique: null, label: "RIR 1", note: "Working set." },
      { rir: 0, technique: null, label: "Failure", note: "Push to technical failure." },
      { rir: null, technique: "lengthened-partials", label: "Failure + partials", note: TECHNIQUE_NOTE["lengthened-partials"] },
    ],
    STALLING: [
      { rir: 1, technique: null, label: "RIR 1", note: "Working set." },
      { rir: 0, technique: null, label: "Failure", note: "Take to failure." },
      { rir: null, technique: "drop-set", label: "Drop-set", note: TECHNIQUE_NOTE["drop-set"] },
    ],
    REGRESSION: [
      { rir: 2, technique: null, label: "RIR 2", note: "Rebuild." },
      { rir: 2, technique: null, label: "RIR 2", note: "Rebuild." },
      { rir: 1, technique: null, label: "RIR 1", note: "Last set, controlled." },
    ],
  },
  Isolation: {
    NEW: [
      { rir: 2, technique: null, label: "RIR 2", note: "Find the mind-muscle connection — slow tempo." },
      { rir: 1, technique: null, label: "RIR 1", note: "Working set." },
      { rir: 0, technique: null, label: "Failure", note: "Last set — push to failure." },
    ],
    PROGRESS: [
      { rir: 1, technique: null, label: "RIR 1", note: "First working set." },
      { rir: 0, technique: null, label: "Failure", note: "Push to failure." },
      { rir: null, technique: "lengthened-partials", label: "Failure + partials", note: TECHNIQUE_NOTE["lengthened-partials"] },
    ],
    GRIND: [
      { rir: 1, technique: null, label: "RIR 1", note: "First working set." },
      { rir: 0, technique: null, label: "Failure", note: "Failure on the concentric." },
      { rir: null, technique: "lengthened-partials", label: "Failure + partials", note: TECHNIQUE_NOTE["lengthened-partials"] + ". 3 more if you can." },
    ],
    STALLING: [
      { rir: 0, technique: null, label: "Failure", note: "Failure from set 1 — wake the muscle up." },
      { rir: null, technique: "drop-set", label: "Drop-set", note: TECHNIQUE_NOTE["drop-set"] },
      { rir: null, technique: "myo-reps", label: "Myo-reps", note: TECHNIQUE_NOTE["myo-reps"] },
    ],
    REGRESSION: [
      { rir: 2, technique: null, label: "RIR 2", note: "Rebuild — quality reps." },
      { rir: 1, technique: null, label: "RIR 1", note: "Working set." },
      { rir: 0, technique: null, label: "Failure", note: "Last set — go." },
    ],
  },
};

// ────────────────────────────────────────────────────────────────────────
// Warm-up sets — scaled to working weight by exercise type
// ────────────────────────────────────────────────────────────────────────

export type WarmupSet = { weight: number; reps: number };

// % of working weight × reps. Compounds need the most ramp (neural priming
// matters for heavy compounds); isolations need almost none.
const WARMUP_SCHEMES: Record<string, Array<{ pct: number; reps: number }>> = {
  Compound:  [{ pct: 0.40, reps: 5 }, { pct: 0.60, reps: 3 }, { pct: 0.80, reps: 2 }],
  Secondary: [{ pct: 0.50, reps: 5 }, { pct: 0.75, reps: 3 }],
  Isolation: [{ pct: 0.60, reps: 8 }],
};

function roundTo(value: number, step: number): number {
  return Math.max(step, Math.round(value / step) * step);
}

export function buildWarmupSets(exerciseType: string, workingWeight: number): WarmupSet[] {
  if (workingWeight <= 0) return [];
  const scheme = WARMUP_SCHEMES[exerciseType] ?? WARMUP_SCHEMES.Secondary;
  const step = exerciseType === "Compound" ? 2.5 : 1.25;

  // Very light working weights → one activation set, not a full ramp.
  const lightThreshold = exerciseType === "Compound" ? 30 : exerciseType === "Isolation" ? 10 : 15;
  if (workingWeight < lightThreshold) {
    return [{ weight: roundTo(workingWeight * 0.5, step), reps: 8 }];
  }

  // Moderate weights → 1-2 warmups; heavy weights → full ramp.
  const moderateThreshold = exerciseType === "Compound" ? 60 : 40;
  const limit = workingWeight < moderateThreshold ? Math.min(2, scheme.length) : scheme.length;

  return scheme.slice(0, limit).map((w) => ({
    weight: roundTo(workingWeight * w.pct, step),
    reps:   w.reps,
  }));
}

// ────────────────────────────────────────────────────────────────────────

function recoveryGated(p: Omit<SetProtocol, "setNum">, band: RecoveryBand | null): Omit<SetProtocol, "setNum"> {
  if (band !== "compromised" && band !== "low") return p;
  // Compromised recovery: cap RIR at 2 minimum, strip intensity techniques.
  const cappedRir = p.rir == null ? 2 : Math.max(2, p.rir);
  return {
    rir:       cappedRir,
    technique: null,
    label:     `RIR ${cappedRir} · gated`,
    note:      `Recovery ${band} — capped at RIR ${cappedRir}, no failure / no techniques. Bank the volume, save the CNS.`,
  };
}

export function buildSetProtocol(
  exerciseType: string,
  status: CoachStatus,
  targetSets: number,
  recoveryBand: RecoveryBand | null,
): SetProtocol[] {
  const family = BASELINE[exerciseType] ?? BASELINE.Secondary;
  const baseline = family[status] ?? family.GRIND;

  // Stretch / contract to the target set count. The middle ("working") slot
  // repeats when targetSets > 3; the warmup-then-final pattern preserves shape.
  let scaled: Omit<SetProtocol, "setNum">[];
  if (targetSets <= baseline.length) {
    scaled = baseline.slice(0, targetSets);
  } else {
    const middle = baseline[1] ?? baseline[0];
    scaled = [baseline[0], ...Array(targetSets - 2).fill(middle), baseline[baseline.length - 1]];
  }

  return scaled.map((p, i) => ({ ...recoveryGated(p, recoveryBand), setNum: i + 1 }));
}
