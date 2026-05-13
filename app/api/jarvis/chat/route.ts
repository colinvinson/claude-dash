import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";
import { buildJarvisSystemPrompt } from "@/lib/jarvis/prompts";
import { getRelevantFacts } from "@/lib/jarvis/memory";
import { ALL_JARVIS_TOOLS, executeTool, type ToolResult } from "@/lib/ai/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };
type CollectedTool = { id: string; name: string; input: string; result?: ToolResult };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { content, history } = await req.json() as { content: string; history?: ChatMessage[] };
  const service = createServiceClient();

  // Build full Jarvis context: dashboard context + facts + workers + recent runs
  const [context, facts, workersRes, runsRes] = await Promise.all([
    buildContext(user.id),
    getRelevantFacts(service, user.id, undefined, 40),
    service.from("jarvis_workers")
      .select("id, name, description, last_run_at, is_active")
      .eq("user_id", user.id).eq("is_active", true),
    service.from("jarvis_worker_runs")
      .select("ai_summary, status, completed_at, jarvis_workers(name)")
      .eq("user_id", user.id)
      .order("started_at", { ascending: false }).limit(10),
  ]);

  const workers = workersRes.data ?? [];
  const recentRuns = (runsRes.data ?? []).map((r) => {
    const w = (r as { jarvis_workers?: { name: string } | { name: string }[] }).jarvis_workers;
    const workerName = Array.isArray(w) ? (w[0]?.name ?? "?") : (w?.name ?? "?");
    return { worker_name: workerName, ai_summary: r.ai_summary, status: r.status, completed_at: r.completed_at };
  });

  const systemPrompt = buildJarvisSystemPrompt(context, facts, workers, recentRuns);

  type AssistantBlock =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

  const initialMessages: Array<{ role: "user" | "assistant"; content: string | AssistantBlock[] | unknown[] }> = [
    ...((history ?? []).map((m) => ({ role: m.role, content: m.content as string }))),
    { role: "user" as const, content },
  ];

  let fullText = "";
  const tools: CollectedTool[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendText = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      const sendTool = (tool: { name: string; message: string; ok: boolean }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool })}\n\n`));
      const sendOpenUrl = (url: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ openUrl: url })}\n\n`));
      const done = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      async function runOnce(messages: typeof initialMessages): Promise<{ blocks: AssistantBlock[] }> {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 800,
          system: systemPrompt,
          tools: ALL_JARVIS_TOOLS,
          messages: messages as Anthropic.MessageParam[],
        });

        let currentBlock: AssistantBlock | null = null;
        let toolInputBuffer = "";
        const blocks: AssistantBlock[] = [];

        for await (const event of anthropicStream) {
          if (event.type === "content_block_start") {
            const b = event.content_block;
            if (b.type === "text") currentBlock = { type: "text", text: "" };
            else if (b.type === "tool_use") {
              currentBlock = { type: "tool_use", id: b.id, name: b.name, input: {} };
              toolInputBuffer = "";
            }
          } else if (event.type === "content_block_delta") {
            if (event.delta.type === "text_delta" && currentBlock?.type === "text") {
              currentBlock.text += event.delta.text;
              fullText += event.delta.text;
              sendText(event.delta.text);
            } else if (event.delta.type === "input_json_delta") {
              toolInputBuffer += event.delta.partial_json;
            }
          } else if (event.type === "content_block_stop") {
            if (currentBlock?.type === "tool_use") {
              try { currentBlock.input = toolInputBuffer ? JSON.parse(toolInputBuffer) : {}; }
              catch { currentBlock.input = {}; }
              tools.push({ id: currentBlock.id, name: currentBlock.name, input: toolInputBuffer });
            }
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = null;
          }
        }
        return { blocks };
      }

      const { blocks: firstBlocks } = await runOnce(initialMessages);

      if (tools.length > 0) {
        for (const tool of tools) {
          let parsed: Record<string, unknown> = {};
          try { parsed = tool.input ? JSON.parse(tool.input) : {}; } catch {}
          const result = await executeTool(supabase, user.id, tool.name, parsed);
          tool.result = result;

          // Special: open_url message format is "__OPEN_URL__<url>"
          if (result.ok && result.message.startsWith("__OPEN_URL__")) {
            const url = result.message.slice("__OPEN_URL__".length);
            sendOpenUrl(url);
            sendTool({ name: tool.name, message: `Opened ${url}`, ok: true });
          } else {
            sendTool({
              name: tool.name,
              message: result.ok ? result.message : `Failed: ${result.error}`,
              ok: result.ok,
            });
          }
        }

        const toolResultBlocks = tools.map((t) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: t.result?.ok ? t.result.message.replace(/^__OPEN_URL__/, "Opened ") : `Error: ${t.result?.error ?? "unknown"}`,
          is_error: !t.result?.ok,
        }));

        const followUpMessages: typeof initialMessages = [
          ...initialMessages,
          { role: "assistant", content: firstBlocks },
          { role: "user", content: toolResultBlocks },
        ];

        await runOnce(followUpMessages);
      }

      done();
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
