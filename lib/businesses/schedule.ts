// Schedule helpers — pure functions used by both the cron route (to
// compute next_run_at after a dispatch) and the BusinessAgents UI (to
// preview "next run: tomorrow at 9am" inline).
//
// Schedule kinds keep deliberately simple. "Daily at 9am", "Mondays at
// 9am", "1st of month at 9am". Anything weirder belongs in a real cron
// editor — for v1 we cover 95% of what Sir would actually want.

export type ScheduleKind = "none" | "daily" | "weekly" | "monthly";

export type Schedule = {
  kind:  ScheduleKind;
  hour?: number;   // 0-23
  dow?:  number;   // 0=Sun..6=Sat — only for weekly
  dom?:  number;   // 1-28      — only for monthly
};

// Compute the next ISO timestamp this schedule should fire, strictly AFTER
// the given "from" instant. Returns null for kind="none".
export function nextRunAfter(s: Schedule, from: Date = new Date()): Date | null {
  if (s.kind === "none") return null;
  const hour = s.hour ?? 9;
  const candidate = new Date(from);
  candidate.setSeconds(0, 0);
  candidate.setHours(hour, 0, 0, 0);

  if (s.kind === "daily") {
    if (candidate <= from) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }

  if (s.kind === "weekly") {
    const targetDow = s.dow ?? 1;
    const curDow    = candidate.getDay();
    let delta       = (targetDow - curDow + 7) % 7;
    if (delta === 0 && candidate <= from) delta = 7;
    candidate.setDate(candidate.getDate() + delta);
    return candidate;
  }

  if (s.kind === "monthly") {
    const targetDom = s.dom ?? 1;
    candidate.setDate(targetDom);
    if (candidate <= from) {
      candidate.setMonth(candidate.getMonth() + 1);
      candidate.setDate(targetDom);
    }
    return candidate;
  }

  return null;
}

// Render a friendly preview for the UI ("Mondays at 9am", "Daily at 8pm").
export function describeSchedule(s: Schedule): string {
  if (s.kind === "none") return "manual only";
  const hour = s.hour ?? 9;
  const h12  = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? "am" : "pm";
  const time = `${h12}${ampm}`;
  if (s.kind === "daily") return `daily at ${time}`;
  if (s.kind === "weekly") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[s.dow ?? 1]}s at ${time}`;
  }
  if (s.kind === "monthly") {
    const d = s.dom ?? 1;
    const suffix = d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th";
    return `${d}${suffix} of each month at ${time}`;
  }
  return "manual only";
}
