import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { runWorker } from "@/lib/jarvis/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron-triggered dispatcher. Runs every 15min.
// Auth: Vercel attaches a `Authorization: Bearer <CRON_SECRET>` header automatically
// when the cron is defined in vercel.json — we verify it.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: due } = await service
    .from("jarvis_workers")
    .select("id")
    .eq("is_active", true)
    .not("next_run_at", "is", null)
    .lte("next_run_at", nowIso)
    .limit(10);

  if (!due || due.length === 0) {
    return NextResponse.json({ ran: 0 });
  }

  // Fire all due workers in parallel. Each runWorker handles its own state + persistence.
  await Promise.allSettled(due.map((w) => runWorker(service, w.id)));

  return NextResponse.json({ ran: due.length });
}
