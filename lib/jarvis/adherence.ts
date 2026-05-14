import type { SupabaseClient } from "@supabase/supabase-js";

// Server-side adherence summary for Jarvis chat context. Surfaces three things:
//   1. items whose adherence DROPPED week-over-week (drift signal — flag proactively)
//   2. items with broken streaks today (was the user on a roll?)
//   3. items doing great (long streaks — quiet positive reinforcement)
//
// Output is a compact text block injected into the dynamic system-prompt
// section so Jarvis can reason over it without us pre-computing every angle.

type StackRow = {
  id: string;
  name: string;
  days_of_week: number[] | null;
};

type LogRow = {
  supplement_id: string;
  log_date: string;
};

function ymd(d: Date): string {
  return d.toISOString().split("T")[0];
}

function scheduledOn(dow: number, days: number[] | null): boolean {
  if (!days || days.length === 0 || days.length === 7) return true;
  return days.includes(dow);
}

type ItemStats = {
  name: string;
  streak: number;
  done7d: number;
  expected7d: number;
  donePrev7d: number;
  expectedPrev7d: number;
};

function statsFor(item: StackRow, loggedDates: Set<string>, today: Date): ItemStats {
  // Streak — walk back from yesterday until a scheduled day is missed.
  let streak = 0;
  for (let i = 1; i <= 90; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (!scheduledOn(d.getDay(), item.days_of_week)) continue;
    if (loggedDates.has(ymd(d))) streak += 1;
    else break;
  }

  // Trailing 7 (incl today) and prior 7 (days 7-13 back).
  let done7d = 0, expected7d = 0, donePrev7d = 0, expectedPrev7d = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (!scheduledOn(d.getDay(), item.days_of_week)) continue;
    expected7d += 1;
    if (loggedDates.has(ymd(d))) done7d += 1;
  }
  for (let i = 7; i < 14; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (!scheduledOn(d.getDay(), item.days_of_week)) continue;
    expectedPrev7d += 1;
    if (loggedDates.has(ymd(d))) donePrev7d += 1;
  }

  return { name: item.name, streak, done7d, expected7d, donePrev7d, expectedPrev7d };
}

export async function buildAdherenceSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const today = new Date();
  const since = new Date(today);
  since.setDate(since.getDate() - 30);

  const [stackRes, logsRes] = await Promise.all([
    supabase
      .from("supplement_stack")
      .select("id, name, days_of_week")
      .eq("user_id", userId)
      .eq("is_active", true),
    supabase
      .from("supplement_logs")
      .select("supplement_id, log_date")
      .eq("user_id", userId)
      .gte("log_date", ymd(since)),
  ]);

  const stack: StackRow[] = stackRes.data ?? [];
  const logs:  LogRow[]   = logsRes.data ?? [];
  if (stack.length === 0) return "(no routine items)";

  // Index logs by item
  const byItem = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!byItem.has(l.supplement_id)) byItem.set(l.supplement_id, new Set());
    byItem.get(l.supplement_id)!.add(l.log_date);
  }

  const stats = stack.map((s) => statsFor(s, byItem.get(s.id) ?? new Set(), today));

  // Drift: items where the prior week was clearly better than this week.
  // Threshold: at least 2 expected days both weeks; delta >= 2 missed.
  const drift = stats
    .filter((s) => s.expected7d >= 2 && s.expectedPrev7d >= 2)
    .filter((s) => s.donePrev7d - s.done7d >= 2)
    .sort((a, b) => (b.donePrev7d - b.done7d) - (a.donePrev7d - a.done7d));

  // Hot streaks: long-running adherence worth noting.
  const hot = stats.filter((s) => s.streak >= 7).sort((a, b) => b.streak - a.streak);

  // Cold: zero-done this week despite being scheduled multiple times.
  const cold = stats.filter((s) => s.expected7d >= 3 && s.done7d === 0);

  const lines: string[] = [];
  if (drift.length > 0) {
    lines.push("Trending DOWN week-over-week:");
    for (const s of drift.slice(0, 4)) {
      lines.push(`  ↘ ${s.name}: ${s.done7d}/${s.expected7d} (was ${s.donePrev7d}/${s.expectedPrev7d})`);
    }
  }
  if (cold.length > 0) {
    lines.push("Not done at all this week:");
    for (const s of cold.slice(0, 4)) {
      lines.push(`  ✕ ${s.name} (${s.expected7d} scheduled days)`);
    }
  }
  if (hot.length > 0) {
    lines.push("Long streaks:");
    for (const s of hot.slice(0, 3)) {
      lines.push(`  🔥 ${s.name}: ${s.streak} days`);
    }
  }

  return lines.length === 0
    ? "(adherence steady — no notable drift or hot streaks)"
    : lines.join("\n");
}
