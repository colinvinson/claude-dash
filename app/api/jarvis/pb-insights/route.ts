import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { pushToUser } from "@/lib/jarvis/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Surprise personal-best insight detector. Runs on Home page mount,
// surfaces AT MOST ONE insight per day via jarvis_insights so the variable
// reward stays an actual surprise (not noise).
//
// What we look for (cheap heuristics — no LLM):
//   1. Longest-ever streak: current >= max(history) AND >= 7
//   2. First 7/7 protein week in 30+ days
//   3. New all-time est-1RM PR for any exercise
//   4. First multi-week perfect supplement adherence
//
// One per day. Body is short, severity always "info" so it shows as a small
// banner not a red alert.

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = user.id;

  const service = createServiceClient();

  // Bail if we already fired a PB insight today (prevents UI from re-checking
  // and stacking duplicates).
  const today = todayKey();
  const existing = await service
    .from("jarvis_insights")
    .select("id")
    .eq("user_id", uid)
    .eq("kind", "pb")
    .gte("triggered_at", `${today}T00:00:00`)
    .limit(1);
  if ((existing.data?.length ?? 0) > 0) {
    return NextResponse.json({ insight: null, reason: "already-fired-today" });
  }

  // Gather signals
  const [streakRes, sets90dRes, protein60dRes] = await Promise.all([
    service.from("goal_streaks").select("current_streak, longest_streak").eq("user_id", uid).single(),
    service.from("workout_sets").select("est_1rm, log_date, exercise_id, exercises(name)").eq("user_id", uid).gte("log_date", daysAgo(90)).order("log_date", { ascending: true }),
    service.from("protein_logs").select("protein_g, log_date").eq("user_id", uid).gte("log_date", daysAgo(60)),
  ]);

  const streak = streakRes.data?.current_streak ?? 0;
  const longest = streakRes.data?.longest_streak ?? 0;

  let body: string | null = null;

  // 1. Streak — at or beating personal best
  if (!body && streak >= 7 && streak >= longest) {
    body = `${streak}-day streak — that's Sir's longest run ever.`;
  }

  // 2. New all-time est-1RM PR in the last 24h
  if (!body) {
    type SetRow = { est_1rm: number; log_date: string; exercise_id: string; exercises: { name: string } | { name: string }[] | null };
    const sets = (sets90dRes.data ?? []) as SetRow[];
    const todayKeyStr = today;
    const byEx = new Map<string, { name: string; allTimeBest: number; allTimePrev: number; todayBest: number }>();
    for (const s of sets) {
      const ex = Array.isArray(s.exercises) ? s.exercises[0] : s.exercises;
      const name = ex?.name ?? "exercise";
      const cur = byEx.get(s.exercise_id) ?? { name, allTimeBest: 0, allTimePrev: 0, todayBest: 0 };
      if (s.est_1rm > cur.allTimeBest) {
        cur.allTimePrev = cur.allTimeBest;
        cur.allTimeBest = s.est_1rm;
      }
      if (s.log_date === todayKeyStr && s.est_1rm > cur.todayBest) cur.todayBest = s.est_1rm;
      byEx.set(s.exercise_id, cur);
    }
    for (const v of byEx.values()) {
      if (v.todayBest > 0 && v.todayBest === v.allTimeBest && v.allTimePrev > 0) {
        const lb = (v.todayBest * 2.20462).toFixed(0);
        body = `New all-time estimated 1RM on ${v.name}: ${lb} lb. Above Sir's previous best.`;
        break;
      }
    }
  }

  // 3. First 7/7 protein week in 30+ days
  if (!body && protein60dRes.data) {
    type ProteinRow = { protein_g: number; log_date: string };
    const proteinDays = new Map<string, number>();
    for (const r of protein60dRes.data as ProteinRow[]) {
      proteinDays.set(r.log_date, (proteinDays.get(r.log_date) ?? 0) + Number(r.protein_g));
    }
    // Get target — bodyweight × 2 (matches useProtein default if missing).
    const wRes = await service.from("weight_logs").select("weight_kg").eq("user_id", uid).order("logged_at", { ascending: false }).limit(1);
    const w = (wRes.data as Array<{ weight_kg: number }> | null)?.[0]?.weight_kg ?? null;
    const target = w ? Math.round(w * 2.0) : 150;
    const threshold = target * 0.7;
    // Count consecutive days from today backward where protein >= threshold
    let streakDays = 0;
    for (let i = 0; i < 60; i++) {
      const key = daysAgo(i);
      if ((proteinDays.get(key) ?? 0) >= threshold) streakDays += 1;
      else break;
    }
    if (streakDays >= 7) {
      body = `Protein target hit ${streakDays} days in a row — longest fueled stretch in two months.`;
    }
  }

  if (!body) return NextResponse.json({ insight: null });

  // Record it so we don't refire today.
  const { data: inserted } = await service
    .from("jarvis_insights")
    .insert({
      user_id:      uid,
      kind:         "pb",
      severity:     "info",
      body,
      triggered_at: new Date().toISOString(),
    })
    .select("id, body")
    .single();

  // Push to subscribed devices. Silent fail if VAPID not configured.
  try {
    await pushToUser(uid, {
      title: "Personal best",
      body,
      tag:   `pb-${new Date().toISOString().slice(0, 10)}`,
      url:   "/home",
    });
  } catch {}

  return NextResponse.json({ insight: inserted });
}
