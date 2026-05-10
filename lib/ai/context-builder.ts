import { createServiceClient } from "@/lib/supabase/server";
import { computeDailyScore } from "@/lib/scoring";

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

export async function buildContext(userId: string) {
  const supabase = createServiceClient();
  const today     = getLogDate();
  const yesterday = dateDaysAgo(1);
  const now       = new Date();

  const [
    goalsRes, stackRes, logsRes, medLogsRes, setsRes, streakRes,
    healthRes, yesterdaySetsRes,
    dailyCtxRes, waterRes, faithRes, moodRes, journalRes, ltGoalsRes,
  ] = await Promise.all([
    supabase.from("goals").select("title, is_complete, priority").eq("user_id", userId).eq("goal_date", today),
    supabase.from("supplement_stack").select("id, name, timing").eq("user_id", userId).eq("is_active", true),
    supabase.from("supplement_logs").select("supplement_id").eq("user_id", userId).eq("log_date", today),
    supabase.from("medication_logs").select("medication_type, taken_at").eq("user_id", userId).eq("log_date", today),
    supabase.from("workout_sets").select("weight_kg, reps, logged_at, exercises(name, split_day)").eq("user_id", userId).order("logged_at", { ascending: false }).limit(5),
    supabase.from("goal_streaks").select("current_streak").eq("user_id", userId).single(),
    supabase.from("health_logs").select("*").eq("user_id", userId).eq("date", today).single(),
    supabase.from("workout_sets").select("weight_kg, reps, logged_at, exercises(name, split_day)").eq("user_id", userId).gte("logged_at", `${yesterday}T00:00:00`).lte("logged_at", `${yesterday}T23:59:59`).order("logged_at", { ascending: false }).limit(6),
    // New lifestyle + journal data
    supabase.from("daily_context").select("raw_text").eq("user_id", userId).eq("log_date", today).single(),
    supabase.from("water_logs").select("glasses").eq("user_id", userId).eq("log_date", today).single(),
    supabase.from("faith_logs").select("prayed, bible_min, church_attended").eq("user_id", userId).eq("log_date", today).single(),
    supabase.from("mood_logs").select("score").eq("user_id", userId).eq("log_date", today).order("logged_at", { ascending: false }).limit(1),
    supabase.from("journal_entries").select("content, ai_summary").eq("user_id", userId).order("created_at", { ascending: false }).limit(3),
    supabase.from("long_term_goals").select("title, category, ai_action_plan").eq("user_id", userId).eq("is_active", true).limit(10),
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

  const concerta  = medLogs.find((l) => l.medication_type === "concerta");
  const veloCount = medLogs.filter((l) => l.medication_type === "velo").length;

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

  // Cross-domain interpretation hints for the AI
  const behavioralContext = {
    concertaTaken:    !!concerta,
    concertaAt:       concerta?.taken_at ? new Date(concerta.taken_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null,
    concertaNote:     concerta ? "Concerta (methylphenidate stimulant) reliably suppresses overnight HRV by 15-25ms. Factor this into readiness interpretation." : null,
    veloCountToday:   veloCount,
    veloNote:         veloCount >= 3 ? "High Velo nicotine use — can elevate RHR and fragment sleep if used late." : null,
    supplementsTaken,
    supplementsMissed,
    magnesiumMissed:  supplementsMissed.some(s => s.name.toLowerCase().includes("magnesium")),
    magnesiumNote:    supplementsMissed.some(s => s.name.toLowerCase().includes("magnesium")) && health?.deep_min != null && health.deep_min < 60
      ? "Magnesium glycinate missed — directly supports deep sleep stages. This likely explains reduced deep sleep."
      : null,
    yesterdayWorkout: yesterdayWorkoutSummary,
    yesterdaySplit:   yesterdaySplitDay,
    yesterdayNote:    yesterdaySplitDay
      ? `${yesterdaySplitDay} day yesterday — expect elevated muscle damage markers and possible HRV suppression today, especially after Leg/Pull days (high CNS demand).`
      : null,
  };

  const goalsComplete = goals.filter((g) => g.is_complete).length;
  const suppsTaken = stack.filter((s) => logs.some((l) => l.supplement_id === s.id)).length;

  const dailyScore = computeDailyScore({
    goalsComplete,
    goalsTotal: goals.length,
    readinessScore: health?.readiness_score ?? null,
    workoutDoneToday: sets.length > 0,
    supplementsTaken: suppsTaken,
    supplementsTotal: stack.length,
    checkedIn: !!dailyCtxRes.data?.raw_text,
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
    lifestyle: {
      dailyPlan:    dailyCtxRes.data?.raw_text ?? null,
      waterGlasses: waterRes.data?.glasses ?? 0,
      faith:        faithRes.data ?? null,
      latestMood:   (moodRes.data as Array<{ score: number }> | null)?.[0]?.score ?? null,
    },
    journal:       (journalRes.data ?? []) as Array<{ content: string; ai_summary: string | null }>,
    longTermGoals: (ltGoalsRes.data ?? []) as Array<{ title: string; category: string; ai_action_plan: string | null }>,
    dailyScore,
  };
}
