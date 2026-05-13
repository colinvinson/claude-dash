import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";
import { buildJarvisSystemPrompt } from "@/lib/jarvis/prompts";
import { getRelevantFacts } from "@/lib/jarvis/memory";
import { ALL_JARVIS_TOOLS, NATIVE_TOOLS, NATIVE_TOOL_NAMES, executeTool, type ToolResult } from "@/lib/ai/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

type AssistantBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

// Tool results the client just executed on native side — these come back from
// the user when resuming a paused conversation. `content` may be a string or
// an array of content blocks (e.g. for screenshots, an image block).
type ResumeToolResult = {
  tool_use_id: string;
  content: string | Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  >;
  is_error?: boolean;
};

type ResumeFrom = {
  // The Anthropic-format messages array up to the point Jarvis paused.
  // Last assistant turn includes the native tool_use blocks Claude wanted to fire.
  messages: Anthropic.MessageParam[];
  toolResults: ResumeToolResult[];
};

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json() as {
    content?: string;
    history?: ChatMessage[];
    tauriMode?: boolean;
    resumeFrom?: ResumeFrom;
  };
  const { content, history, tauriMode, resumeFrom } = body;
  const service = createServiceClient();

  const [context, facts] = await Promise.all([
    buildContext(user.id),
    getRelevantFacts(service, user.id, undefined, 40),
  ]);

  const systemPrompt = buildJarvisSystemPrompt(context, facts);
  const toolset: Anthropic.Tool[] = tauriMode ? [...ALL_JARVIS_TOOLS, ...NATIVE_TOOLS] : ALL_JARVIS_TOOLS;

  // Initial message stack — either a fresh user message OR a resume from native tool execution.
  let messages: Anthropic.MessageParam[];
  if (resumeFrom) {
    messages = [
      ...resumeFrom.messages,
      { role: "user", content: resumeFrom.toolResults.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.tool_use_id,
          content: r.content as never,
          is_error: r.is_error,
        })) },
    ];
  } else {
    messages = [
      ...((history ?? []).map((m) => ({ role: m.role, content: m.content as string }))) as Anthropic.MessageParam[],
      { role: "user", content: content ?? "" },
    ];
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendText = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      const sendTool = (tool: { name: string; message: string; ok: boolean }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool })}\n\n`));
      const sendOpenUrl = (url: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ openUrl: url })}\n\n`));
      const sendPendingNative = (payload: {
        messages: Anthropic.MessageParam[];
        nativeCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>;
      }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ pendingNative: payload })}\n\n`));
      const done = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      try {
        // Loop until Claude returns no tool_use, or until we yield to the client for native tools.
        for (let turn = 0; turn < 6; turn++) {
          const anthropicStream = anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 1200,
            system: systemPrompt,
            tools: toolset,
            messages,
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
                sendText(event.delta.text);
              } else if (event.delta.type === "input_json_delta") {
                toolInputBuffer += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (currentBlock?.type === "tool_use") {
                try { currentBlock.input = toolInputBuffer ? JSON.parse(toolInputBuffer) : {}; }
                catch { currentBlock.input = {}; }
              }
              if (currentBlock) blocks.push(currentBlock);
              currentBlock = null;
            }
          }

          const toolUses = blocks.filter((b): b is Extract<AssistantBlock, { type: "tool_use" }> => b.type === "tool_use");
          if (toolUses.length === 0) {
            // Done — nothing left to do, just text.
            break;
          }

          const nativeCalls = toolUses.filter((t) => NATIVE_TOOL_NAMES.has(t.name));
          const serverCalls = toolUses.filter((t) => !NATIVE_TOOL_NAMES.has(t.name));

          // Execute every SERVER tool right here (same as before).
          const serverResults: Array<{ id: string; result: ToolResult }> = [];
          for (const tool of serverCalls) {
            const result = await executeTool(supabase, user.id, tool.name, tool.input);
            serverResults.push({ id: tool.id, result });

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

          // Surface the native tool calls in the UI so the user sees what's about to happen on their machine.
          for (const tool of nativeCalls) {
            sendTool({ name: tool.name, message: "Pending on desktop…", ok: true });
          }

          if (nativeCalls.length === 0) {
            // Pure server-side turn — append assistant + tool_results to messages and loop again.
            messages = [
              ...messages,
              { role: "assistant", content: blocks as Anthropic.ContentBlockParam[] },
              { role: "user", content: serverResults.map((r) => ({
                  type: "tool_result" as const,
                  tool_use_id: r.id,
                  content: r.result.ok ? r.result.message.replace(/^__OPEN_URL__/, "Opened ") : `Error: ${r.result.error}`,
                  is_error: !r.result.ok,
                })) },
            ];
            continue;
          }

          // Native tools present — yield to the client to execute, then resume.
          // Anthropic does not allow two consecutive user turns, so server tool_results must
          // be merged with native tool_results into ONE user message when the client resumes.
          // We send server results alongside so the client can do that merge.
          const pendingMessages: Anthropic.MessageParam[] = [
            ...messages,
            { role: "assistant", content: blocks as Anthropic.ContentBlockParam[] },
          ];

          sendPendingNative({
            messages: pendingMessages,
            nativeCalls: nativeCalls.map((t) => ({ id: t.id, name: t.name, input: t.input })),
          });

          if (serverResults.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              priorServerResults: serverResults.map((r) => ({
                tool_use_id: r.id,
                content: r.result.ok ? r.result.message.replace(/^__OPEN_URL__/, "Opened ") : `Error: ${r.result.error}`,
                is_error: !r.result.ok,
              })),
            })}\n\n`));
          }

          done();
          controller.close();
          return;
        }
      } catch (err) {
        const msg = (err as Error)?.message ?? "unknown";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
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
