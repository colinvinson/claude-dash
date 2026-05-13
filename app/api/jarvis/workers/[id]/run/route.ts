import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runWorker } from "@/lib/jarvis/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;  // worker runs can take a while

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership
  const { data: worker } = await supabase
    .from("jarvis_workers")
    .select("id")
    .eq("id", id).eq("user_id", user.id).single();
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { instructions?: string };

  // Run synchronously (max 60s — Vercel function timeout)
  const service = createServiceClient();
  await runWorker(service, id, body.instructions);

  return NextResponse.json({ ok: true });
}
