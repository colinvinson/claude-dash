// Worker runner — executes a single jarvis_worker run.
// Called from cron dispatcher and from /api/jarvis/workers/[id]/run.

import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildContext } from "@/lib/ai/context-builder";
import { WORKER_TOOLS, CODE_EXECUTION_BETA, executeTool, type ToolResult } from "@/lib/ai/tools";
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

    // Filter tools to the allowed list (or all if none specified).
    // WORKER_TOOLS includes code_execution which Anthropic runs server-side.
    const tools = w.allowed_tools && w.allowed_tools.length > 0
      ? WORKER_TOOLS.filter((t) => w.allowed_tools.includes(t.name))
      : WORKER_TOOLS;

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

    // Loop until Claude returns no more tool uses (max 5 iterations to prevent runaway).
    // Beta header enables the server-side code_execution tool included in WORKER_TOOLS.
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: systemPrompt,
        tools,
        messages: messages as Anthropic.MessageParam[],
      }, {
        headers: { "anthropic-beta": CODE_EXECUTION_BETA },
      });

      // Collect text + tool uses. Pass server-tool blocks (e.g. code_execution) through
      // by using response.content directly as the next turn's assistant message — Anthropic
      // needs the full block sequence to maintain conversational state.
      const pendingTools: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
      type AnyBlock = { type: string; text?: string; id?: string; name?: string; input?: unknown };

      for (const block of response.content as AnyBlock[]) {
        if (block.type === "text" && typeof block.text === "string") {
          finalText += block.text;
        } else if (block.type === "tool_use" && block.id && block.name) {
          pendingTools.push({ id: block.id, name: block.name, input: (block.input ?? {}) as Record<string, unknown> });
        }
        // server_tool_use + code_execution_tool_result blocks: ignore here — Anthropic handles them.
      }
      // Push raw response.content (preserves server-tool blocks) — cast to satisfy types.
      messages.push({ role: "assistant", content: response.content as unknown as ContentBlock[] });

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

  // Post-run Haiku passes:
  //   1) Generate one-line summary headline.
  //   2) Extract ONE durable lesson the worker should remember for next time (compound improvement).
  let aiSummary: string | null = null;
  let lesson: string | null = null;
  if (finalText) {
    try {
      const [summaryMessage, lessonMessage] = await Promise.all([
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 80,
          messages: [{
            role: "user",
            content: `Compress this worker output into one punchy headline sentence (start with a verb, max 15 words). Output ONLY the sentence.\n\nOutput:\n${finalText.slice(0, 2000)}`,
          }],
        }),
        anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 120,
          messages: [{
            role: "user",
            content: `You are reviewing one run of an autonomous worker named "${w.name}" so its NEXT run is better.

Worker's job (system prompt):
${w.system_prompt.slice(0, 800)}

This run's output:
${finalText.slice(0, 2000)}

This run's tool calls (summary):
${JSON.stringify(toolCalls.map((c) => ({ name: c.name, ok: c.result.ok }))).slice(0, 500)}

What is ONE specific lesson this worker should remember for next time — something that would make its next run better (faster, more accurate, more focused, avoids a problem it hit, uses a better source/method)?

If the run was routine and there's nothing worth saving as a durable lesson, respond with EXACTLY: NONE

Otherwise respond with ONE short sentence (max 25 words). Just the lesson — no preamble, no "the lesson is".`,
          }],
        }),
      ]);
      aiSummary = (summaryMessage.content[0] as { text: string }).text.trim();
      const lessonText = (lessonMessage.content[0] as { text: string }).text.trim();
      if (lessonText && lessonText !== "NONE" && lessonText.length >= 5) lesson = lessonText;
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

  // Compound-improvement: append lesson to worker's learned_facts.lessons (FIFO, cap 50).
  const existingFacts: { lessons?: string[]; [k: string]: unknown } = (w.learned_facts ?? {}) as { lessons?: string[]; [k: string]: unknown };
  let updatedLearned: { lessons?: string[]; [k: string]: unknown } | undefined = undefined;
  if (lesson) {
    const lessons = [...(existingFacts.lessons ?? []), lesson].slice(-50);
    updatedLearned = { ...existingFacts, lessons };
  }

  // Update worker's last_run_at + next_run_at (and learned_facts if we have a new lesson)
  const nextRunAt = w.schedule ? computeNextRun(w.schedule) : null;
  await service.from("jarvis_workers").update({
    last_run_at: new Date().toISOString(),
    next_run_at: nextRunAt,
    ...(updatedLearned ? { learned_facts: updatedLearned } : {}),
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
