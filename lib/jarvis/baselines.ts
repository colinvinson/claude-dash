// Personal-baseline statistics for biometrics. Replaces absolute interpretation
// ("readiness 75/100") with relative interpretation ("75 is +0.4 stddev above
// your 30-day average — top quartile for you"). Everything downstream that
// reasons about biometrics gets the baseline, so Jarvis can phrase responses
// in personal terms.

export type Baseline = {
  metric: string;
  n: number;          // sample size in the window
  mean: number;
  stddev: number;
};

export type BaselinesMap = Record<string, Baseline>;

export type HealthRow = {
  readiness_score: number | null;
  hrv:             number | null;
  rhr:             number | null;
  sleep_score:     number | null;
  sleep_hours:     number | null;
  deep_min:        number | null;
  rem_min:         number | null;
};

// We require at least this many samples before a baseline is "valid" — too few
// and the mean/stddev wobble too much to be useful. Below the threshold, the
// caller should fall back to absolute scoring.
export const MIN_BASELINE_SAMPLES = 7;

function meanAndStddev(values: number[]): { mean: number; stddev: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, stddev: 0 };
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  return { mean, stddev: Math.sqrt(variance) };
}

export function computeBaselines(rows: HealthRow[]): BaselinesMap {
  const fields: Array<keyof HealthRow> = [
    "readiness_score", "hrv", "rhr", "sleep_score", "sleep_hours", "deep_min", "rem_min",
  ];
  const out: BaselinesMap = {};
  for (const f of fields) {
    const vals = rows.map((r) => r[f]).filter((v): v is number => typeof v === "number");
    const { mean, stddev } = meanAndStddev(vals);
    out[f] = { metric: f, n: vals.length, mean, stddev };
  }
  return out;
}

// Map a value to a 0..1 score factor based on how it compares to the user's
// own baseline. Returns null when the baseline isn't established yet so the
// caller can fall back to absolute scoring.
//
// Mapping (linear, clamped 0..1):
//   z = -2 → 0.10   bottom outlier, very bad day for you
//   z = -1 → 0.30   notably below your norm
//   z =  0 → 0.70   your typical day = "good"
//   z = +1 → 0.90
//   z ≥ +2 → 1.00   exceptional day
//
// This sets "your average" at 70% of max instead of 50% — it rewards being at
// or above your norm and penalizes dipping below, which matches how the
// "Crushing it / Steady / Lock in" thresholds (67 / 34) read.
//
// For inverted metrics (RHR, where lower is better) pass invert=true so the
// z-score sign is flipped before mapping.
export function zScoreToFactor(
  value: number,
  baseline: Baseline,
  opts?: { invert?: boolean },
): number | null {
  if (baseline.n < MIN_BASELINE_SAMPLES || baseline.stddev === 0) return null;
  let z = (value - baseline.mean) / baseline.stddev;
  if (opts?.invert) z = -z;
  return Math.max(0, Math.min(1, 0.7 + z * 0.2));
}

// Compact human label for use in chat context: "+0.6σ above your 30d norm of 72"
export function formatBaselineDelta(
  value: number,
  baseline: Baseline,
  opts?: { invert?: boolean; unit?: string },
): string | null {
  if (baseline.n < MIN_BASELINE_SAMPLES || baseline.stddev === 0) return null;
  let z = (value - baseline.mean) / baseline.stddev;
  if (opts?.invert) z = -z;
  const sign = z >= 0 ? "+" : "";
  const delta = value - baseline.mean;
  const deltaSign = delta >= 0 ? "+" : "";
  const unit = opts?.unit ?? "";
  return `${sign}${z.toFixed(1)}σ vs your ${baseline.n}d norm (${deltaSign}${delta.toFixed(1)}${unit} from avg ${baseline.mean.toFixed(1)}${unit})`;
}
