import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// Wake-confirm endpoint. Hit by an iOS Shortcut on NFC-tag tap when Sir
// gets out of bed (the tag dismisses Alarmy AND fires this in one act).
//
// Bearer token auth (the Shortcut can't sign in with cookies). Token is
// shared between Shortcut + the WAKE_CONFIRM_TOKEN env var. Service-role
// client writes the row — RLS is enforced by the user_id being baked
// into the token's resolved user_id (configured via WAKE_CONFIRM_USER_ID).
//
// Idempotent on (user_id, date): a second tap on the same calendar day
// no-ops rather than overwriting the first wake time — the *first* tap
// is the truthful "got out of bed at" moment.

function todayLocalDate(now: Date): string {
  // Local YYYY-MM-DD (not UTC). Matches how other Rowan code keys days.
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function POST(req: NextRequest) {
  const token = process.env.WAKE_CONFIRM_TOKEN;
  const userId = process.env.WAKE_CONFIRM_USER_ID;
  if (!token || !userId) {
    return NextResponse.json({ error: "WAKE_CONFIRM_TOKEN / WAKE_CONFIRM_USER_ID not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${token}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const date = todayLocalDate(now);
  const service = createServiceClient();

  // Compute target_at + on_time from today's profile setting.
  const { data: profile } = await service
    .from("profiles")
    .select("wake_target_time")
    .eq("id", userId)
    .single();
  const targetTime: string | null = (profile?.wake_target_time as string) ?? "07:30:00";
  let targetAt: Date | null = null;
  let onTime: boolean | null = null;
  if (targetTime) {
    const [hh, mm, ss] = targetTime.split(":").map(Number);
    targetAt = new Date(now);
    targetAt.setHours(hh ?? 7, mm ?? 30, ss ?? 0, 0);
    onTime = now.getTime() <= targetAt.getTime();
  }

  // Idempotent insert — skip if a wake_log for today already exists.
  const { data: existing } = await service
    .from("wake_logs")
    .select("id, wake_at, on_time")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      wake_at: existing.wake_at,
      on_time: existing.on_time,
    });
  }

  const { error } = await service.from("wake_logs").insert({
    user_id:   userId,
    date,
    wake_at:   now.toISOString(),
    target_at: targetAt?.toISOString() ?? null,
    on_time:   onTime,
    source:    "nfc",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, wake_at: now.toISOString(), on_time: onTime });
}
