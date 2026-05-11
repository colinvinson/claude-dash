// Pure scoring functions for recovery + training strain.
// No React, no Supabase — these are deterministic transforms used by hooks/components.

export type HealthSnapshot = {
  readiness_score: number | null;
  hrv:             number | null;
  sleep_score:     number | null;
  sleep_hours:     number | null;
  resilience_level: string | null;
};

export type RecoveryBand = "exceptional" | "primed" | "adequate" | "compromised" | "low";

export type RecoveryResult = {
  score: number;        // 0-100
  band:  RecoveryBand;
  drivers: string[];
};

const RESILIENCE_BONUS: Record<string, number> = {
  exceptional: 5,
  strong:      3,
  solid:       0,
  adequate:   -2,
  limited:    -5,
};

export function computeRecoveryScore(h: HealthSnapshot, hrv7dAvg: number | null): RecoveryResult {
  // Weighted composite: 50% readiness, 30% HRV deviation, 20% sleep
  // If readiness is null, fall back to HRV+sleep only (renormalize weights)
  const drivers: string[] = [];

  const ready = h.readiness_score;
  const hrv   = h.hrv;
  const sleep = h.sleep_score;

  let weightedSum = 0;
  let weightTotal = 0;

  if (ready != null) {
    weightedSum += ready * 50;
    weightTotal += 50;
    if (ready < 60) drivers.push(`Readiness ${ready}/100`);
  }

  if (hrv != null) {
    let hrvPoints = 50;
    if (hrv7dAvg && hrv7dAvg > 0) {
      const delta = hrv - hrv7dAvg;
      // Map deviation: +20ms = 100, -20ms = 0, baseline = 50
      hrvPoints = Math.max(0, Math.min(100, 50 + (delta / 20) * 50));
      if (delta < -10) drivers.push(`HRV ${hrv}ms (${Math.abs(Math.round(delta))}ms below 7d baseline)`);
      else if (delta > 10) drivers.push(`HRV ${hrv}ms (${Math.round(delta)}ms above 7d baseline)`);
    }
    weightedSum += hrvPoints * 30;
    weightTotal += 30;
  }

  if (sleep != null) {
    weightedSum += sleep * 20;
    weightTotal += 20;
    if (sleep < 70) drivers.push(`Sleep score ${sleep}/100`);
    if (h.sleep_hours != null && h.sleep_hours < 7) drivers.push(`Slept ${h.sleep_hours}h`);
  }

  let score = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : 50;

  // Resilience modifier (Oura's own recovery indicator)
  if (h.resilience_level && h.resilience_level in RESILIENCE_BONUS) {
    const bonus = RESILIENCE_BONUS[h.resilience_level];
    score = Math.max(0, Math.min(100, score + bonus));
    if (bonus < 0) drivers.push(`Oura resilience "${h.resilience_level}"`);
  }

  let band: RecoveryBand;
  if      (score >= 85) band = "exceptional";
  else if (score >= 70) band = "primed";
  else if (score >= 55) band = "adequate";
  else if (score >= 40) band = "compromised";
  else                  band = "low";

  if (drivers.length === 0) {
    if (band === "exceptional" || band === "primed") drivers.push("All systems firing");
  }

  return { score, band, drivers };
}

// ============================================================
// Training strain — within-session, 0-21 log scale (Whoop-style)
// ============================================================

export type StrainSet = {
  weight_kg: number;
  reps: number;
  rpe: number | null;
};

function rpeMultiplier(rpe: number | null): number {
  if (rpe == null) return 0.85;  // assume moderate effort if unlogged
  if (rpe >= 10) return 1.6;
  if (rpe >= 9)  return 1.3;
  if (rpe >= 8)  return 1.0;
  if (rpe >= 7)  return 0.75;
  return 0.5;
}

// Raw workload → 0-21 log scale.
// Normalization: ~3000kg of RPE-weighted volume ≈ strain 10 (a solid hypertrophy session)
// ~10000kg ≈ strain 18 (genuinely heavy/long session)
export function computeSessionStrain(sets: StrainSet[]): number {
  if (sets.length === 0) return 0;
  const rawLoad = sets.reduce((sum, s) => sum + s.weight_kg * s.reps * rpeMultiplier(s.rpe), 0);
  if (rawLoad <= 0) return 0;
  // log scale: strain = 21 × (1 - exp(-rawLoad / 4500))
  const strain = 21 * (1 - Math.exp(-rawLoad / 4500));
  return Math.round(strain * 10) / 10;
}

// ============================================================
// Per-muscle local fatigue
// ============================================================

export type MuscleFatigueStatus = "fresh" | "recovering" | "fatigued" | "deeply-fatigued";

export type MuscleFatigueResult = {
  hoursSince: number | null;
  hardSetsLast48h: number;
  lastRPE: number | null;
  status: MuscleFatigueStatus;
};

export type MuscleSetRow = {
  logged_at: string;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  muscles: string[];  // primary + secondary muscle targets for the exercise
};

// Examine recent sets touching the given muscle. Returns its current readiness state.
export function muscleFatigue(muscle: string, recentSets: MuscleSetRow[]): MuscleFatigueResult {
  const now = Date.now();
  const hits = recentSets.filter((s) => s.muscles.includes(muscle));
  if (hits.length === 0) {
    return { hoursSince: null, hardSetsLast48h: 0, lastRPE: null, status: "fresh" };
  }

  const sorted = hits.slice().sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
  const last = sorted[0];
  const hoursSince = (now - new Date(last.logged_at).getTime()) / (1000 * 60 * 60);

  // "Hard set" = working set close to failure: assume any logged set with RPE >= 8 or unknown is a hard set
  // (we don't track warmups separately, so this is a reasonable proxy)
  const hardSetsLast48h = hits.filter((s) => {
    const ageHrs = (now - new Date(s.logged_at).getTime()) / (1000 * 60 * 60);
    return ageHrs <= 48 && (s.rpe == null || s.rpe >= 8);
  }).length;

  const lastRPE = last.rpe;

  let status: MuscleFatigueStatus;
  if (hoursSince > 72) status = "fresh";
  else if (hoursSince > 48) status = "recovering";
  else if (hoursSince < 24 && lastRPE != null && lastRPE >= 9 && hardSetsLast48h >= 6) status = "deeply-fatigued";
  else status = "fatigued";

  return { hoursSince: Math.round(hoursSince * 10) / 10, hardSetsLast48h, lastRPE, status };
}

// ============================================================
// Adjustment matrix — the actual prescription change
// ============================================================

export type Prescription = {
  targetWeight:   number;
  targetReps:     number;
  targetSets:     number;
  rpeCap:         number | null;
};

export type Adjustment = {
  applied: boolean;
  reason:  string;
  original: Prescription;
  adjusted: Prescription;
};

export function adjustForRecovery(
  base: Prescription,
  recovery: RecoveryResult,
  muscle: MuscleFatigueResult,
): Adjustment {
  const original = { ...base };
  const adjusted: Prescription = { ...base };
  const notes: string[] = [];

  const { score, band } = recovery;
  const { status } = muscle;

  // High recovery (>= 70) + fresh muscle → PR-friendly. Keep base.
  if (band === "exceptional" || band === "primed") {
    if (status === "fatigued" || status === "deeply-fatigued") {
      // Joints/CNS fresh, but local fibers aren't. Hold weight, no PR attempt.
      adjusted.targetReps = Math.min(base.targetReps + 1, base.targetReps);  // stay same
      notes.push(`Local muscle still ${status} (${muscle.hoursSince}h since last hit)`);
    } else {
      // Truly primed — push for top of rep range
      adjusted.rpeCap = null;
    }
  }
  // Adequate recovery (55-69) → normal progression unless local fatigue
  else if (band === "adequate") {
    adjusted.rpeCap = 8;
    if (status === "fatigued" || status === "deeply-fatigued") {
      adjusted.targetSets = Math.max(base.targetSets - 1, 2);
      notes.push(`Cutting 1 set — same muscle hit ${muscle.hoursSince}h ago`);
    }
  }
  // Compromised recovery (40-54) → cap RPE, low end of range
  else if (band === "compromised") {
    adjusted.rpeCap = 8;
    notes.push(`Recovery ${score} — stop 2 reps shy of failure`);
  }
  // Low recovery (< 40) → cut volume AND intensity. Volume first.
  else if (band === "low") {
    adjusted.targetWeight = Math.round(base.targetWeight * 0.9 * 4) / 4;  // -10%, round to 0.25
    adjusted.targetSets   = Math.max(Math.floor(base.targetSets * 0.7), 2);
    adjusted.rpeCap       = 7;
    notes.push(`Recovery ${score} — cutting volume 30%, weight -10%, RPE 7 cap`);
  }

  const applied =
    adjusted.targetWeight !== original.targetWeight ||
    adjusted.targetSets   !== original.targetSets   ||
    adjusted.rpeCap       !== original.rpeCap;

  return {
    applied,
    reason: notes.join(" · ") || `Recovery ${score} (${band})`,
    original,
    adjusted,
  };
}
