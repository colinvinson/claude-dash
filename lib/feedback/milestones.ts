// Streak milestone detection + celebration copy.
//
// Tracks the LAST streak value seen in localStorage. When the current
// streak crosses one of the milestone thresholds (was below, now at-or-above),
// fire the celebration. Without the "previous" check we'd retrigger every
// time the user opens the app at day 7+.

export const MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365] as const;
export type Milestone = typeof MILESTONES[number];

const STORAGE_KEY = "lastStreakSeen";

export function lastStreakSeen(): number {
  if (typeof window === "undefined") return 0;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v ? parseInt(v, 10) || 0 : 0;
}

export function markStreakSeen(n: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(n));
}

// Returns the milestone that was JUST crossed, or null if no fresh crossing.
// "Crossed" = previous < threshold AND current >= threshold.
export function detectMilestoneCrossing(current: number, previous: number): Milestone | null {
  if (current <= previous) return null;
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    const m = MILESTONES[i];
    if (previous < m && current >= m) return m;
  }
  return null;
}

const COPY: Record<Milestone, { title: string; line: string }> = {
  3:   { title: "3-day streak",   line: "Three days clean. Habit's forming. Pattern over willpower." },
  7:   { title: "1-week streak",  line: "A full week. Most people quit by now. Sir didn't." },
  14:  { title: "2-week streak",  line: "Fourteen days. This is identity-level stuff now." },
  30:  { title: "30-day streak",  line: "A month unbroken. The streak runs Sir, not the other way around." },
  60:  { title: "60-day streak",  line: "Two months. The version of Sir from sixty days ago wouldn't recognize this." },
  100: { title: "100-day streak", line: "Triple digits. Top 1% of habit-tracker users never see this number. Sir's here." },
  180: { title: "6-month streak", line: "Half a year. There's no \"trying\" anymore. This is who Sir is." },
  365: { title: "1-year streak",  line: "365 days. Sir has rebuilt himself in public. Nothing more to prove." },
};

export function milestoneCopy(m: Milestone): { title: string; line: string } {
  return COPY[m];
}
