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

export type LifestyleInputs = {
  // Last 7 health_logs rows (avg sleep is computed from these).
  health7d: Array<{ sleep_hours: number | null; sleep_score: number | null }>;
  // Last 7 days of alcohol_logs rows (one row per drink event).
  alcohol7d: Array<{ log_date: string; drink_count: number | null }>;
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
  // suppressing recovery (heavy alcohol week OR multi-night sleep debt).
  hasMajorDrag: boolean;
  // Useful raw signals exposed for the coach's tip text.
  sleepHrs7dAvg:    number | null;
  sleepScore7dAvg:  number | null;
  alcoholDays7d:    number;
  drinks7dTotal:    number;
  suppAdherence7d:  number;
};

function avg(arr: number[]): number | null {
  return arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;
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

  // ── Alcohol ──────────────────────────────────────────────
  const drinks7dTotal = inputs.alcohol7d.reduce((s, r) => s + Number(r.drink_count ?? 1), 0);
  const alcoholDays7d = new Set(inputs.alcohol7d.map((r) => r.log_date)).size;
  let alcoholDrag = false;
  if (drinks7dTotal >= 6 || alcoholDays7d >= 3) {
    drivers.push({
      text: `${drinks7dTotal} drinks across ${alcoholDays7d} days last 7. Each session blunts MPS ~24-48h and tanks deep sleep — expect proportional drag on PRs.`,
      severity: "warn",
    });
    alcoholDrag = true;
  } else if (drinks7dTotal === 0) {
    drivers.push({ text: `Zero drinks last 7d — clean recovery window.`, severity: "good" });
  }

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
      text: `Composition phase: lean bulk (${recomp.weightRateKgWk >= 0 ? "+" : ""}${recomp.weightRateKgWk.toFixed(2)} kg/wk, ${recomp.strengthDeltaPct >= 0 ? "+" : ""}${recomp.strengthDeltaPct.toFixed(1)}% strength). Surplus is landing as muscle — push for PRs.`,
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
    suppAdherence7d,
  };
}
