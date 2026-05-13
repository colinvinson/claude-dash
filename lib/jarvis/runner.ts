// Worker runner — executes a single jarvis_worker run.
// Called from cron dispatcher and from /api/jarvis/workers/[id]/run.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildContext } from "@/lib/ai/context-builder";
import { ALL_JARVIS_TOOLS, executeTool, type ToolResult } from "@/lib/ai/tools";
import { buildWorkerSystemPrompt } from "./prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type WorkerRow = {
  id: string;
  user_id: string;
  name: string;
  system_prompt: string;
  allowed_tools: string[];
  learned_facts: Record<string, unknown>;
  schedule: string | null;
};

export async function runWorker(service: SupabaseClient, workerId: string, oneShotInstructions?: string) {
  const { data: worker } = await service
    .from("jarvis_workers")
    .select("id, user_id, name, system_prompt, allowed_tools, learned_facts, schedule")
    .eq("id", workerId)
    .single();
  if (!worker) return;

  const w = worker as WorkerRow;

  const { data: runRow } = await service.from("jarvis_worker_runs").insert({
    worker_id: w.id,
    user_id: w.user_id,
    status: "running",
  }).select("id").single();
  const runId = runRow?.id;

  const toolCalls: Array<{ name: string; input: unknown; result: ToolResult }> = [];
  let finalText = "";
  let runError: string | null = null;

  try {
    const context = await buildContext(w.user_id);
    const systemPrompt = buildWorkerSystemPrompt(w.name, w.system_prompt, w.learned_facts ?? {}, context);

    // Filter tools to the allowed list (or all if none specified)
    const tools = w.allowed_tools && w.allowed_tools.length > 0
      ? ALL_JARVIS_TOOLS.filter((t) => w.allowed_tools.includes(t.name))
      : ALL_JARVIS_TOOLS;

    // Initial user prompt — either the override or a generic "do your job" instruction
    const userPrompt = oneShotInstructions
      ? oneShotInstructions
      : `Run your assigned job. When finished, output a one-sentence summary headline (start with a verb).`;

    type ContentBlock =
      | { type: "text"; text: string }
      | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
      | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

    const messages: Array<{ role: "user" | "assistant"; content: string | ContentBlock[] }> = [
      { role: "user", content: userPrompt },
    ];

    // Loop until Claude returns no more tool uses (max 5 iterations to prevent runaway)
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        tools,
        messages: messages as Anthropic.MessageParam[],
      });

      // Collect text + tool uses
      const assistantBlocks: ContentBlock[] = [];
      const pendingTools: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

      for (const block of response.content) {
        if (block.type === "text") {
          finalText += block.text;
          assistantBlocks.push({ type: "text", text: block.text });
        } else if (block.type === "tool_use") {
          pendingTools.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
          assistantBlocks.push({ type: "tool_use", id: block.id, name: block.name, input: block.input as Record<string, unknown> });
        }
      }
      messages.push({ role: "assistant", content: assistantBlocks });

      if (pendingTools.length === 0 || response.stop_reason !== "tool_use") break;

      // Execute tools (workers use service client + worker's user_id)
      // We re-create a per-call supabase client scoped to the worker's user_id is implicit — service client bypasses RLS but we always pass user_id explicitly.
      const toolResultBlocks: ContentBlock[] = [];
      for (const t of pendingTools) {
        const result = await executeTool(service, w.user_id, t.name, t.input);
        toolCalls.push({ name: t.name, input: t.input, result });
        toolResultBlocks.push({
          type: "tool_result",
          tool_use_id: t.id,
          content: result.ok ? result.message : `Error: ${result.error}`,
          is_error: !result.ok,
        });
      }
      messages.push({ role: "user", content: toolResultBlocks });
    }
  } catch (e) {
    runError = e instanceof Error ? e.message : "Unknown error";
  }

  // Generate one-line summary headline via Haiku
  let aiSummary: string | null = null;
  if (finalText) {
    try {
      const summaryMessage = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80,
        messages: [{
          role: "user",
          content: `Compress this worker output into one punchy headline sentence (start with a verb, max 15 words). Output ONLY the sentence.\n\nOutput:\n${finalText.slice(0, 2000)}`,
        }],
      });
      aiSummary = (summaryMessage.content[0] as { text: string }).text.trim();
    } catch { /* ignore */ }
  }

  // Persist run completion
  if (runId) {
    await service.from("jarvis_worker_runs").update({
      completed_at: new Date().toISOString(),
      status: runError ? "error" : "success",
      output: finalText || null,
      ai_summary: aiSummary,
      error: runError,
      tool_calls: toolCalls,
    }).eq("id", runId);
  }

  // Update worker's last_run_at + next_run_at
  const nextRunAt = w.schedule ? computeNextRun(w.schedule) : null;
  await service.from("jarvis_workers").update({
    last_run_at: new Date().toISOString(),
    next_run_at: nextRunAt,
  }).eq("id", w.id);
}

// Minimal cron parser — supports "*/N * * * *" and "M H * * *" (daily-at-time).
// Anything more complex is treated as 1 hour from now.
export function computeNextRun(schedule: string): string {
  const now = new Date();
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) {
    now.setHours(now.getHours() + 1);
    return now.toISOString();
  }
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Every N minutes pattern: */N * * * *
  if (minute.startsWith("*/") && hour === "*" && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const n = parseInt(minute.slice(2), 10) || 60;
    const next = new Date(now.getTime() + n * 60_000);
    return next.toISOString();
  }

  // Daily at H:M pattern: M H * * *
  if (/^\d+$/.test(minute) && /^\d+$/.test(hour) && dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    const m = parseInt(minute, 10);
    const h = parseInt(hour, 10);
    const next = new Date(now);
    next.setHours(h, m, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.toISOString();
  }

  // Fallback: 1 hour from now
  now.setHours(now.getHours() + 1);
  return now.toISOString();
}
