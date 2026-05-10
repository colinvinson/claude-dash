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
  if (!res.ok) throw new Error(`Oura ${endpoint} failed: ${res.status}`);
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

  // Fetch yesterday + today (ring syncs the previous night's data in the morning)
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const startDate = fmt(yesterday);
  const endDate   = fmt(today);

  try {
    const [readinessData, sleepData, activityData] = await Promise.all([
      ouraGet("daily_readiness", startDate, endDate),
      ouraGet("daily_sleep",     startDate, endDate),
      ouraGet("daily_activity",  startDate, endDate),
    ]);

    const service = createServiceClient();
    const upserted: string[] = [];

    // Build a date-keyed map for each data type
    type ReadinessItem = {
      day: string;
      score: number;
      contributors?: { hrv_balance?: number; resting_heart_rate?: number };
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
    type ActivityItem = { day: string; score: number };

    const readinessByDate = new Map<string, ReadinessItem>(
      (readinessData.data ?? []).map((r: ReadinessItem) => [r.day, r])
    );
    const sleepByDate = new Map<string, SleepItem>(
      (sleepData.data ?? []).map((s: SleepItem) => [s.day, s])
    );
    const activityByDate = new Map<string, ActivityItem>(
      (activityData.data ?? []).map((a: ActivityItem) => [a.day, a])
    );

    const dates = new Set([
      ...readinessByDate.keys(),
      ...sleepByDate.keys(),
      ...activityByDate.keys(),
    ]);

    for (const date of dates) {
      const r = readinessByDate.get(date);
      const s = sleepByDate.get(date);
      const a = activityByDate.get(date);

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

      const raw_oura_json = { readiness: r ?? null, sleep: s ?? null, activity: a ?? null };

      const { error } = await service.from("health_logs").upsert({
        user_id:          user.id,
        date,
        readiness_score,
        readiness_label:  readiness_score != null ? labelFromScore(readiness_score) : null,
        sleep_score:      s?.score ?? null,
        sleep_hours,
        activity_score:   a?.score ?? null,
        hrv,
        rhr,
        resp_rate:        s?.average_breath ?? null,
        rem_min,
        deep_min,
        light_min,
        awake_min,
        is_final:         true,
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
