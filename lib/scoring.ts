export type ScoreInputs = {
  goalsComplete: number;
  goalsTotal: number;
  readinessScore: number | null;
  workoutDoneToday: boolean;
  supplementsTaken: number;
  supplementsTotal: number;
  checkedIn: boolean;
};

export type ScoreResult = {
  score: number;
  accent: "red" | "amber" | "emerald";
  headline: "LOCK IN" | "STEADY" | "CRUSHING IT";
};

export function computeDailyScore(inputs: ScoreInputs): ScoreResult {
  const {
    goalsComplete, goalsTotal, readinessScore,
    workoutDoneToday, supplementsTaken, supplementsTotal, checkedIn,
  } = inputs;

  const goalPts  = goalsTotal > 0 ? (goalsComplete / goalsTotal) * 30 : 0;
  const readPts  = readinessScore != null ? (readinessScore / 100) * 25 : 12.5;
  const workPts  = workoutDoneToday ? 20 : 0;
  const suppPts  = supplementsTotal > 0 ? (supplementsTaken / supplementsTotal) * 15 : 0;
  const checkPts = checkedIn ? 10 : 0;

  const score = Math.round(goalPts + readPts + workPts + suppPts + checkPts);

  const accent: ScoreResult["accent"] =
    score >= 67 ? "emerald" : score >= 34 ? "amber" : "red";

  const headline: ScoreResult["headline"] =
    score >= 67 ? "CRUSHING IT" : score >= 34 ? "STEADY" : "LOCK IN";

  return { score, accent, headline };
}
