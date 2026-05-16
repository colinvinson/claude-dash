import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Daily insight surface — Jarvis proactively flags up to 3 observations
// per day, one per category:
//   - performance: training PRs, strength trends, volume hits/misses
//   - recovery:    sleep / HRV / drag patterns relevant for today
//   - goal:        long-term goal trajectory (focus goal nearing target,
//                  metric trending wrong way, milestone overdue)
//
// Each category is gated to ONCE per day per kind via jarvis_insights.kind
// so a refresh doesn't spam. Cheap heuristics — no LLM call per detection
// (the correlation engine handles deeper analysis separately).

function todayKey(): string { return new Date().toISOString().slice(0, 10); }
function daysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

type InsightOut = { kind: string; body: string; severity: "info" | "good" | "warn" };

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = user.id;

  const service = createServiceClient();
  const today = todayKey();

  // What's already fired today?
  const existing = await service
    .from("jarvis_insights")
    .select("kind")
    .eq("user_id", uid)
    .in("kind", ["performance", "recovery", "goal"])
    .gte("triggered_at", `${today}T00:00:00`);
  const alreadyFired = new Set(((existing.data ?? []) as Array<{ kind: string }>).map((r) => r.kind));

  const toInsert: InsightOut[] = [];

  // ── 1. PERFORMANCE — has Sir hit any lift today? Are sets trending? ──
  if (!alreadyFired.has("performance")) {
    const setsRes = await service
      .from("workout_sets")
      .select("est_1rm, log_date, exercise_id, exercises(name)")
      .eq("user_id", uid)
      .gte("log_date", daysAgo(14))
      .order("log_date", { ascending: true });
    type SetRow = { est_1rm: number; log_date: string; exercise_id: string; exercises: { name: string } | { name: string }[] | null };
    const sets = (setsRes.data ?? []) as SetRow[];
    if (sets.length > 0) {
      // Per-exercise: this-week best vs last-week best
      const byEx = new Map<string, { name: string; recent: number; older: number }>();
      for (const s of sets) {
        const ex = Array.isArray(s.exercises) ? s.exercises[0] : s.exercises;
        const name = ex?.name ?? "exercise";
        const cur = byEx.get(s.exercise_id) ?? { name, recent: 0, older: 0 };
        const ageDays = Math.floor((Date.now() - new Date(s.log_date).getTime()) / 86400000);
        if (ageDays <= 7)      cur.recent = Math.max(cur.recent, s.est_1rm);
        else if (ageDays <= 14) cur.older  = Math.max(cur.older,  s.est_1rm);
        byEx.set(s.exercise_id, cur);
      }
      const movers = [...byEx.values()].filter((v) => v.recent > 0 && v.older > 0);
      const top = movers.sort((a, b) => (b.recent - b.older) - (a.recent - a.older))[0];
      if (top && top.recent > top.older) {
        const pctUp = ((top.recent - top.older) / top.older) * 100;
        toInsert.push({
          kind: "performance",
          severity: "good",
          body: `${top.name} est-1RM up ${pctUp.toFixed(1)}% this week vs last (${(top.recent * 2.20462).toFixed(0)} vs ${(top.older * 2.20462).toFixed(0)} lb).`,
        });
      } else if (top && top.recent < top.older * 0.95) {
        const pctDown = ((top.older - top.recent) / top.older) * 100;
        toInsert.push({
          kind: "performance",
          severity: "warn",
          body: `${top.name} est-1RM down ${pctDown.toFixed(1)}% vs last week. Check sleep/protein/volume for overreach.`,
        });
      }
    }
  }

  // ── 2. RECOVERY — sleep + HRV trend ──
  if (!alreadyFired.has("recovery")) {
    const healthRes = await service
      .from("health_logs")
      .select("sleep_hours, hrv, readiness_score, date")
      .eq("user_id", uid)
      .gte("date", daysAgo(14))
      .order("date", { ascending: true });
    type HRow = { sleep_hours: number | null; hrv: number | null; readiness_score: number | null; date: string };
    const hs = (healthRes.data ?? []) as HRow[];
    if (hs.length >= 7) {
      const recent = hs.slice(-7);
      const older  = hs.slice(0, Math.min(7, hs.length - 7));
      const avg = (arr: number[]) => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
      const recentSleep = avg(recent.map((r) => r.sleep_hours).filter((v): v is number => v != null));
      const olderSleep  = avg(older.map((r) => r.sleep_hours).filter((v): v is number => v != null));
      const recentHrv   = avg(recent.map((r) => r.hrv).filter((v): v is number => v != null));
      const olderHrv    = avg(older.map((r) => r.hrv).filter((v): v is number => v != null));

      if (recentSleep > 0 && recentSleep < 6.5) {
        toInsert.push({
          kind: "recovery",
          severity: "warn",
          body: `Sleep ${recentSleep.toFixed(1)}h avg last 7d — under 7h drags HRV, recovery, and lift quality. Single biggest lever.`,
        });
      } else if (recentHrv > 0 && olderHrv > 0 && recentHrv < olderHrv * 0.92) {
        toInsert.push({
          kind: "recovery",
          severity: "warn",
          body: `HRV down ${Math.round(((olderHrv - recentHrv) / olderHrv) * 100)}% vs prior week (${Math.round(recentHrv)}ms vs ${Math.round(olderHrv)}ms). Check alcohol / stress / sleep debt.`,
        });
      } else if (recentSleep >= 7.5 && recentHrv > olderHrv * 1.05) {
        toInsert.push({
          kind: "recovery",
          severity: "good",
          body: `Recovery dialed: ${recentSleep.toFixed(1)}h sleep avg, HRV up ${Math.round(((recentHrv - olderHrv) / Math.max(olderHrv, 1)) * 100)}% vs last week. Today's a PR-friendly day.`,
        });
      }
    }
  }

  // ── 3. GOAL — focus-flagged goal trajectory ──
  if (!alreadyFired.has("goal")) {
    const goalsRes = await service
      .from("long_term_goals")
      .select("id, title, goal_type, target_value, target_date, is_focus")
      .eq("user_id", uid)
      .eq("is_active", true)
      .eq("is_focus", true);
    type GRow = { id: string; title: string; goal_type: string; target_value: number | null; target_date: string | null; is_focus: boolean };
    const focusGoals = (goalsRes.data ?? []) as GRow[];

    if (focusGoals.length > 0) {
      // Pick the first focus goal with enough data
      for (const g of focusGoals) {
        if (g.goal_type === "quantitative" && g.target_value != null) {
          const metricsRes = await service
            .from("goal_metrics")
            .select("value, logged_at")
            .eq("user_id", uid)
            .eq("goal_id", g.id)
            .order("logged_at", { ascending: true });
          const metrics = (metricsRes.data ?? []) as Array<{ value: number; logged_at: string }>;
          if (metrics.length >= 2) {
            const latest = metrics[metrics.length - 1].value;
            const t0 = new Date(metrics[0].logged_at).getTime();
            const xs = metrics.map((m) => (new Date(m.logged_at).getTime() - t0) / 86400000);
            const ys = metrics.map((m) => m.value);
            const n = xs.length;
            const sX  = xs.reduce((a, b) => a + b, 0);
            const sY  = ys.reduce((a, b) => a + b, 0);
            const sXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
            const sXX = xs.reduce((acc, x) => acc + x * x, 0);
            const denom = n * sXX - sX * sX;
            const slopePerWeek = denom === 0 ? 0 : ((n * sXY - sX * sY) / denom) * 7;
            const delta = g.target_value - latest;
            if (Math.abs(slopePerWeek) > 0.001 && Math.sign(delta) === Math.sign(slopePerWeek)) {
              const weeksTo = Math.abs(delta / slopePerWeek);
              const daysTo  = Math.round(weeksTo * 7);
              toInsert.push({
                kind: "goal",
                severity: "info",
                body: `${g.title}: at current rate (${slopePerWeek >= 0 ? "+" : ""}${slopePerWeek.toFixed(2)}/wk) hits target in ~${daysTo}d.`,
              });
              break;
            } else if (Math.sign(delta) !== Math.sign(slopePerWeek) && Math.abs(slopePerWeek) > 0.001) {
              toInsert.push({
                kind: "goal",
                severity: "warn",
                body: `${g.title}: trending wrong way (${slopePerWeek >= 0 ? "+" : ""}${slopePerWeek.toFixed(2)}/wk vs target ${g.target_value}). Time to adjust protocol.`,
              });
              break;
            }
          }
        }
      }
    }
  }

  // Insert all flagged insights
  if (toInsert.length > 0) {
    await service.from("jarvis_insights").insert(
      toInsert.map((i) => ({ user_id: uid, kind: i.kind, severity: i.severity, body: i.body }))
    );
  }

  return NextResponse.json({ added: toInsert.length, insights: toInsert });
}
