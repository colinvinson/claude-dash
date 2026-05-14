import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pushToUser } from "@/lib/jarvis/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Fire a test notification to all of the authenticated user's subscribed
// devices. Use to confirm push is wired correctly end-to-end.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { title?: string; body?: string };

  try {
    const { sent, failed } = await pushToUser(user.id, {
      title: body.title ?? "Jarvis",
      body:  body.body  ?? "Test notification — push is wired.",
      tag:   "jarvis-test",
      renotify: true,
    });
    return NextResponse.json({ ok: true, sent, failed });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
