// Daily snapshot builder — wide-format time-series for autonomous AI pattern detection.
//
// Each row in the returned snapshot is one calendar date with ALL tracked metrics.
// The Jarvis scans this for correlations we didn't hard-code.
//
// TO ADD A NEW DAILY METRIC:
//   1. Add a Supabase query to METRIC_QUERIES below (must be daily-keyed).
//   2. Add a row mapper in buildDailySnapshot that pulls from the query result.
//   3. That's it — Jarvis will pick it up automatically.

import type { SupabaseClient } from "@supabase/supabase-js";

export type DaySnapshot = {
  date: string;
  // health
  readiness:        number | null;
  hrv:              number | null;
  rhr:              number | null;
  sleep_score:      number | null;
  sleep_hours:      number | null;
  rem_min:          number | null;
  deep_min:         number | null;
  light_min:        number | null;
  awake_min:        number | null;
  spo2_pct:         number | null;
  resp_rate:        number | null;
  skin_temp_delta:  number | null;
  stress_high_min:  number | null;  // converted seconds → minutes for readability
  recovery_high_min: number | null;
  resilience_level: string | null;
  vo2_max:          number | null;
  // lifestyle
  water_glasses:    number | null;
  meditation_min:   number | null;
  mood:             number | null;
  alcohol_drinks:   number | null;
  weight_kg:        number | null;
  prayed:           0 | 1 | null;
  bible_min:        number | null;
  church:           0 | 1 | null;
  // meds — generic per-medication-type counts emitted as `med_<type>` keys
  // (filled in via dynamic indexer below — see slug rules in row builder).
  [medCountKey: `med_${string}`]: number | null;
  // training
  workout_volume_kg: number | null;
  workout_sets:      number | null;
  workout_avg_rpe:   number | null;
  workout_max_1rm:   number | null;
  workout_split:     string | null;
  // goals
  goals_total:       number | null;
  goals_complete:    number | null;
  goals_complete_pct: number | null;
  // nutrition
  protein_g:         number | null;
  meal_score_avg:    number | null;
  meals_logged:      number | null;
  // 9 new dimensions (migration 0024) — per-day aggregates feed the
  // autonomous correlation engine. Missing here = invisible to Jarvis's
  // 21-day pattern-discovery scan.
  focus_min:         number | null;
  social_count:      number | null;
  cardio_min:        number | null;
  libido_rating:     number | null;
  aesthetic_rating:  number | null;
  caffeine_mg:       number | null;
  sun_min:           number | null;
  learning_min:      number | null;
  money_net:         number | null;
  // businesses portfolio (migration 0027) — total MRR snapshotted per day
  // from business_revenue_log, so the correlation engine can spot
  // "MRR climbs when focus_min climbs" etc.
  business_mrr_total: number | null;
  // wake-confirm (migration 0037) — was today's NFC-tap on time vs the
  // profile's wake_target_time? 1 = on-time, 0 = late, null = no confirm.
  // Behavioral signal, not biometric (so the correlation engine can tie
  // wake-on-time to mood / focus / drinks / etc.).
  wake_on_time:       0 | 1 | null;
  // per-supplement booleans (dynamically added in buildDailySnapshot)
  [supKey: `supp_${string}`]: 0 | 1 | null | undefined;
};

function dateDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function listDates(daysBack: number): string[] {
  const out: string[] = [];
  for (let i = daysBack; i >= 0; i--) out.push(dateDaysAgo(i));
  return out;
}

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

export async function buildDailySnapshot(
  supabase: SupabaseClient,
  userId: string,
  daysBack = 21,
): Promise<{ rows: DaySnapshot[]; csv: string; columns: string[]; supplementNames: string[] }> {
  const cutoff = dateDaysAgo(daysBack);

  const [
    healthRes, suppStackRes, suppLogsRes, medLogsRes,
    waterRes, meditRes, moodRes, alcRes, weightRes, faithRes,
    setsRes, goalsRes, proteinRes,
    focusRes, socialRes, cardioRes, libidoRes, aestheticRes, caffeineRes, sunRes, learningRes, moneyRes,
    businessRevRes,
    wakeRes,
  ] = await Promise.all([
    supabase.from("health_logs").select("*").eq("user_id", userId).gte("date", cutoff).order("date", { ascending: true }),
    supabase.from("supplement_stack").select("id, name").eq("user_id", userId).eq("is_active", true),
    supabase.from("supplement_logs").select("supplement_id, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("medication_logs").select("medication_type, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("water_logs").select("glasses, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("meditation_logs").select("duration_min, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("mood_logs").select("score, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("alcohol_logs").select("drink_count, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("weight_logs").select("weight_kg, logged_at").eq("user_id", userId).gte("logged_at", `${cutoff}T00:00:00`).order("logged_at", { ascending: true }),
    supabase.from("faith_logs").select("prayed, bible_min, church_attended, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("workout_sets").select("weight_kg, reps, rpe, est_1rm, log_date, split_day").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("goals").select("is_complete, goal_date").eq("user_id", userId).gte("goal_date", cutoff),
    supabase.from("protein_logs").select("protein_g, ai_score, log_date").eq("user_id", userId).gte("log_date", cutoff),
    // 9 new dimensions — same time window, ready for per-day aggregation below.
    supabase.from("focus_sessions").select("duration_min, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("social_logs").select("kind, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("cardio_logs").select("duration_min, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("libido_logs").select("rating, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("aesthetic_logs").select("rating, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("caffeine_logs").select("mg, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("sun_logs").select("duration_min, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("learning_logs").select("duration_min, log_date").eq("user_id", userId).gte("log_date", cutoff),
    supabase.from("money_logs").select("amount, kind, log_date").eq("user_id", userId).gte("log_date", cutoff),
    // Business revenue snapshots (migration 0027). Each log = the MRR for
    // that business on that day; summing across businesses per date gives
    // total portfolio MRR over time.
    supabase.from("business_revenue_log").select("amount, log_date").eq("user_id", userId).gte("log_date", cutoff),
    // Wake-confirm (migration 0037). Behavioral signal — feeds the 21d
    // correlation engine so it can spot e.g. "wake_on_time correlates
    // -0.6 with alcohol_drinks the night before."
    supabase.from("wake_logs").select("date, on_time").eq("user_id", userId).gte("date", cutoff),
  ]);

  type HealthRow = Record<string, unknown> & { date: string };
  const healthByDate = new Map<string, HealthRow>(((healthRes.data ?? []) as HealthRow[]).map((r) => [r.date, r]));

  const supplementStack = (suppStackRes.data ?? []) as Array<{ id: string; name: string }>;
  // supId → date set
  const suppLogsBySupp = new Map<string, Set<string>>();
  for (const s of supplementStack) suppLogsBySupp.set(s.id, new Set());
  for (const log of ((suppLogsRes.data ?? []) as Array<{ supplement_id: string; log_date: string }>)) {
    suppLogsBySupp.get(log.supplement_id)?.add(log.log_date);
  }

  // Generic per-medication-type count per day. No hardcoded substance names —
  // whatever medication_types are actually logged in the window become columns.
  // Schema: medCountsByDate.get(date)?.get(medType) → count for that day.
  const medCountsByDate = new Map<string, Map<string, number>>();
  const allMedTypes = new Set<string>();
  for (const log of ((medLogsRes.data ?? []) as Array<{ medication_type: string; log_date: string }>)) {
    if (!log.medication_type) continue;
    allMedTypes.add(log.medication_type);
    const dayMap = medCountsByDate.get(log.log_date) ?? new Map<string, number>();
    dayMap.set(log.medication_type, (dayMap.get(log.medication_type) ?? 0) + 1);
    medCountsByDate.set(log.log_date, dayMap);
  }

  const waterByDate = new Map<string, number>();
  for (const r of ((waterRes.data ?? []) as Array<{ glasses: number; log_date: string }>)) {
    waterByDate.set(r.log_date, r.glasses);
  }

  const meditByDate = new Map<string, number>();
  for (const r of ((meditRes.data ?? []) as Array<{ duration_min: number; log_date: string }>)) {
    meditByDate.set(r.log_date, (meditByDate.get(r.log_date) ?? 0) + r.duration_min);
  }

  const moodByDate = new Map<string, number>();
  for (const r of ((moodRes.data ?? []) as Array<{ score: number; log_date: string }>)) {
    moodByDate.set(r.log_date, r.score);
  }

  const alcByDate = new Map<string, number>();
  for (const r of ((alcRes.data ?? []) as Array<{ drink_count: number; log_date: string }>)) {
    alcByDate.set(r.log_date, (alcByDate.get(r.log_date) ?? 0) + r.drink_count);
  }

  // Use the most-recent weigh-in per day
  const weightByDate = new Map<string, number>();
  for (const r of ((weightRes.data ?? []) as Array<{ weight_kg: number; logged_at: string }>)) {
    const d = r.logged_at.split("T")[0];
    weightByDate.set(d, r.weight_kg);
  }

  const faithByDate = new Map<string, { prayed: boolean; bible_min: number; church: boolean }>();
  for (const r of ((faithRes.data ?? []) as Array<{ prayed: boolean; bible_min: number; church_attended: boolean; log_date: string }>)) {
    faithByDate.set(r.log_date, { prayed: r.prayed, bible_min: r.bible_min ?? 0, church: r.church_attended });
  }

  // Workout aggregation per day
  type SetRow = { weight_kg: number; reps: number; rpe: number | null; est_1rm: number; log_date: string; split_day: string | null };
  const setsByDate = new Map<string, SetRow[]>();
  for (const s of ((setsRes.data ?? []) as SetRow[])) {
    const arr = setsByDate.get(s.log_date) ?? [];
    arr.push(s);
    setsByDate.set(s.log_date, arr);
  }

  // Goals per day
  const goalsByDate = new Map<string, { total: number; complete: number }>();
  for (const g of ((goalsRes.data ?? []) as Array<{ is_complete: boolean; goal_date: string }>)) {
    const e = goalsByDate.get(g.goal_date) ?? { total: 0, complete: 0 };
    e.total++;
    if (g.is_complete) e.complete++;
    goalsByDate.set(g.goal_date, e);
  }

  // Protein per day
  const proteinByDate = new Map<string, { total: number; scores: number[]; count: number }>();
  for (const p of ((proteinRes.data ?? []) as Array<{ protein_g: number; ai_score: number | null; log_date: string }>)) {
    const e = proteinByDate.get(p.log_date) ?? { total: 0, scores: [], count: 0 };
    e.total += Number(p.protein_g);
    e.count++;
    if (p.ai_score != null) e.scores.push(p.ai_score);
    proteinByDate.set(p.log_date, e);
  }

  // 9 new dimensions — per-day aggregates for the correlation engine.
  const sumByDate = (rows: Array<Record<string, unknown> & { log_date: string }>, field: string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const v = Number(r[field]) || 0;
      m.set(r.log_date, (m.get(r.log_date) ?? 0) + v);
    }
    return m;
  };
  const focusMinByDate    = sumByDate((focusRes.data ?? []) as Array<{ duration_min: number; log_date: string }>, "duration_min");
  const cardioMinByDate   = sumByDate((cardioRes.data ?? []) as Array<{ duration_min: number; log_date: string }>, "duration_min");
  const caffeineMgByDate  = sumByDate((caffeineRes.data ?? []) as Array<{ mg: number; log_date: string }>, "mg");
  const sunMinByDate      = sumByDate((sunRes.data ?? []) as Array<{ duration_min: number; log_date: string }>, "duration_min");
  const learningMinByDate = sumByDate((learningRes.data ?? []) as Array<{ duration_min: number; log_date: string }>, "duration_min");

  const socialCountByDate = new Map<string, number>();
  for (const r of ((socialRes.data ?? []) as Array<{ kind: string; log_date: string }>)) {
    socialCountByDate.set(r.log_date, (socialCountByDate.get(r.log_date) ?? 0) + 1);
  }

  // Libido + aesthetic — latest rating that day (one entry typical, but be defensive)
  const libidoByDate = new Map<string, number>();
  for (const r of ((libidoRes.data ?? []) as Array<{ rating: number; log_date: string }>)) {
    libidoByDate.set(r.log_date, r.rating); // last write wins, fine for daily snapshot
  }
  const aestheticByDate = new Map<string, number>();
  for (const r of ((aestheticRes.data ?? []) as Array<{ rating: number | null; log_date: string }>)) {
    if (r.rating != null) aestheticByDate.set(r.log_date, r.rating);
  }

  // Total business MRR snapshotted per day — sums across all businesses.
  // Last logged amount per business carries forward if the date is in the
  // window (handled here: latest amount per business per day).
  const businessMRRByDate = new Map<string, number>();
  for (const r of ((businessRevRes.data ?? []) as Array<{ amount: number; log_date: string }>)) {
    businessMRRByDate.set(r.log_date, (businessMRRByDate.get(r.log_date) ?? 0) + Number(r.amount));
  }

  const wakeOnTimeByDate = new Map<string, 0 | 1>();
  for (const r of ((wakeRes.data ?? []) as Array<{ date: string; on_time: boolean | null }>)) {
    if (r.on_time == null) continue;
    wakeOnTimeByDate.set(r.date, r.on_time ? 1 : 0);
  }

  // Money net (income + business_revenue) - expenses + savings reads as positive contribution
  const moneyNetByDate = new Map<string, number>();
  for (const r of ((moneyRes.data ?? []) as Array<{ amount: number; kind: string; log_date: string }>)) {
    const sign = (r.kind === "income" || r.kind === "business_revenue") ? 1 : (r.kind === "expense" ? -1 : 0);
    moneyNetByDate.set(r.log_date, (moneyNetByDate.get(r.log_date) ?? 0) + sign * Number(r.amount));
  }

  // Build rows
  const rows: DaySnapshot[] = listDates(daysBack).map((date) => {
    const h = healthByDate.get(date);
    const setsForDay = setsByDate.get(date) ?? [];
    const setVolume = setsForDay.reduce((sum, s) => sum + s.weight_kg * s.reps, 0);
    const rpeVals = setsForDay.map((s) => s.rpe).filter((v): v is number => v != null);
    const max1rm = setsForDay.reduce((m, s) => Math.max(m, s.est_1rm), 0);
    const split = setsForDay[0]?.split_day ?? null;
    const goals = goalsByDate.get(date);
    const faith = faithByDate.get(date);
    const protein = proteinByDate.get(date);

    const row: DaySnapshot = {
      date,
      readiness:        (h?.readiness_score as number)   ?? null,
      hrv:              (h?.hrv as number)               ?? null,
      rhr:              (h?.rhr as number)               ?? null,
      sleep_score:      (h?.sleep_score as number)       ?? null,
      sleep_hours:      (h?.sleep_hours as number)       ?? null,
      rem_min:          (h?.rem_min as number)           ?? null,
      deep_min:         (h?.deep_min as number)          ?? null,
      light_min:        (h?.light_min as number)         ?? null,
      awake_min:        (h?.awake_min as number)         ?? null,
      spo2_pct:         (h?.spo2_pct as number)          ?? null,
      resp_rate:        (h?.resp_rate as number)         ?? null,
      skin_temp_delta:  (h?.skin_temp_delta as number)   ?? null,
      stress_high_min:  h?.stress_high_sec   != null ? Math.round((h.stress_high_sec   as number) / 60) : null,
      recovery_high_min:h?.recovery_high_sec != null ? Math.round((h.recovery_high_sec as number) / 60) : null,
      resilience_level: (h?.resilience_level as string)  ?? null,
      vo2_max:          (h?.vo2_max as number)           ?? null,
      water_glasses:    waterByDate.get(date)            ?? null,
      meditation_min:   meditByDate.get(date)            ?? null,
      mood:             moodByDate.get(date)             ?? null,
      alcohol_drinks:   alcByDate.get(date)              ?? null,
      weight_kg:        weightByDate.get(date)           ?? null,
      prayed:           faith != null ? (faith.prayed ? 1 : 0) : null,
      bible_min:        faith?.bible_min                  ?? null,
      church:           faith != null ? (faith.church ? 1 : 0) : null,
      // med_<type> columns get filled below — keeps row literal narrow
      workout_volume_kg: setsForDay.length > 0 ? Math.round(setVolume) : null,
      workout_sets:      setsForDay.length > 0 ? setsForDay.length      : null,
      workout_avg_rpe:   rpeVals.length > 0    ? Math.round(rpeVals.reduce((a, b) => a + b, 0) / rpeVals.length * 10) / 10 : null,
      workout_max_1rm:   max1rm > 0            ? Math.round(max1rm)     : null,
      workout_split:     split,
      goals_total:       goals?.total          ?? null,
      goals_complete:    goals?.complete       ?? null,
      goals_complete_pct:goals && goals.total > 0 ? Math.round((goals.complete / goals.total) * 100) : null,
      protein_g:         protein ? Math.round(protein.total) : null,
      meal_score_avg:    protein && protein.scores.length > 0
        ? Math.round(protein.scores.reduce((a, b) => a + b, 0) / protein.scores.length)
        : null,
      meals_logged:      protein ? protein.count : null,
      // 9 new dimensions — daily aggregates
      focus_min:         focusMinByDate.get(date)    ?? null,
      social_count:      socialCountByDate.get(date) ?? null,
      cardio_min:        cardioMinByDate.get(date)   ?? null,
      libido_rating:     libidoByDate.get(date)      ?? null,
      aesthetic_rating:  aestheticByDate.get(date)   ?? null,
      caffeine_mg:       caffeineMgByDate.get(date)  ?? null,
      sun_min:           sunMinByDate.get(date)      ?? null,
      learning_min:      learningMinByDate.get(date) ?? null,
      money_net:         moneyNetByDate.get(date)    ?? null,
      business_mrr_total: businessMRRByDate.get(date) ?? null,
      wake_on_time:       wakeOnTimeByDate.get(date) ?? null,
    };

    // Per-supplement boolean
    for (const supp of supplementStack) {
      const key = `supp_${slug(supp.name)}` as const;
      const takenDates = suppLogsBySupp.get(supp.id);
      row[key] = takenDates && takenDates.has(date) ? 1 : 0;
    }

    // Per-medication-type count for this date. Whatever Sir has logged in the
    // window becomes a column (`med_<slug>`). Days with no log → 0.
    const dayMeds = medCountsByDate.get(date);
    for (const medType of allMedTypes) {
      const key = `med_${slug(medType)}` as const;
      row[key] = dayMeds?.get(medType) ?? 0;
    }

    return row;
  });

  // Build CSV: only include columns that have AT LEAST ONE non-null value across the window
  const allKeys = Object.keys(rows[0] ?? { date: "" });
  const usefulKeys = allKeys.filter((k) => {
    if (k === "date") return true;
    return rows.some((r) => {
      const v = (r as Record<string, unknown>)[k];
      return v != null && v !== 0;  // skip all-zero/all-null columns to save tokens
    });
  });

  const header = usefulKeys.join(",");
  const lines = rows.map((r) =>
    usefulKeys.map((k) => {
      const v = (r as Record<string, unknown>)[k];
      if (v == null) return "";
      if (typeof v === "string") return v;
      return String(v);
    }).join(",")
  );
  const csv = [header, ...lines].join("\n");

  return {
    rows,
    csv,
    columns: usefulKeys,
    supplementNames: supplementStack.map((s) => s.name),
  };
}
