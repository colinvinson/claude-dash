// Lifestyle drivers — the cross-cutting signals the hypertrophy coach should
// consider beyond what's in workout_sets. Sleep, alcohol, supplement
// adherence, and body-composition phase all materially affect whether
// progress is happening or being silently sabotaged.
//
// The coach itself stays focused on training history; this lib produces a
// structured set of drivers + gating flags that the coach wrapper layers on
// top of its base verdict.

import { collapseToDaily, computeStrengthDeltaPct, computeProteinAdherence, deriveRecompVerdict, type RecompTag } from "./composition";

export type DriverSeverity = "good" | "warn" | "info";
export type Driver = { text: string; severity: DriverSeverity };

// Alcohol drag tier. Drives BOTH the driver text framing AND the
// downstream training adjustments (MRV scale, RPE caps on drink-
// adjacent days). "Normal" means this matches Sir's personal
// baseline — no extra hedge applied beyond what the system already
// scales for. The chronic baseline still bakes in some MRV penalty.
export type AlcoholDragTier = "none" | "low" | "normal" | "heavy";

export type LifestyleInputs = {
  // Last 7 health_logs rows (avg sleep is computed from these).
  health7d: Array<{ sleep_hours: number | null; sleep_score: number | null }>;
  // Last 21 days of alcohol_logs rows. 21d window establishes Sir's
  // personal baseline; the most-recent 7d slice is the "this week"
  // comparison against that baseline.
  alcohol21d: Array<{ log_date: string; drink_count: number | null; logged_at?: string | null }>;
  // Last 7 days of supplement_logs rows (one row per supp×day).
  suppLogs7d: Array<{ supplement_id: string }>;
  // Number of CURRENTLY ACTIVE supplement stack items. Drives adherence ratio.
  activeStackCount: number;
  // 21-day weight history for composition phase derivation.
  weight21d: Array<{ weight_kg: number; logged_at: string }>;
  // 21-day workout sets — same input the composition card uses for strength delta.
  sets21d: Array<{ est_1rm: number; log_date: string; exercise_id: string }>;
  // 21-day protein logs for adherence ratio inside the composition verdict.
  protein21d: Array<{ protein_g: number; log_date: string }>;
  // Latest bodyweight — defines the protein target.
  latestWeightKg: number | null;
};

export type LifestyleContext = {
  drivers: Driver[];
  // Phase tag — used to gate the REGRESSION trigger so the coach doesn't
  // deload Sir on a clean cut (where strength regression is expected).
  compositionTag: RecompTag | null;
  // Composite "training drag" flag — at least one major lifestyle factor is
  // suppressing recovery. NOTE: alcohol on its own no longer flips this
  // unless it's at the "heavy" tier (a real spike above baseline), so the
  // flag doesn't fire every week for someone with a regular-drinker baseline.
  hasMajorDrag: boolean;
  // Useful raw signals exposed for the coach's tip text.
  sleepHrs7dAvg:    number | null;
  sleepScore7dAvg:  number | null;
  alcoholDays7d:    number;
  drinks7dTotal:    number;
  drinksPerWeekBaseline: number;  // 21d average → drinks/week
  alcoholDragTier:  AlcoholDragTier;
  // MRV (Maximum Recoverable Volume) scale to apply to weekly volume
  // targets. 1.0 = no scaling; 0.92 = trim 8%; 0.85 = trim 15%. Chronic
  // drinkers carry a real, sustained recovery cost — the coach should
  // pull volume targets down so the program is achievable, not so Sir
  // accumulates fatigue debt.
  mrvScaleFactor:   number;
  // Hours since the most recent logged drink. Null if no drinks in window.
  // Drives the per-session recovery hedge (cap RPE if last drink was
  // recent — alcohol acutely tanks force output 24-48h).
  hoursSinceLastDrink: number | null;
  suppAdherence7d:  number;
};

function avg(arr: number[]): number | null {
  return arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function avgPerWeek(drinks21dTotal: number): number {
  // 21 days = 3 weeks
  return drinks21dTotal / 3;
}

export function buildLifestyleContext(inputs: LifestyleInputs): LifestyleContext {
  const drivers: Driver[] = [];

  // ── Sleep ────────────────────────────────────────────────
  const sleepHrs   = inputs.health7d.map((h) => h.sleep_hours).filter((v): v is number => v != null);
  const sleepScore = inputs.health7d.map((h) => h.sleep_score).filter((v): v is number => v != null);
  const sleepHrs7dAvg   = avg(sleepHrs);
  const sleepScore7dAvg = avg(sleepScore);

  let sleepDrag = false;
  if (sleepHrs7dAvg != null) {
    if (sleepHrs7dAvg < 6.5) {
      drivers.push({
        text: `Sleep ${sleepHrs7dAvg.toFixed(1)}h avg over 7d — under 7h kills protein synthesis. Plateaus track sleep debt more reliably than they track effort.`,
        severity: "warn",
      });
      sleepDrag = true;
    } else if (sleepHrs7dAvg >= 7.5) {
      drivers.push({ text: `Sleep ${sleepHrs7dAvg.toFixed(1)}h avg — recovery substrate dialed.`, severity: "good" });
    }
  }

  // ── Alcohol — baseline-aware tiering ──────────────────────
  // Sir's directive: he drinks often. The previous absolute thresholds
  // ("warn if ≥6 drinks / 3 days") fired every week — pure noise, zero
  // signal. Tier against his own 21-day baseline instead so the system
  // calls out DEVIATIONS (a real spike), and bakes the chronic baseline
  // into a permanent MRV scale-down rather than nagging about it.
  const now = Date.now();
  const day7Ago = now - 7 * 86400000;
  const day7Iso = new Date(day7Ago).toISOString().slice(0, 10);
  const drinks7d   = inputs.alcohol21d.filter((r) => r.log_date >= day7Iso);
  const drinks21d  = inputs.alcohol21d;
  const drinks7dTotal  = drinks7d .reduce((s, r) => s + Number(r.drink_count ?? 1), 0);
  const drinks21dTotal = drinks21d.reduce((s, r) => s + Number(r.drink_count ?? 1), 0);
  const alcoholDays7d  = new Set(drinks7d.map((r) => r.log_date)).size;
  const drinksPerWeekBaseline = avgPerWeek(drinks21dTotal);

  // Hours since most recent drink — used by adjustForRecovery to hedge
  // single-session prescriptions if drinks happened in the last ~36h.
  const mostRecentTs = drinks21d
    .map((r) => {
      if (r.logged_at) return new Date(r.logged_at).getTime();
      // Fall back to end-of-log-date if no timestamp
      return new Date(r.log_date + "T20:00:00Z").getTime();
    })
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => b - a)[0];
  const hoursSinceLastDrink = mostRecentTs != null ? Math.round((now - mostRecentTs) / 3600000) : null;

  // Tier: compare this week's pace to personal baseline.
  // "Heavy" = real spike above baseline OR an absolute high.
  // "Normal" = matches baseline (regular drinker — already factored in).
  // "Low"   = below baseline (positive deviation).
  // "None"  = effectively zero across 21d (rare for Sir per his framing).
  let alcoholDragTier: AlcoholDragTier;
  if (drinks21dTotal === 0) {
    alcoholDragTier = "none";
  } else if (drinks7dTotal >= Math.max(14, drinksPerWeekBaseline * 1.5)) {
    alcoholDragTier = "heavy";
  } else if (drinks7dTotal < drinksPerWeekBaseline * 0.5) {
    alcoholDragTier = "low";
  } else {
    alcoholDragTier = "normal";
  }

  // MRV scale factor — sustained baseline costs recovery capacity.
  // Chronic ≥8/wk: 0.92x volume target. Chronic ≥14/wk OR this week's
  // pace is "heavy": 0.85x. Pulled into the coach's weekly volume math
  // by callers via lifestyleCtx.mrvScaleFactor.
  let mrvScaleFactor = 1.0;
  if (alcoholDragTier === "heavy" || drinksPerWeekBaseline >= 14) {
    mrvScaleFactor = 0.85;
  } else if (drinksPerWeekBaseline >= 8) {
    mrvScaleFactor = 0.92;
  }

  // Driver text — speak to Sir's reality, not a sober-default template.
  if (alcoholDragTier === "heavy") {
    drivers.push({
      text: `${drinks7dTotal} drinks last 7d (vs ${drinksPerWeekBaseline.toFixed(0)}/wk baseline) — that's a spike. Coach trims this week's volume target ~15% and caps PR attempts for 48h after any session.`,
      severity: "warn",
    });
  } else if (alcoholDragTier === "normal" && drinksPerWeekBaseline >= 6) {
    drivers.push({
      text: `Drinking at baseline (~${Math.round(drinksPerWeekBaseline)}/wk). Volume target already shaded down ${Math.round((1 - mrvScaleFactor) * 100)}% to fit. Protein 2.2g/kg and pre-bed casein matter more than the supplement stack for getting around this.`,
      severity: "info",
    });
  } else if (alcoholDragTier === "low") {
    drivers.push({
      text: `Below baseline this week (${drinks7dTotal} vs ~${Math.round(drinksPerWeekBaseline)}/wk) — recovery window is better than usual, push the top of the volume range.`,
      severity: "good",
    });
  }
  // "none" tier intentionally produces no driver — silent good.

  // alcoholDrag only flips hasMajorDrag at the "heavy" tier. Chronic
  // baseline doesn't trip the major-drag flag because the MRV scale
  // already accounts for it; tripping it would just nag.
  const alcoholDrag = alcoholDragTier === "heavy";

  // ── Supplement adherence (generic — no substance hardcoded) ────
  const possible = inputs.activeStackCount * 7;
  const taken    = inputs.suppLogs7d.length;
  const suppAdherence7d = possible > 0 ? Math.min(1, taken / possible) : 0;
  if (possible > 0) {
    if (suppAdherence7d >= 0.7) {
      drivers.push({ text: `Supplements ${Math.round(suppAdherence7d * 100)}% adherent last 7d — what you've put in the stack is actually being used.`, severity: "good" });
    } else if (suppAdherence7d < 0.5) {
      drivers.push({ text: `Supplements only ${Math.round(suppAdherence7d * 100)}% adherent. The stack isn't doing what it's designed to if half the doses get skipped.`, severity: "warn" });
    }
  }

  // ── Composition phase (the big one for cut-aware coaching) ──
  const weightPoints = collapseToDaily(inputs.weight21d);
  const strengthDelta = computeStrengthDeltaPct(inputs.sets21d, 21);
  const proteinAdh    = computeProteinAdherence(inputs.protein21d, inputs.latestWeightKg, 21);
  const recomp = deriveRecompVerdict(weightPoints, strengthDelta, proteinAdh);
  const compositionTag = recomp.tag === "insufficient" ? null : recomp.tag;

  if (compositionTag === "lean-bulk") {
    drivers.push({
      text: `Composition phase: lean bulk (${recomp.weightRateLbWk >= 0 ? "+" : ""}${recomp.weightRateLbWk.toFixed(2)} lb/wk, ${recomp.strengthDeltaPct >= 0 ? "+" : ""}${recomp.strengthDeltaPct.toFixed(1)}% strength). Surplus is landing as muscle — push for PRs.`,
      severity: "good",
    });
  } else if (compositionTag === "recomp") {
    drivers.push({ text: `Composition phase: recomp. Stable weight + strength up — keep stimulus and protein where they are.`, severity: "good" });
  } else if (compositionTag === "clean-cut") {
    drivers.push({
      text: `Composition phase: clean cut. Expect modest strength drops — that's the calories, not the program. Don't chase PRs.`,
      severity: "info",
    });
  } else if (compositionTag === "lossy-cut") {
    drivers.push({
      text: `Composition phase: cutting too fast (losing muscle). Slow the deficit OR push protein — the strength drop is the warning light.`,
      severity: "warn",
    });
  } else if (compositionTag === "fat-gain") {
    drivers.push({
      text: `Composition phase: gaining mostly fat. Either tighten the surplus or push training harder so the calories build muscle instead of bodyfat.`,
      severity: "warn",
    });
  } else if (compositionTag === "regression") {
    drivers.push({
      text: `Composition phase: regression. Strength + weight both moving wrong — sleep, protein, alcohol, stress are the first checks.`,
      severity: "warn",
    });
  }

  return {
    drivers,
    compositionTag,
    hasMajorDrag: sleepDrag || alcoholDrag,
    sleepHrs7dAvg,
    sleepScore7dAvg,
    alcoholDays7d,
    drinks7dTotal,
    drinksPerWeekBaseline,
    alcoholDragTier,
    mrvScaleFactor,
    hoursSinceLastDrink,
    suppAdherence7d,
  };
}
