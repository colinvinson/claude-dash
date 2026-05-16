import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildRunPrompt } from "@/lib/businesses/agent-prompts";
import { nextRunAfter, type ScheduleKind } from "@/lib/businesses/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Vercel Cron handler — fires every 5 min (configured in vercel.json).
// For each business_agent whose schedule is due, builds the same deploy
// prompt the manual Run button would, inserts a jarvis_cc_dispatches
// row, and bumps last_run_at + next_run_at. Bridge daemon on Sir's Mac
// picks the row up the next time it's online; if Mac is off, the row
// waits — no scheduled run gets dropped.
//
// Vercel guards this route via the CRON_SECRET env var. Any request
// missing the matching Authorization header is rejected with 401.

type AgentRow = {
  id:              string;
  user_id:         string;
  business_id:     string;
  agent_name:      string | null;
  role_label:      string;
  purpose:         string | null;
  schedule_kind:   ScheduleKind;
  schedule_hour:   number | null;
  schedule_dow:    number | null;
  schedule_dom:    number | null;
};

type BizRow = {
  id:              string;
  name:            string;
  status:          string;
  monthly_revenue: number;
  customer_count:  number;
  next_action:     string | null;
};

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb  = createServiceClient();
  const now = new Date();

  const { data: dueAgents, error: queryErr } = await sb
    .from("business_agents")
    .select("id, user_id, business_id, agent_name, role_label, purpose, schedule_kind, schedule_hour, schedule_dow, schedule_dom")
    .neq("schedule_kind", "none")
    .lte("next_run_at", now.toISOString())
    .order("next_run_at", { ascending: true })
    .limit(50);

  if (queryErr) return NextResponse.json({ error: queryErr.message }, { status: 500 });

  const due = (dueAgents ?? []) as AgentRow[];
  if (due.length === 0) {
    return NextResponse.json({ fired: 0 });
  }

  // Load every referenced business in one shot so we don't issue N
  // queries when several agents on the same business fire together.
  const bizIds = Array.from(new Set(due.map((a) => a.business_id)));
  const { data: bizRows } = await sb
    .from("businesses")
    .select("id, name, status, monthly_revenue, customer_count, next_action")
    .in("id", bizIds);
  const bizById = new Map<string, BizRow>(
    ((bizRows ?? []) as BizRow[]).map((b) => [b.id, { ...b, monthly_revenue: Number(b.monthly_revenue) || 0, customer_count: Number(b.customer_count) || 0 }]),
  );

  let fired = 0;
  const errors: string[] = [];

  for (const a of due) {
    const biz = bizById.get(a.business_id);
    if (!biz) { errors.push(`business ${a.business_id} not found for agent ${a.id}`); continue; }

    const prompt = buildRunPrompt({
      business:        biz,
      businessAgentId: a.id,
      agentName:       a.agent_name,
      roleLabel:       a.role_label,
      purpose:         a.purpose,
      scheduled:       true,
    });

    // Insert the dispatch row — same path as the manual Run button via
    // the Tauri/PWA bridge layer. Bridge daemon will pick this up on
    // its next realtime tick (or its startup drainPending pass).
    const { error: dispErr } = await sb
      .from("jarvis_cc_dispatches")
      .insert({
        user_id: a.user_id,
        kind:    "run",
        payload: { agentName: a.agent_name ?? undefined, prompt },
      });
    if (dispErr) { errors.push(`dispatch failed for agent ${a.id}: ${dispErr.message}`); continue; }

    // Compute the next run time from the schedule, anchored to now (not
    // the previous next_run_at) so a cron that recovers from a stall
    // doesn't fire a backlog of missed runs.
    const next = nextRunAfter({
      kind: a.schedule_kind,
      hour: a.schedule_hour ?? undefined,
      dow:  a.schedule_dow  ?? undefined,
      dom:  a.schedule_dom  ?? undefined,
    }, now);

    await sb.from("business_agents").update({
      last_run_at: now.toISOString(),
      next_run_at: next?.toISOString() ?? null,
    }).eq("id", a.id);

    fired++;
  }

  return NextResponse.json({ fired, errors });
}
