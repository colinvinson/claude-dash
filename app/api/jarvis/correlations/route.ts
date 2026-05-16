import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildDailySnapshot } from "@/lib/ai/snapshot-builder";
import { pushToUser } from "@/lib/jarvis/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Correlation engine — weekly pattern-discovery pass on the 21-day snapshot.
// Scans every numeric column against every other numeric column for
// Pearson correlation. Returns the top |r| ≥ 0.5 pairs as
// jarvis_insights rows (kind="correlation"), capped at 2 per week so the
// strip doesn't get spammed.
//
// Trigger: fires once per week per user (gated via existing weekly
// jarvis_insights of kind="correlation"). Called from the daily-insights
// strip's mount effect — cheap because the gate short-circuits.

// Columns that aren't useful as either side of a correlation (date strings,
// categorical labels, identity markers).
const SKIP = new Set([
  "date", "resilience_level", "workout_split",
]);

// Friendly labels for the body strings — keeps insights readable.
const LABEL: Record<string, string> = {
  hrv:               "HRV",
  rhr:               "resting HR",
  sleep_hours:       "sleep hours",
  sleep_score:       "sleep score",
  deep_min:          "deep sleep",
  rem_min:           "REM sleep",
  readiness:         "Oura readiness",
  recovery_high_min: "high-recovery minutes",
  stress_high_min:   "high-stress minutes",
  spo2_pct:          "SpO2",
  weight_kg:         "weight",
  mood:              "mood",
  alcohol_drinks:    "alcohol",
  caffeine_mg:       "caffeine",
  sun_min:           "sun exposure",
  cardio_min:        "cardio",
  focus_min:         "focus / deep work",
  social_count:      "social interactions",
  libido_rating:     "libido",
  aesthetic_rating:  "aesthetic check-in rating",
  learning_min:      "learning",
  money_net:         "money net",
  workout_volume_kg: "training volume",
  workout_sets:      "training sets",
  workout_max_1rm:   "top est-1RM",
  protein_g:         "protein",
  water_glasses:     "water",
  meditation_min:    "meditation",
  bible_min:         "bible time",
  business_mrr_total: "total business MRR",
};

// Strip dynamic-indexer prefixes (supp_, med_, stack_) so the user reads
// "bluelight glasses" not "supp bluelight glasses". The prefix is an
// internal snapshot detail, not insight-worthy copy.
function pretty(col: string): string {
  if (LABEL[col]) return LABEL[col];
  const stripped = col.replace(/^(supp|med|stack)_/, "");
  return stripped.replace(/_/g, " ");
}

// Dynamic stack columns are binary indicators (1 if logged that day, 0 if
// not). When two routine items are always logged on the same days they
// correlate trivially at r≈1 — that's co-routine, not signal. Detect &
// drop both-stack pairs.
function isStackCol(c: string): boolean {
  return /^(supp|med|stack)_/.test(c);
}

// Pearson correlation. Returns 0 when there's <5 paired points or variance
// is zero on either side (avoids spurious correlations on sparse data).
function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 5) return 0;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx2 = 0, dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  if (dx2 === 0 || dy2 === 0) return 0;
  return num / Math.sqrt(dx2 * dy2);
}

export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const uid = user.id;

  const service = createServiceClient();

  // Sweep stale garbage from earlier versions of this engine. The old code
  // emitted (a) r=1.00 / r=-1.00 pairs (trivial co-occurrence) and (b)
  // rows containing the raw supp_/med_/stack_ prefix in the body string.
  // Hard-delete those rows so they stop surfacing in WhatMattersCard.
  await service
    .from("jarvis_insights")
    .delete()
    .eq("user_id", uid)
    .eq("kind", "correlation")
    .or("body.ilike.%r=1.00%,body.ilike.%r=-1.00%,body.ilike.%supp %,body.ilike.%med %,body.ilike.%stack %");

  // Weekly gate — bail if any correlation insight has fired in the last 7 days.
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const existing = await service
    .from("jarvis_insights")
    .select("id")
    .eq("user_id", uid)
    .eq("kind", "correlation")
    .gte("triggered_at", weekAgo.toISOString())
    .limit(1);
  if ((existing.data?.length ?? 0) > 0) {
    return NextResponse.json({ skipped: "fired-this-week" });
  }

  const { rows } = await buildDailySnapshot(service, uid, 21);
  if (rows.length < 7) {
    return NextResponse.json({ skipped: "not-enough-data", days: rows.length });
  }

  // Extract numeric columns. Each cell either a number or null — pair-wise
  // skip nulls when computing.
  const cols = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      if (SKIP.has(k)) continue;
      const v = (r as unknown as Record<string, unknown>)[k];
      if (typeof v === "number") cols.add(k);
    }
  }
  const columnList = [...cols];

  type Pair = { a: string; b: string; r: number; n: number };
  const pairs: Pair[] = [];

  for (let i = 0; i < columnList.length; i++) {
    for (let j = i + 1; j < columnList.length; j++) {
      const a = columnList[i], b = columnList[j];
      const xs: number[] = []; const ys: number[] = [];
      for (const row of rows) {
        const va = (row as unknown as Record<string, unknown>)[a];
        const vb = (row as unknown as Record<string, unknown>)[b];
        if (typeof va === "number" && typeof vb === "number") {
          xs.push(va); ys.push(vb);
        }
      }
      // Drop trivial co-occurrence: two binary stack indicators logged on
      // the same days will hit r≈1 mechanically, not because one drives
      // the other. Insight surface should never see these.
      if (isStackCol(a) && isStackCol(b)) continue;
      const r = pearson(xs, ys);
      // Lower bound 0.5 keeps things meaningful; upper bound 0.95 kills
      // tautological-perfect pairs (binary indicators that happen to
      // co-occur every day, near-duplicate columns).
      if (Math.abs(r) >= 0.5 && Math.abs(r) < 0.95 && xs.length >= 7) {
        pairs.push({ a, b, r, n: xs.length });
      }
    }
  }

  if (pairs.length === 0) {
    return NextResponse.json({ added: 0, scanned: columnList.length });
  }

  // Sort by |r| desc, take top 2. Skip "boring" correlations (same-domain
  // pairs that are tautologically correlated, e.g. sleep_score↔sleep_hours).
  const BORING = new Set([
    "sleep_score|sleep_hours", "sleep_hours|sleep_score",
    "workout_volume_kg|workout_sets", "workout_sets|workout_volume_kg",
    "deep_min|sleep_hours", "rem_min|sleep_hours",
    "workout_max_1rm|workout_volume_kg",
  ]);
  const interesting = pairs.filter((p) => !BORING.has(`${p.a}|${p.b}`));
  interesting.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  const top = interesting.slice(0, 2);

  const toInsert = top.map((p) => {
    const direction = p.r > 0 ? "tracks with" : "moves opposite";
    const body = `${pretty(p.a)} ${direction} ${pretty(p.b)} (r=${p.r.toFixed(2)}, n=${p.n}d). Worth knowing.`;
    return {
      user_id:  uid,
      kind:     "correlation",
      severity: "info" as const,
      body,
    };
  });

  if (toInsert.length > 0) {
    await service.from("jarvis_insights").insert(toInsert);

    // Push the top correlation as a single notification — weekly cadence
    // means we don't risk spam.
    try {
      await pushToUser(uid, {
        title: "Weekly pattern",
        body:  toInsert[0].body,
        tag:   `correlation-${new Date().toISOString().slice(0, 10)}`,
        url:   "/home",
      });
    } catch {}
  }

  return NextResponse.json({ added: toInsert.length, scanned: columnList.length, top });
}
