// Web Vibration API helper. Silently no-ops on devices that don't support it
// (iOS Safari doesn't, but it's a useful baseline on Android + future support).

export function haptic(pattern: "light" | "medium" | "heavy" | "success" = "light") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) return;
  const patterns: Record<string, number | number[]> = {
    light:   8,
    medium:  15,
    heavy:   25,
    success: [10, 30, 10],
  };
  navigator.vibrate(patterns[pattern]);
}
