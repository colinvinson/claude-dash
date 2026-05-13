import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeNextRun } from "@/lib/jarvis/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: workers } = await supabase
    .from("jarvis_workers")
    .select("id, name, description, schedule, allowed_tools, is_active, last_run_at, next_run_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Include each worker's most recent run summary
  const ids = (workers ?? []).map((w) => w.id);
  const { data: latestRuns } = ids.length > 0
    ? await supabase
        .from("jarvis_worker_runs")
        .select("worker_id, status, ai_summary, completed_at, started_at")
        .in("worker_id", ids)
        .order("started_at", { ascending: false })
    : { data: [] };

  const latestByWorker = new Map<string, { status: string; ai_summary: string | null; completed_at: string | null }>();
  for (const r of (latestRuns ?? [])) {
    if (!latestByWorker.has(r.worker_id)) {
      latestByWorker.set(r.worker_id, { status: r.status, ai_summary: r.ai_summary, completed_at: r.completed_at });
    }
  }

  const enriched = (workers ?? []).map((w) => ({
    ...w,
    latest_run: latestByWorker.get(w.id) ?? null,
  }));

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    name: string;
    description?: string;
    system_prompt: string;
    schedule?: string;
    allowed_tools?: string[];
  };

  if (!body.name?.trim() || !body.system_prompt?.trim()) {
    return NextResponse.json({ error: "name and system_prompt required" }, { status: 400 });
  }

  const next_run_at = body.schedule ? computeNextRun(body.schedule) : null;

  const { data, error } = await supabase.from("jarvis_workers").insert({
    user_id: user.id,
    name: body.name.trim(),
    description: body.description?.trim() ?? null,
    system_prompt: body.system_prompt.trim(),
    schedule: body.schedule ?? null,
    allowed_tools: body.allowed_tools ?? [],
    next_run_at,
  }).select("id, name").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
