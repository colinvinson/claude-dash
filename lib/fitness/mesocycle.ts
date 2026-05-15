// Mesocycle math — pure functions, no React / Supabase.
//
// A mesocycle is N weeks (default 5):
//   - Weeks 1 to N-1: "accumulate" — weekly volume ramps from MEV toward MRV.
//   - Week N: "deload" — volume drops to ~50% of MEV, intensity is capped.
//
// Per-muscle priorities override the linear ramp:
//   - "specialize" → target = MRV every week (push lagging body parts)
//   - "maintenance" → target = MEV every week (don't waste recovery here)
//   - normal (unset) → linear ramp from MEV to MRV across the accumulation weeks

export type MesocycleRow = {
  id:                string;
  user_id:           string;
  start_date:        string;     // YYYY-MM-DD
  planned_weeks:     number;     // total weeks INCLUDING deload week
  muscle_priorities: Record<string, MusclePriority>;
  notes:             string | null;
  ended_at:          string | null;
  created_at:        string;
};

export type MusclePriority = "specialize" | "maintenance";

export type MesoPhase = "accumulate" | "deload" | "complete";

export type MesoState = {
  currentWeek:    number;        // 1-indexed; > planned_weeks means complete
  phase:          MesoPhase;
  weekStartDate:  string;        // YYYY-MM-DD
  weekEndDate:    string;        // YYYY-MM-DD
  daysIntoWeek:   number;        // 0..6
  isDeloadWeek:   boolean;       // === phase === "deload"
};

const DELOAD_VOLUME_FRAC = 0.5;

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(yyyymmdd: string, days: number): string {
  const d = new Date(`${yyyymmdd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateOnly(d);
}

function diffDays(later: string, earlier: string): number {
  const a = new Date(`${later}T00:00:00Z`).getTime();
  const b = new Date(`${earlier}T00:00:00Z`).getTime();
  return Math.floor((a - b) / 86400000);
}

// Today's state inside the mesocycle.
export function getMesoState(meso: MesocycleRow, today: string): MesoState {
  const daysSinceStart = Math.max(0, diffDays(today, meso.start_date));
  const weekIdx0 = Math.floor(daysSinceStart / 7);              // 0-indexed
  const currentWeek = weekIdx0 + 1;
  const weekStartDate = addDays(meso.start_date, weekIdx0 * 7);
  const weekEndDate   = addDays(weekStartDate, 6);
  const daysIntoWeek  = daysSinceStart - weekIdx0 * 7;

  let phase: MesoPhase;
  if (currentWeek > meso.planned_weeks)      phase = "complete";
  else if (currentWeek === meso.planned_weeks) phase = "deload";
  else                                        phase = "accumulate";

  return {
    currentWeek,
    phase,
    weekStartDate,
    weekEndDate,
    daysIntoWeek,
    isDeloadWeek: phase === "deload",
  };
}

// Per-muscle set target for THIS week. Returns a SINGLE number — not a range.
//
//   normal:        linear ramp from mev to mrv across accumulation weeks
//   specialize:    mrv every accumulation week
//   maintenance:   mev every accumulation week
//   deload week:   round(mev * 0.5) regardless of priority
//
// All values rounded to integer sets.
export function targetForMuscle(
  muscle: string,
  mev: number,
  mrv: number,
  state: MesoState,
  priorities: Record<string, MusclePriority>,
  plannedWeeks: number,
): number {
  if (state.phase === "deload") return Math.max(1, Math.round(mev * DELOAD_VOLUME_FRAC));
  if (state.phase === "complete") return mrv;  // freeze at MRV until user starts a new meso

  const priority = priorities[muscle];
  if (priority === "specialize")  return mrv;
  if (priority === "maintenance") return mev;

  // Normal ramp over the accumulation weeks. plannedWeeks - 1 accumulation
  // weeks; week 1 = MEV, week (planned-1) = MRV.
  const accumWeeks = Math.max(1, plannedWeeks - 1);
  const t = (state.currentWeek - 1) / Math.max(1, accumWeeks - 1);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.round(mev + clamped * (mrv - mev));
}

// Convenience: given the same data, classify the muscle's current sets-done
// vs this week's target. "below", "near" (within ±1 set), "at-or-over".
export type WeekVolumeStatus = "below" | "near" | "at-or-over";
export function classifyWeekVolume(setsDone: number, weekTarget: number): WeekVolumeStatus {
  if (setsDone >= weekTarget)        return "at-or-over";
  if (setsDone >= weekTarget - 1)    return "near";
  return "below";
}

// How many days remain in the current week (1 = today is the last day; 7 = today is day 1).
export function daysRemainingInWeek(state: MesoState): number {
  return Math.max(0, 7 - state.daysIntoWeek);
}

// Should we auto-start a new mesocycle today? Triggered when the active one
// is past its planned end. The caller decides whether to act.
export function isPastPlannedEnd(meso: MesocycleRow, today: string): boolean {
  const state = getMesoState(meso, today);
  return state.phase === "complete";
}
