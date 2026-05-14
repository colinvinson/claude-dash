import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";
import { buildAnalysisPrompt, buildTodaysCallPrompt } from "@/lib/ai/prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ insight: null }, { status: 401 });

  const service = createServiceClient();
  const context = await buildContext(user.id);
  const { biometrics } = context as { biometrics: Record<string, unknown> | null };

  // Run proactive insight analysis + optional TodaysCall in parallel
  const tasks: Promise<void>[] = [];

  // 1. Standard proactive insight (shown as banner)
  const insightTask = anthropic.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 200,
    messages:   [{ role: "user", content: buildAnalysisPrompt(context) }],
  }).then(async (message) => {
    const raw = (message.content[0] as { text: string }).text.trim();
    if (raw === "null" || !raw.startsWith("{")) return;
    try {
      const parsed = JSON.parse(raw) as { insight: string; severity: string };
      await service.from("jarvis_insights").insert({
        user_id:  user.id,
        body:     parsed.insight,
        severity: parsed.severity ?? "green",
      });
      // Push notify on yellow/red severity — green is informational + skippable.
      if (parsed.severity === "yellow" || parsed.severity === "red") {
        try {
          const { pushToUser } = await import("@/lib/jarvis/push");
          await pushToUser(user.id, {
            title: parsed.severity === "red" ? "Jarvis — action needed" : "Jarvis — heads up",
            body:  parsed.insight.slice(0, 240),
            tag:   "jarvis-insight",
            renotify: true,
            url:   "/home",
          });
        } catch { /* push not configured / no subs — silent */ }
      }
    } catch { /* ignore parse errors */ }
  });
  tasks.push(insightTask);

  // 2. TodaysCall — only generate if we have Oura biometrics but no call yet
  let todaysCallResult: { headline: string; severity: string } | null = null;
  if (biometrics?.readiness) {
    const today = new Date().toISOString().split("T")[0];
    const { data: existingLog } = await service
      .from("health_logs")
      .select("todays_call_body")
      .eq("user_id", user.id)
      .eq("date", today)
      .single();

    if (!existingLog?.todays_call_body) {
      const callTask = anthropic.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 150,
        messages:   [{ role: "user", content: buildTodaysCallPrompt(context) }],
      }).then(async (message) => {
        const raw = (message.content[0] as { text: string }).text.trim();
        if (!raw.startsWith("{")) return;
        try {
          const parsed = JSON.parse(raw) as { headline: string; severity: string };
          await service.from("health_logs").update({
            todays_call_body:     parsed.headline,
            todays_call_severity: parsed.severity ?? "green",
          }).eq("user_id", user.id).eq("date", today);
          todaysCallResult = parsed;
        } catch { /* ignore parse errors */ }
      });
      tasks.push(callTask);
    }
  }

  await Promise.allSettled(tasks);

  // Return the latest insight for the banner
  const { data: latestInsight } = await service
    .from("jarvis_insights")
    .select("body, severity")
    .eq("user_id", user.id)
    .order("triggered_at", { ascending: false })
    .limit(1)
    .single();

  return NextResponse.json({
    insight:    latestInsight?.body ?? null,
    severity:   latestInsight?.severity ?? null,
    todaysCall: todaysCallResult,
  });
}
