import { createServiceClient } from "@/lib/supabase/server";
import { computeDailyScore } from "@/lib/scoring";
import { computeRecoveryScore, computeSessionStrain } from "@/lib/fitness/recovery";
import { buildDailySnapshot } from "@/lib/ai/snapshot-builder";

function getLogDate() {
  const now = new Date();
  if (now.getHours() < 6) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

function dateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function trendDirection(values: (number | null)[]): "improving" | "declining" | "stable" {
  const valid = values.filter((v): v is number => v != null);
  if (valid.length < 3) return "stable";
  const half   = Math.floor(valid.length / 2);
  const first  = valid.slice(0, half);
  const second = valid.slice(half);
  const delta  = avg(second) - avg(first);
  if (delta > 2)  return "improving";
  if (delta < -2) return "declining";
  return "stable";
}

export async function buildContext(userId: string) {
  const supabase = createServiceClient();
  const today     = getLogDate();
  const yesterday = dateDaysAgo(1);
  const now       = new Date();

  const [
    goalsRes, stackRes, logsRes, medLogsRes, setsRes, streakRes,
    healthRes, yesterdaySetsRes,
    dailyCtxRes, waterRes, faithRes, moodRes, journalRes, ltGoalsRes,
    health7dRes, suppLogs14dRes, health14dRes, mood7dRes, goals7dRes,
    todaySetsRes,
    sets21dRes, medLogs21dRes, recentInsightsRes,
    proteinTodayRes, latestWeightRes,
  ] = await Promise.all([
    supabase.from("goals").select("title, is_complete, priority").eq("user_id", userId).eq("goal_date", today),
    supabase.from("supplement_stack").select("id, name, timing").eq("user_id", userId).eq("is_active", true),
    supabase.from("supplement_logs").select("supplement_id").eq("user_id", userId).eq("log_date", today),
    supabase.from("medication_logs").select("medication_type, taken_at").eq("user_id", userId).eq("log_date", today),
    supabase.from("workout_sets").select("weight_kg, reps, logged_at, exercises(name, split_day)").eq("user_id", userId).order("logged_at", { ascending: false }).limit(5),
    supabase.from("goal_streaks").select("current_streak").eq("user_id", userId).single(),
    supabase.from("health_logs").select("*").eq("user_id", userId).eq("date", today).single(),
    supabase.from("workout_sets").select("weight_kg, reps, logged_at, exercises(name, split_day)").eq("user_id", userId).gte("logged_at", `${yesterday}T00:00:00`).lte("logged_at", `${yesterday}T23:59:59`).order("logged_at", { ascending: false }).limit(6),
    supabase.from("daily_context").select("raw_text").eq("user_id", userId).eq("log_date", today).single(),
    supabase.from("water_logs").select("glasses").eq("user_id", userId).eq("log_date", today).single(),
    supabase.from("faith_logs").select("prayed, bible_min, church_attended").eq("user_id", userId).eq("log_date", today).single(),
    supabase.from("mood_logs").select("score").eq("user_id", userId).eq("log_date", today).order("logged_at", { ascending: false }).limit(1),
    supabase.from("journal_entries").select("content, ai_summary").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    supabase.from("long_term_goals").select("title, category, ai_action_plan").eq("user_id", userId).eq("is_active", true).limit(10),
    // Trend + correlation data
    supabase.from("health_logs").select("date, readiness_score, hrv, sleep_hours, deep_min").eq("user_id", userId).gte("date", dateDaysAgo(7)).order("date", { ascending: true }),
    supabase.from("supplement_logs").select("supplement_id, log_date").eq("user_id", userId).gte("log_date", dateDaysAgo(14)),
    supabase.from("health_logs").select("date, deep_min, hrv, readiness_score, sleep_hours").eq("user_id", userId).gte("date", dateDaysAgo(14)).order("date", { ascending: true }),
    supabase.from("mood_logs").select("score, log_date").eq("user_id", userId).gte("log_date", dateDaysAgo(7)).order("log_date", { ascending: true }),
    supabase.from("goals").select("title, is_complete, goal_date").eq("user_id", userId).gte("goal_date", dateDaysAgo(7)),
    supabase.from("workout_sets").select("weight_kg, reps, rpe, logged_at").eq("user_id", userId).eq("log_date", today),
    // Performance correlation data
    supabase.from("workout_sets").select("weight_kg, reps, rpe, est_1rm, log_date, exercises(name, muscle_group)").eq("user_id", userId).gte("log_date", dateDaysAgo(21)).order("log_date", { ascending: true }),
    supabase.from("medication_logs").select("medication_type, log_date").eq("user_id", userId).gte("log_date", dateDaysAgo(21)),
    supabase.from("jarvis_insights").select("body, severity, triggered_at").eq("user_id", userId).order("triggered_at", { ascending: false }).limit(5),
    supabase.from("protein_logs").select("protein_g, ai_score").eq("user_id", userId).eq("log_date", today),
    supabase.from("weight_logs").select("weight_kg").eq("user_id", userId).order("logged_at", { ascending: false }).limit(1),
  ]);

  const goals         = goalsRes.data ?? [];
  const stack         = stackRes.data ?? [];
  const logs          = logsRes.data ?? [];
  const medLogs       = medLogsRes.data ?? [];
  const sets          = setsRes.data ?? [];
  const yesterdaySets = yesterdaySetsRes.data ?? [];
  const health        = healthRes.data;

  const hour = now.getHours();
  const min  = now.getMinutes();
  const awakeStart = 8;
  const awakeEnd   = 24;
  const elapsed    = Math.max(0, (hour - awakeStart) * 60 + min);
  const totalAwake = (awakeEnd - awakeStart) * 60;
  const pctDay     = Math.round((elapsed / totalAwake) * 100);

  // Generic medication log surface — every medication_type taken today, with counts.
  // No hardcoded biases toward specific substances; whatever Sir actually logged shows up.
  const medsTodayMap = new Map<string, { count: number; firstAt: string | null }>();
  for (const l of medLogs) {
    const type = l.medication_type;
    if (!type) continue;
    const cur = medsTodayMap.get(type) ?? { count: 0, firstAt: null };
    cur.count += 1;
    if (!cur.firstAt && l.taken_at) cur.firstAt = l.taken_at;
    medsTodayMap.set(type, cur);
  }
  const medsToday = Array.from(medsTodayMap.entries()).map(([type, v]) => ({
    type,
    count: v.count,
    firstAt: v.firstAt ? new Date(v.firstAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
  }));

  const supplementsTaken  = stack.filter((s) => logs.some((l) => l.supplement_id === s.id)).map((s) => s.name);
  const supplementsMissed = stack.filter((s) => !logs.some((l) => l.supplement_id === s.id)).map((s) => ({ name: s.name, timing: s.timing }));

  // Build yesterday's workout summary for CNS load context
  type SetRow = { weight_kg: number; reps: number; logged_at: string; exercises: unknown };
  const yesterdayWorkoutSummary = yesterdaySets.length > 0
    ? yesterdaySets.map((s: SetRow) => {
        const ex = s.exercises as { name: string; split_day: string } | null;
        return `${ex?.name ?? "unknown"} ${s.weight_kg}kg×${s.reps}`;
      }).join(", ")
    : null;

  const yesterdaySplitDay = yesterdaySets.length > 0
    ? (yesterdaySets[0] as SetRow & { exercises: { split_day?: string } | null }).exercises?.split_day ?? null
    : null;

  // Health biometrics section — only included when Oura data exists
  const biometrics = health ? {
    readiness: health.readiness_score != null
      ? `${health.readiness_score}/100 (${health.readiness_label ?? "—"})`
      : null,
    hrv:          health.hrv     != null ? `${health.hrv}ms`     : null,
    rhr:          health.rhr     != null ? `${health.rhr}bpm`    : null,
    sleep:        health.sleep_score  != null ? `${health.sleep_score}/100` : null,
    sleepHours:   health.sleep_hours  != null ? `${health.sleep_hours}h`   : null,
    rem:          health.rem_min  != null ? `${health.rem_min}min`  : null,
    deep:         health.deep_min != null ? `${health.deep_min}min` : null,
    activity:     health.activity_score != null ? `${health.activity_score}/100` : null,
    respRate:     health.resp_rate != null ? `${health.resp_rate}/min` : null,
    isFinal:      health.is_final,
  } : null;

  // Cross-domain interpretation hints for the AI. No hardcoded substance assumptions
  // anymore — pass through what Sir actually logged and let Claude reason over it
  // using the (now generic) health-interpretation rules in the system prompt.
  const behavioralContext = {
    medsToday,
    supplementsTaken,
    supplementsMissed,
    yesterdayWorkout: yesterdayWorkoutSummary,
    yesterdaySplit:   yesterdaySplitDay,
    yesterdayNote:    yesterdaySplitDay
      ? `${yesterdaySplitDay} day yesterday — expect elevated muscle damage markers and possible HRV suppression today, especially after Leg/Pull days (high CNS demand).`
      : null,
  };

  // ── Trend computation ──────────────────────────────────────────────────
  type HealthRow = { date: string; readiness_score: number | null; hrv: number | null; sleep_hours: number | null; deep_min: number | null };
  const h7d = (health7dRes.data ?? []) as HealthRow[];
  const h14d = (health14dRes.data ?? []) as HealthRow[];

  const hrv7d       = h7d.map((r) => r.hrv);
  const ready7d     = h7d.map((r) => r.readiness_score);
  const sleep7d     = h7d.map((r) => r.sleep_hours);
  const deep7d      = h7d.map((r) => r.deep_min);
  const moodScores  = ((mood7dRes.data ?? []) as Array<{ score: number; log_date: string }>).map((r) => r.score);

  const validHrv    = hrv7d.filter((v): v is number => v != null);
  const validReady  = ready7d.filter((v): v is number => v != null);
  const validSleep  = sleep7d.filter((v): v is number => v != null);
  const validDeep   = deep7d.filter((v): v is number => v != null);

  // Declining streak: how many consecutive days has metric been falling?
  function decliningStreak(values: (number | null)[]): number {
    const valid = [...values].reverse().filter((v): v is number => v != null);
    let streak = 0;
    for (let i = 0; i < valid.length - 1; i++) {
      if (valid[i] < valid[i + 1]) streak++;
      else break;
    }
    return streak;
  }

  const trends = {
    hrv: {
      values:    hrv7d,
      avg7d:     validHrv.length > 0   ? Math.round(avg(validHrv))   : null,
      direction: trendDirection(hrv7d),
      decliningDays: decliningStreak(hrv7d),
    },
    readiness: {
      values:    ready7d,
      avg7d:     validReady.length > 0  ? Math.round(avg(validReady)) : null,
      direction: trendDirection(ready7d),
      decliningDays: decliningStreak(ready7d),
    },
    sleep: {
      avg7d_hours: validSleep.length > 0 ? Math.round(avg(validSleep) * 10) / 10 : null,
      avg7d_deep:  validDeep.length  > 0 ? Math.round(avg(validDeep))            : null,
      direction:   trendDirection(sleep7d),
    },
    mood: {
      avg7d:     moodScores.length > 0 ? Math.round(avg(moodScores) * 10) / 10 : null,
      direction: trendDirection(moodScores),
    },
  };

  // ── Supplement correlations ─────────────────────────────────────────────
  type SuppLog14 = { supplement_id: string; log_date: string };
  const suppLogs14 = (suppLogs14dRes.data ?? []) as SuppLog14[];

  const correlations: string[] = [];

  // HRV declining streak note
  if (trends.hrv.decliningDays >= 3) {
    const series = validHrv.slice(-trends.hrv.decliningDays - 1).join("→");
    correlations.push(`HRV declining ${trends.hrv.decliningDays} days straight: ${series}ms`);
  }
  if (trends.readiness.decliningDays >= 3) {
    correlations.push(`Readiness declining ${trends.readiness.decliningDays} days straight`);
  }

  // Per-supplement deep sleep correlation
  for (const supp of stack) {
    const takenDates  = new Set(suppLogs14.filter((l) => l.supplement_id === supp.id).map((l) => l.log_date));
    const daysWith    = h14d.filter((r) => takenDates.has(r.date) && r.deep_min != null).map((r) => r.deep_min as number);
    const daysWithout = h14d.filter((r) => !takenDates.has(r.date) && r.deep_min != null).map((r) => r.deep_min as number);
    if (daysWith.length >= 2 && daysWithout.length >= 2) {
      const withAvg    = Math.round(avg(daysWith));
      const withoutAvg = Math.round(avg(daysWithout));
      const delta      = withAvg - withoutAvg;
      if (Math.abs(delta) >= 15) {
        correlations.push(
          `${supp.name}: deep sleep avg ${withAvg}min (taken) vs ${withoutAvg}min (skipped) — ${delta > 0 ? "better with" : "worse with"} this supplement (${daysWith.length + daysWithout.length} data points)`
        );
      }
    }
  }

  // ── Performance correlations (lifting × everything else) ─────────────────
  type SetRow21 = {
    weight_kg: number;
    reps: number;
    rpe: number | null;
    est_1rm: number;
    log_date: string;
    exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] | null;
  };
  const sets21 = (sets21dRes.data ?? []) as unknown as SetRow21[];

  // Daily session map: log_date → { volume, avgRpe, sets[], bestEst1RM }
  type DaySession = { volume: number; sets: SetRow21[]; bestEst1rm: number; avgReps: number; avgRpe: number | null };
  const sessionsByDate = new Map<string, DaySession>();
  for (const s of sets21) {
    const entry = sessionsByDate.get(s.log_date) ?? { volume: 0, sets: [], bestEst1rm: 0, avgReps: 0, avgRpe: null };
    entry.volume   += s.weight_kg * s.reps;
    entry.sets.push(s);
    entry.bestEst1rm = Math.max(entry.bestEst1rm, s.est_1rm);
    sessionsByDate.set(s.log_date, entry);
  }
  for (const [date, ds] of sessionsByDate) {
    ds.avgReps = ds.sets.reduce((sum, s) => sum + s.reps, 0) / ds.sets.length;
    const rpeVals = ds.sets.map((s) => s.rpe).filter((v): v is number => v != null);
    ds.avgRpe = rpeVals.length > 0 ? rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length : null;
    sessionsByDate.set(date, ds);
  }

  // Build date → health lookup (we have h14d already)
  const healthByDate = new Map(h14d.map((h) => [h.date, h]));

  // ── Readiness → volume correlation ────────────────────────────────────
  const highRecDays: { date: string; volume: number }[] = [];
  const lowRecDays:  { date: string; volume: number }[] = [];
  for (const [date, ds] of sessionsByDate) {
    const h = healthByDate.get(date);
    if (!h?.readiness_score) continue;
    if (h.readiness_score >= 70) highRecDays.push({ date, volume: ds.volume });
    else if (h.readiness_score < 55) lowRecDays.push({ date, volume: ds.volume });
  }

  let recoveryEffect: string | null = null;
  if (highRecDays.length >= 2 && lowRecDays.length >= 2) {
    const highAvg = Math.round(avg(highRecDays.map((d) => d.volume)));
    const lowAvg  = Math.round(avg(lowRecDays.map((d) => d.volume)));
    const pctDiff = lowAvg > 0 ? Math.round(((highAvg - lowAvg) / lowAvg) * 100) : 0;
    if (Math.abs(pctDiff) >= 10) {
      recoveryEffect = `Readiness≥70 days avg ${highAvg.toLocaleString()}kg volume vs ${lowAvg.toLocaleString()}kg on readiness<55 days (${pctDiff > 0 ? "+" : ""}${pctDiff}%, ${highRecDays.length + lowRecDays.length} sessions)`;
    }
  }

  // ── Sleep → next-session reps correlation ─────────────────────────────
  const goodSleepReps: number[] = [];
  const poorSleepReps: number[] = [];
  for (const [date, ds] of sessionsByDate) {
    const h = healthByDate.get(date);
    if (!h?.sleep_hours) continue;
    if (h.sleep_hours >= 7) goodSleepReps.push(ds.avgReps);
    else if (h.sleep_hours < 6.5) poorSleepReps.push(ds.avgReps);
  }

  let sleepEffect: string | null = null;
  if (goodSleepReps.length >= 2 && poorSleepReps.length >= 2) {
    const goodAvg = Math.round(avg(goodSleepReps) * 10) / 10;
    const poorAvg = Math.round(avg(poorSleepReps) * 10) / 10;
    const delta   = Math.round((goodAvg - poorAvg) * 10) / 10;
    if (Math.abs(delta) >= 0.8) {
      sleepEffect = `After <6.5h sleep, avg ${poorAvg} reps/set vs ${goodAvg} after ≥7h sleep (${delta > 0 ? "+" : ""}${delta} rep gap, ${goodSleepReps.length + poorSleepReps.length} sessions)`;
    }
  }

  // ── Supplement → next-day workout volume correlation ──────────────────
  const supplementEffects: string[] = [];
  for (const supp of stack) {
    const takenDates = new Set(
      suppLogs14.filter((l) => l.supplement_id === supp.id).map((l) => l.log_date)
    );
    const sessionsWith:    number[] = [];
    const sessionsWithout: number[] = [];
    for (const [date, ds] of sessionsByDate) {
      // Same-day supp adherence vs same-day workout volume
      if (takenDates.has(date)) sessionsWith.push(ds.volume);
      else sessionsWithout.push(ds.volume);
    }
    if (sessionsWith.length >= 3 && sessionsWithout.length >= 3) {
      const withAvg    = Math.round(avg(sessionsWith));
      const withoutAvg = Math.round(avg(sessionsWithout));
      const pct        = withoutAvg > 0 ? Math.round(((withAvg - withoutAvg) / withoutAvg) * 100) : 0;
      if (Math.abs(pct) >= 15) {
        supplementEffects.push(
          `${supp.name}: avg ${withAvg.toLocaleString()}kg volume on days taken vs ${withoutAvg.toLocaleString()}kg skipped (${pct > 0 ? "+" : ""}${pct}%, ${sessionsWith.length + sessionsWithout.length} sessions)`
        );
      }
    }
  }

  // ── Generic per-medication → workout volume effect ────────────────────
  // No hardcoded substance — computes the volume delta for every medication_type
  // that has ≥3 sessions on/off in the 21-day window, with ≥15% spread.
  const medLogs21 = (medLogs21dRes.data ?? []) as Array<{ medication_type: string; log_date: string }>;
  const datesByMed = new Map<string, Set<string>>();
  for (const m of medLogs21) {
    if (!m.medication_type) continue;
    const set = datesByMed.get(m.medication_type) ?? new Set();
    set.add(m.log_date);
    datesByMed.set(m.medication_type, set);
  }
  const medicationEffects: string[] = [];
  for (const [medType, takenDates] of datesByMed) {
    const sessionsOn:  number[] = [];
    const sessionsOff: number[] = [];
    for (const [date, ds] of sessionsByDate) {
      if (takenDates.has(date)) sessionsOn.push(ds.volume);
      else sessionsOff.push(ds.volume);
    }
    if (sessionsOn.length >= 3 && sessionsOff.length >= 3) {
      const onAvg  = Math.round(avg(sessionsOn));
      const offAvg = Math.round(avg(sessionsOff));
      const pct    = offAvg > 0 ? Math.round(((onAvg - offAvg) / offAvg) * 100) : 0;
      if (Math.abs(pct) >= 15) {
        medicationEffects.push(
          `${medType}: ${onAvg.toLocaleString()}kg avg session volume on days taken vs ${offAvg.toLocaleString()}kg off (${pct > 0 ? "+" : ""}${pct}%, ${sessionsOn.length + sessionsOff.length} sessions)`
        );
      }
    }
  }

  // ── Per-exercise progression (PRs + stalls) ───────────────────────────
  const byExercise = new Map<string, { dates: string[]; est1rms: number[]; weights: number[] }>();
  for (const s of sets21) {
    const ex = Array.isArray(s.exercises) ? s.exercises[0] : s.exercises;
    if (!ex) continue;
    const entry = byExercise.get(ex.name) ?? { dates: [], est1rms: [], weights: [] };
    // Track best est_1rm per session
    const existingIdx = entry.dates.indexOf(s.log_date);
    if (existingIdx === -1) {
      entry.dates.push(s.log_date);
      entry.est1rms.push(s.est_1rm);
      entry.weights.push(s.weight_kg);
    } else if (s.est_1rm > entry.est1rms[existingIdx]) {
      entry.est1rms[existingIdx] = s.est_1rm;
      entry.weights[existingIdx] = s.weight_kg;
    }
    byExercise.set(ex.name, entry);
  }

  const prsThisWeek:  string[] = [];
  const stalled:      string[] = [];
  const sevenAgo      = dateDaysAgo(7);
  for (const [name, data] of byExercise) {
    if (data.est1rms.length < 3) continue;
    const recent = data.est1rms[data.est1rms.length - 1];
    const first  = data.est1rms[0];
    const prevBest = Math.max(...data.est1rms.slice(0, -1));
    const recentDate = data.dates[data.dates.length - 1];

    // PR: last session beat all prior sessions in window AND happened this week
    if (recent > prevBest && recentDate >= sevenAgo) {
      prsThisWeek.push(`${name} (${data.weights[data.weights.length - 1]}kg → est. 1RM ${Math.round(recent)}kg)`);
    }

    // Stalled: 3+ sessions, recent within 2% of first
    if (data.est1rms.length >= 3 && Math.abs(recent - first) / first < 0.02) {
      stalled.push(`${name} (${data.est1rms.length} sessions, est. 1RM ~${Math.round(recent)}kg)`);
    }
  }

  const performance = {
    recoveryEffect,
    sleepEffect,
    supplementEffects,
    medicationEffects,
    prsThisWeek,
    stalled,
    sessionsIn21d: sessionsByDate.size,
  };

  // ── Autonomous discovery layer: 21-day daily snapshot as CSV table ────
  // The Jarvis scans this for correlations we didn't hard-code (including
  // new metrics added later — they're auto-included via snapshot-builder).
  const snapshot = await buildDailySnapshot(supabase, userId, 21);

  // ── Goal patterns ───────────────────────────────────────────────────────
  type GoalRow = { title: string; is_complete: boolean; goal_date: string };
  const goals7d = (goals7dRes.data ?? []) as GoalRow[];

  const goalMap = new Map<string, { total: number; complete: number }>();
  for (const g of goals7d) {
    const entry = goalMap.get(g.title) ?? { total: 0, complete: 0 };
    entry.total++;
    if (g.is_complete) entry.complete++;
    goalMap.set(g.title, entry);
  }

  const consistentlyMissed = [...goalMap.entries()]
    .filter(([, v]) => v.total >= 3 && v.complete / v.total < 0.5)
    .map(([title, v]) => `"${title}" (${v.complete}/${v.total} days)`);

  const totalDays7d    = new Set(goals7d.map((g) => g.goal_date)).size;
  const highPerfDays   = totalDays7d > 0
    ? [...new Set(goals7d.map((g) => g.goal_date))].filter((date) => {
        const dayGoals = goals7d.filter((g) => g.goal_date === date);
        return dayGoals.length > 0 && dayGoals.filter((g) => g.is_complete).length / dayGoals.length >= 0.8;
      }).length
    : 0;

  const goalPatterns = {
    winRate7d: totalDays7d > 0 ? `${highPerfDays}/${totalDays7d} days 80%+ complete` : null,
    consistentlyMissed,
  };

  // ── Recovery + strain ────────────────────────────────────────────────
  const todaySetsForStrain = (todaySetsRes.data ?? []) as Array<{ weight_kg: number; reps: number; rpe: number | null; logged_at: string }>;
  const strainToday = computeSessionStrain(todaySetsForStrain);

  const recoveryResult = health
    ? computeRecoveryScore(
        {
          readiness_score:  health.readiness_score,
          hrv:              health.hrv,
          sleep_score:      health.sleep_score,
          sleep_hours:      health.sleep_hours,
          resilience_level: health.resilience_level ?? null,
        },
        trends.hrv.avg7d
      )
    : null;

  const lastSetLoggedAt = todaySetsForStrain.length > 0
    ? new Date(Math.max(...todaySetsForStrain.map((s) => new Date(s.logged_at).getTime())))
    : null;
  const hoursSinceWorkout = lastSetLoggedAt
    ? Math.round(((Date.now() - lastSetLoggedAt.getTime()) / (1000 * 60 * 60)) * 10) / 10
    : null;

  const recovery = recoveryResult ? {
    score:           recoveryResult.score,
    band:            recoveryResult.band,
    drivers:         recoveryResult.drivers,
    resilienceLevel: health?.resilience_level ?? null,
    strainToday:     strainToday > 0 ? strainToday : null,
    hoursSinceWorkout,
    stressDaySummary: health?.stress_day_summary ?? null,
    vo2Max:          health?.vo2_max ?? null,
  } : null;

  const goalsComplete = goals.filter((g) => g.is_complete).length;
  const suppsTaken = stack.filter((s) => logs.some((l) => l.supplement_id === s.id)).length;

  // Protein for the score: sum today's grams, target = bodyweight × 2 (matches useProtein default).
  const proteinTodayG = ((proteinTodayRes.data ?? []) as Array<{ protein_g: number }>)
    .reduce((sum, r) => sum + Number(r.protein_g), 0);
  const latestWeightKg = (latestWeightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null;
  const proteinTargetG = latestWeightKg ? Math.round(latestWeightKg * 2.0) : 150;

  const dailyScore = computeDailyScore({
    goalsComplete,
    goalsTotal: goals.length,
    readinessScore: health?.readiness_score ?? null,
    workoutDoneToday: sets.length > 0,
    supplementsTaken: suppsTaken,
    supplementsTotal: stack.length,
    checkedIn: !!dailyCtxRes.data?.raw_text,
    proteinPct:    proteinTargetG > 0 ? proteinTodayG / proteinTargetG : null,
    proteinTarget: proteinTargetG,
  });

  return {
    date:        today,
    time:        `${hour}:${min.toString().padStart(2, "0")}`,
    dayProgress: `${pctDay}% through awake time (${awakeStart}AM–12AM)`,
    goals: {
      total:    goals.length,
      complete: goalsComplete,
      pending:  goals.filter((g) => !g.is_complete).map((g) => g.title),
      streak:   streakRes.data?.current_streak ?? 0,
    },
    biometrics,
    behavioralContext,
    recentWorkoutToday: sets.slice(0, 3).map((s) => {
      const ex = s.exercises as unknown as { name: string; split_day: string } | null;
      return { exercise: ex?.name ?? "unknown", split: ex?.split_day, weight: s.weight_kg, reps: s.reps };
    }),
    lifestyle: (() => {
      const proteinToday = ((proteinTodayRes.data ?? []) as Array<{ protein_g: number; ai_score: number | null }>)
        .reduce((sum, r) => sum + Number(r.protein_g), 0);
      const latestWeight = (latestWeightRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null;
      const proteinTarget = latestWeight ? Math.round(latestWeight * 2.0) : 150;
      return {
        dailyPlan:     dailyCtxRes.data?.raw_text ?? null,
        waterGlasses:  waterRes.data?.glasses ?? 0,
        faith:         faithRes.data ?? null,
        latestMood:    (moodRes.data as Array<{ score: number }> | null)?.[0]?.score ?? null,
        proteinToday:  Math.round(proteinToday),
        proteinTarget,
        proteinPct:    proteinTarget > 0 ? Math.round((proteinToday / proteinTarget) * 100) : 0,
      };
    })(),
    journal:       (journalRes.data ?? []) as Array<{ content: string; ai_summary: string | null }>,
    longTermGoals: (ltGoalsRes.data ?? []) as Array<{ title: string; category: string; ai_action_plan: string | null }>,
    dailyScore,
    trends,
    correlations,
    goalPatterns,
    recovery,
    performance,
    dailySnapshot: {
      windowDays: 21,
      columns: snapshot.columns,
      csv: snapshot.csv,
    },
    recentInsights: ((recentInsightsRes.data ?? []) as Array<{ body: string; severity: string; triggered_at: string }>).map((r) => ({
      body: r.body,
      severity: r.severity,
      hoursAgo: Math.round((Date.now() - new Date(r.triggered_at).getTime()) / (1000 * 60 * 60) * 10) / 10,
    })),
  };
}
