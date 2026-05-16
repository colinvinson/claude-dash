// Haptic feedback shims. Safe to call from anywhere — no-ops on platforms
// that don't expose the Vibration API (most desktop browsers, iOS Safari).
// The PWA shell on Android + Chromium will buzz.

type Pattern = "tap" | "success" | "milestone" | "warning";

const PATTERNS: Record<Pattern, number | number[]> = {
  tap:       15,                    // single soft buzz on every tap action
  success:   [10, 30, 30],          // double-pulse — "yes that worked"
  milestone: [30, 60, 30, 60, 30],  // celebratory longer burst
  warning:   [60, 30, 60],
};

export function haptic(pattern: Pattern = "tap"): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean };
  if (typeof nav.vibrate !== "function") return;
  try { nav.vibrate(PATTERNS[pattern]); } catch {}
}
