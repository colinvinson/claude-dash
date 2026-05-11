import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

const OURA_BASE = "https://api.ouraring.com/v2/usercollection";

async function ouraGet(endpoint: string, startDate: string, endDate: string) {
  const pat = process.env.OURA_PAT;
  if (!pat) throw new Error("OURA_PAT not set");
  const url = `${OURA_BASE}/${endpoint}?start_date=${startDate}&end_date=${endDate}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${pat}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    // Don't crash the whole sync if one endpoint fails — return null so the rest succeed
    return null;
  }
  return res.json();
}

function labelFromScore(score: number): string {
  if (score >= 85) return "Optimal";
  if (score >= 70) return "Good";
  if (score >= 60) return "Fair";
  return "Pay attention";
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pat = process.env.OURA_PAT;
  if (!pat) {
    return NextResponse.json({ error: "OURA_PAT not configured" }, { status: 503 });
  }

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const startDate    = fmt(yesterday);
  const endDate      = fmt(today);
  const weekStartDate = fmt(weekAgo);

  try {
    const [
      readinessData, sleepData, activityData,
      spo2Data, stressData, resilienceData, vo2Data, workoutsData,
    ] = await Promise.all([
      ouraGet("daily_readiness",  startDate, endDate),
      ouraGet("daily_sleep",      startDate, endDate),
      ouraGet("daily_activity",   startDate, endDate),
      ouraGet("daily_spo2",       startDate, endDate),
      ouraGet("daily_stress",     startDate, endDate),
      ouraGet("daily_resilience", startDate, endDate),
      ouraGet("vO2_max",          startDate, endDate),
      ouraGet("workout",          weekStartDate, endDate),
    ]);

    const service = createServiceClient();
    const upserted: string[] = [];

    type ReadinessItem = {
      day: string;
      score: number;
      contributors?: { hrv_balance?: number; resting_heart_rate?: number };
      temperature_deviation?: number;
    };
    type SleepItem = {
      day: string;
      score: number;
      total_sleep_duration?: number;
      rem_sleep_duration?: number;
      deep_sleep_duration?: number;
      light_sleep_duration?: number;
      awake_time?: number;
      average_breath?: number;
      average_hrv?: number;
      lowest_heart_rate?: number;
      average_heart_rate?: number;
    };
    type ActivityItem  = { day: string; score: number };
    type Spo2Item      = { day: string; spo2_percentage?: { average?: number } | number };
    type StressItem    = { day: string; stress_high?: number; recovery_high?: number; day_summary?: string };
    type ResilienceItem = { day: string; level?: string };
    type Vo2Item       = { day: string; vo2_max?: number };
    type WorkoutItem   = { day: string; activity?: string; intensity?: string; duration?: number; calories?: number; start_datetime?: string };

    const readinessByDate  = new Map<string, ReadinessItem>(((readinessData?.data  ?? []) as ReadinessItem[]).map((r) => [r.day, r]));
    const sleepByDate      = new Map<string, SleepItem>(((sleepData?.data         ?? []) as SleepItem[]).map((s) => [s.day, s]));
    const activityByDate   = new Map<string, ActivityItem>(((activityData?.data   ?? []) as ActivityItem[]).map((a) => [a.day, a]));
    const spo2ByDate       = new Map<string, Spo2Item>(((spo2Data?.data           ?? []) as Spo2Item[]).map((x) => [x.day, x]));
    const stressByDate     = new Map<string, StressItem>(((stressData?.data       ?? []) as StressItem[]).map((x) => [x.day, x]));
    const resilienceByDate = new Map<string, ResilienceItem>(((resilienceData?.data ?? []) as ResilienceItem[]).map((x) => [x.day, x]));
    const vo2ByDate        = new Map<string, Vo2Item>(((vo2Data?.data             ?? []) as Vo2Item[]).map((x) => [x.day, x]));

    // Workouts: group by day
    const workoutsByDate = new Map<string, WorkoutItem[]>();
    for (const w of ((workoutsData?.data ?? []) as WorkoutItem[])) {
      const arr = workoutsByDate.get(w.day) ?? [];
      arr.push(w);
      workoutsByDate.set(w.day, arr);
    }

    const dates = new Set([
      ...readinessByDate.keys(),
      ...sleepByDate.keys(),
      ...activityByDate.keys(),
    ]);

    for (const date of dates) {
      const r  = readinessByDate.get(date);
      const s  = sleepByDate.get(date);
      const a  = activityByDate.get(date);
      const sp = spo2ByDate.get(date);
      const st = stressByDate.get(date);
      const re = resilienceByDate.get(date);
      const v  = vo2ByDate.get(date);
      const w  = workoutsByDate.get(date) ?? [];

      const readiness_score = r?.score ?? null;
      const hrv             = r?.contributors?.hrv_balance ?? s?.average_hrv ?? null;
      const rhr             = r?.contributors?.resting_heart_rate ?? s?.lowest_heart_rate ?? null;

      const sleep_hours = s?.total_sleep_duration != null
        ? Math.round((s.total_sleep_duration / 3600) * 10) / 10
        : null;
      const rem_min   = s?.rem_sleep_duration   != null ? Math.round(s.rem_sleep_duration / 60)   : null;
      const deep_min  = s?.deep_sleep_duration  != null ? Math.round(s.deep_sleep_duration / 60)  : null;
      const light_min = s?.light_sleep_duration != null ? Math.round(s.light_sleep_duration / 60) : null;
      const awake_min = s?.awake_time           != null ? Math.round(s.awake_time / 60)           : null;

      // SpO2 endpoint shape varies: sometimes spo2_percentage is an object {average}, sometimes a number
      const spo2_pct = typeof sp?.spo2_percentage === "number"
        ? sp.spo2_percentage
        : sp?.spo2_percentage?.average ?? null;

      const raw_oura_json = {
        readiness:  r  ?? null,
        sleep:      s  ?? null,
        activity:   a  ?? null,
        spo2:       sp ?? null,
        stress:     st ?? null,
        resilience: re ?? null,
        vo2:        v  ?? null,
      };

      const { error } = await service.from("health_logs").upsert({
        user_id:            user.id,
        date,
        readiness_score,
        readiness_label:    readiness_score != null ? labelFromScore(readiness_score) : null,
        sleep_score:        s?.score ?? null,
        sleep_hours,
        activity_score:     a?.score ?? null,
        hrv,
        rhr,
        resp_rate:          s?.average_breath ?? null,
        rem_min,
        deep_min,
        light_min,
        awake_min,
        spo2_pct,
        skin_temp_delta:    r?.temperature_deviation ?? null,
        stress_high_sec:    st?.stress_high   ?? null,
        recovery_high_sec:  st?.recovery_high ?? null,
        stress_day_summary: st?.day_summary   ?? null,
        resilience_level:   re?.level         ?? null,
        vo2_max:            v?.vo2_max        ?? null,
        oura_workouts:      w.length > 0      ? w : null,
        is_final:           true,
        raw_oura_json,
      }, { onConflict: "user_id,date" });

      if (!error) upserted.push(date);
    }

    return NextResponse.json({ synced: true, dates: upserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
