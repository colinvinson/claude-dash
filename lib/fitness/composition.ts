// Body composition heuristic — given weight history + a strength delta + a
// protein adherence ratio, produce a plain-language read of whether the
// user is gaining muscle vs fat (or losing muscle vs fat).
//
// Used by both the client hook (useWeight) and the AI context-builder so the
// dashboard verdict and the verdict Jarvis sees stay in lockstep.

export type WeightPoint = { date: string; weight_kg: number };

export type RecompTag =
  | "lean-bulk"
  | "fat-gain"
  | "recomp"
  | "maintain"
  | "clean-cut"
  | "lossy-cut"
  | "regression"
  | "insufficient";

export type RecompVerdict = {
  headline: string;
  detail: string;
  tag: RecompTag;
  weightRateKgWk: number;
  strengthDeltaPct: number;
  proteinAdherence: number;
  daysOfData: number;
};

export const RECOMP_CONSTANTS = {
  MIN_DAYS_FOR_VERDICT: 14,
  GAIN_RATE_THRESHOLD:   0.1,
  LOSS_RATE_THRESHOLD:  -0.1,
  FAST_CUT_THRESHOLD:   -0.5,
  STRENGTH_UP_PCT:       1.5,
  STRENGTH_DOWN_PCT:    -1.5,
  PROTEIN_ADHERENCE_OK:  0.7,
  PROTEIN_TARGET_FRAC:   0.7,
  PROTEIN_TARGET_MULT:   2.0,
  DEFAULT_PROTEIN_TARGET: 150,
} as const;

function slope(xs: number[], ys: number[]): number {
  if (xs.length < 2) return 0;
  const n = xs.length;
  const sumX  = xs.reduce((a, b) => a + b, 0);
  const sumY  = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

export function deriveRecompVerdict(
  points: WeightPoint[],
  strengthDeltaPct: number,
  proteinAdherence: number,
): RecompVerdict {
  const C = RECOMP_CONSTANTS;
  const daysOfData = points.length;

  if (daysOfData < C.MIN_DAYS_FOR_VERDICT) {
    return {
      headline: "Logging in — keep going",
      detail: `Need ${C.MIN_DAYS_FOR_VERDICT - daysOfData} more days of weight logs before a verdict locks in. Aim for daily morning weigh-ins.`,
      tag: "insufficient",
      weightRateKgWk: 0,
      strengthDeltaPct,
      proteinAdherence,
      daysOfData,
    };
  }

  const firstTs = new Date(points[0].date).getTime();
  const xs = points.map((p) => (new Date(p.date).getTime() - firstTs) / 86400000);
  const ys = points.map((p) => p.weight_kg);
  const weightRateKgWk = slope(xs, ys) * 7;

  const proteinOk    = proteinAdherence >= C.PROTEIN_ADHERENCE_OK;
  const strengthUp   = strengthDeltaPct >  C.STRENGTH_UP_PCT;
  const strengthDown = strengthDeltaPct <  C.STRENGTH_DOWN_PCT;

  const proteinNote = proteinOk
    ? `protein on point (${Math.round(proteinAdherence * 100)}% of days)`
    : `protein under target on ${Math.round((1 - proteinAdherence) * 100)}% of days`;
  const strengthNote =
    strengthUp   ? `strength up ${strengthDeltaPct.toFixed(1)}%` :
    strengthDown ? `strength down ${Math.abs(strengthDeltaPct).toFixed(1)}%` :
                   `strength flat (${strengthDeltaPct >= 0 ? "+" : ""}${strengthDeltaPct.toFixed(1)}%)`;

  if (weightRateKgWk > C.GAIN_RATE_THRESHOLD) {
    if (strengthUp && proteinOk) {
      return {
        headline: `Lean bulk — gaining muscle (+${weightRateKgWk.toFixed(2)} kg/wk)`,
        detail: `Weight up at a lean-bulk pace and ${strengthNote}, ${proteinNote}. Most of this gain is muscle. Hold the line.`,
        tag: "lean-bulk",
        weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
      };
    }
    if (strengthUp && !proteinOk) {
      return {
        headline: `Adding mostly fat — protein too low`,
        detail: `Weight up +${weightRateKgWk.toFixed(2)} kg/wk and ${strengthNote}, but ${proteinNote}. Strength gains likely come with more fat than necessary. Hit protein consistently to shift the ratio.`,
        tag: "fat-gain",
        weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
      };
    }
    if (strengthDown) {
      return {
        headline: `Fat gain + overreaching`,
        detail: `Weight climbing +${weightRateKgWk.toFixed(2)} kg/wk while ${strengthNote}. Recovery or volume mismatch — cut the surplus and reassess.`,
        tag: "regression",
        weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
      };
    }
    return {
      headline: `Adding mostly fat`,
      detail: `Weight up +${weightRateKgWk.toFixed(2)} kg/wk but ${strengthNote} — gain isn't translating into strength. Slow the bulk or push harder in the gym.`,
      tag: "fat-gain",
      weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
    };
  }

  if (weightRateKgWk < C.LOSS_RATE_THRESHOLD) {
    const lossRate = Math.abs(weightRateKgWk);
    if (weightRateKgWk < C.FAST_CUT_THRESHOLD && strengthDown) {
      return {
        headline: `Cutting too fast — losing muscle`,
        detail: `Down ${lossRate.toFixed(2)} kg/wk and ${strengthNote}. The deficit is too aggressive. Slow the cut, push protein.`,
        tag: "lossy-cut",
        weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
      };
    }
    if (strengthDown) {
      return {
        headline: `Losing muscle in the cut`,
        detail: `Down ${lossRate.toFixed(2)} kg/wk and ${strengthNote}, ${proteinNote}. Slow the deficit and lock protein in.`,
        tag: "lossy-cut",
        weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
      };
    }
    return {
      headline: `Clean cut — losing fat, holding strength`,
      detail: `Down ${lossRate.toFixed(2)} kg/wk and ${strengthNote}, ${proteinNote}. The cut is working. Keep going.`,
      tag: "clean-cut",
      weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
    };
  }

  if (strengthUp) {
    return {
      headline: `Recomp — gaining muscle, losing fat`,
      detail: `Weight stable (${weightRateKgWk >= 0 ? "+" : ""}${weightRateKgWk.toFixed(2)} kg/wk) and ${strengthNote}. Classic recomp signal. ${proteinNote}.`,
      tag: "recomp",
      weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
    };
  }
  if (strengthDown) {
    return {
      headline: `Strength regressing on stable weight`,
      detail: `Weight flat but ${strengthNote}. Recovery, sleep, or volume issue — not a composition problem.`,
      tag: "regression",
      weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
    };
  }
  return {
    headline: `Maintaining`,
    detail: `Weight flat and ${strengthNote}. ${proteinNote}. If recomp is the goal, push harder in the gym or tighten protein.`,
    tag: "maintain",
    weightRateKgWk, strengthDeltaPct, proteinAdherence, daysOfData,
  };
}

// Collapse possibly-multiple weigh-ins per day into one average per day.
export function collapseToDaily(rows: Array<{ weight_kg: number; logged_at: string }>): WeightPoint[] {
  const byDate = new Map<string, number[]>();
  for (const r of rows) {
    const d = r.logged_at.slice(0, 10);
    const arr = byDate.get(d) ?? [];
    arr.push(Number(r.weight_kg));
    byDate.set(d, arr);
  }
  return [...byDate.entries()]
    .map(([date, arr]) => ({ date, weight_kg: arr.reduce((a, b) => a + b, 0) / arr.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Per-exercise top-est-1rm comparison: best of first third vs best of last
// third of the lookback window. Returns avg %change across all exercises
// that have at least one entry in BOTH thirds.
export function computeStrengthDeltaPct(
  sets: Array<{ est_1rm: number; log_date: string; exercise_id: string }>,
  lookbackDays: number,
): number {
  const split = Math.floor(lookbackDays / 3);
  const startCutoff = new Date();
  startCutoff.setDate(startCutoff.getDate() - lookbackDays + split);
  const endCutoff = new Date();
  endCutoff.setDate(endCutoff.getDate() - split);
  const startStr = startCutoff.toISOString().slice(0, 10);
  const endStr   = endCutoff.toISOString().slice(0, 10);

  const earlyByEx = new Map<string, number>();
  const lateByEx  = new Map<string, number>();
  for (const s of sets) {
    if (s.log_date < startStr) {
      earlyByEx.set(s.exercise_id, Math.max(earlyByEx.get(s.exercise_id) ?? 0, s.est_1rm));
    } else if (s.log_date >= endStr) {
      lateByEx.set(s.exercise_id, Math.max(lateByEx.get(s.exercise_id) ?? 0, s.est_1rm));
    }
  }
  const pctChanges: number[] = [];
  for (const [exId, earlyTop] of earlyByEx) {
    const lateTop = lateByEx.get(exId);
    if (lateTop != null && earlyTop > 0) {
      pctChanges.push(((lateTop - earlyTop) / earlyTop) * 100);
    }
  }
  return pctChanges.length > 0
    ? pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length
    : 0;
}

// Protein adherence: latest weight (any age) defines the daily target.
// Returns the fraction of days in the window where total protein hit
// PROTEIN_TARGET_FRAC of target.
export function computeProteinAdherence(
  proteinRows: Array<{ protein_g: number; log_date: string }>,
  latestWeightKg: number | null,
  lookbackDays: number,
): number {
  const C = RECOMP_CONSTANTS;
  const proteinTarget = latestWeightKg
    ? Math.round(latestWeightKg * C.PROTEIN_TARGET_MULT)
    : C.DEFAULT_PROTEIN_TARGET;
  const threshold = proteinTarget * C.PROTEIN_TARGET_FRAC;
  const byDate = new Map<string, number>();
  for (const r of proteinRows) {
    byDate.set(r.log_date, (byDate.get(r.log_date) ?? 0) + Number(r.protein_g));
  }
  let daysHit = 0;
  let daysCounted = 0;
  for (let i = 0; i < lookbackDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const grams = byDate.get(key) ?? 0;
    daysCounted += 1;
    if (grams >= threshold) daysHit += 1;
  }
  return daysCounted > 0 ? daysHit / daysCounted : 0;
}
