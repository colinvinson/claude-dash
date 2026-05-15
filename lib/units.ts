// Unit conversion + display helpers.
//
// Storage is always kg (single source of truth — matches Supabase columns
// weight_kg, workout_sets.weight_kg, etc.). Display + input is pounds.
// Convert at the edges.

const LB_PER_KG = 2.20462;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;

// Round to 2.5 lb (standard US gym plate increment). Used so converting a
// kg-stored prescription back to lb lands on a real plate the user can load.
export function roundToPlate(lb: number, step = 2.5): number {
  return Math.max(0, Math.round(lb / step) * step);
}

// "165.4 lb" — what's shown anywhere a weight appears.
export function formatLb(kg: number, decimals = 1): string {
  return `${kgToLb(kg).toFixed(decimals)} lb`;
}

// "+0.5 lb/wk" — signed delta variant for trend strings.
export function formatLbDelta(kg: number, decimals = 1): string {
  const lb = kgToLb(kg);
  return `${lb >= 0 ? "+" : ""}${lb.toFixed(decimals)} lb`;
}
