import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { OVERSEER_TOOLS, executeTool, type ToolResult } from "@/lib/ai/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

type CollectedTool = { id: string; name: string; input: string; result?: ToolResult };

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { content } = await req.json();
  const service = createServiceClient();

  const { data: history } = await service
    .from("overseer_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20);

  await service.from("overseer_messages").insert({
    user_id: user.id,
    role: "user",
    content,
  });

  const context = await buildContext(user.id);
  const systemPrompt = buildSystemPrompt(context);

  // Type for assistant content blocks we accumulate during streaming
  type AssistantBlock =
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };

  const initialMessages: Array<{ role: "user" | "assistant"; content: string | AssistantBlock[] }> =
    [...((history ?? []) as ChatMessage[])
      .map((m) => ({ role: m.role, content: m.content as string }))
    , { role: "user" as const, content }];

  let fullText = "";
  const tools: CollectedTool[] = [];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendText = (text: string) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
      const sendTool = (tool: { name: string; message: string; ok: boolean }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool })}\n\n`));
      const done = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"));

      // Helper that runs ONE Claude streaming call. Mutates `tools` and `fullText`.
      async function runOnce(messages: typeof initialMessages): Promise<{
        assistantBlocks: AssistantBlock[];
      }> {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 700,
          system: systemPrompt,
          tools: OVERSEER_TOOLS,
          messages,
        });

        let currentBlock: AssistantBlock | null = null;
        let toolInputBuffer = "";
        const blocks: AssistantBlock[] = [];

        for await (const event of anthropicStream) {
          if (event.type === "content_block_start") {
            const b = event.content_block;
            if (b.type === "text") {
              currentBlock = { type: "text", text: "" };
            } else if (b.type === "tool_use") {
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
              try {
                currentBlock.input = toolInputBuffer ? JSON.parse(toolInputBuffer) : {};
              } catch {
                currentBlock.input = {};
              }
              tools.push({ id: currentBlock.id, name: currentBlock.name, input: toolInputBuffer });
            }
            if (currentBlock) blocks.push(currentBlock);
            currentBlock = null;
          }
        }

        return { assistantBlocks: blocks };
      }

      // First pass — Claude may emit text + tool_use blocks
      const { assistantBlocks: firstBlocks } = await runOnce(initialMessages);

      // If tools were called, execute them and loop back for confirmation
      if (tools.length > 0) {
        for (const tool of tools) {
          let input: Record<string, unknown> = {};
          try { input = tool.input ? JSON.parse(tool.input) : {}; } catch {}
          const result = await executeTool(supabase, user.id, tool.name, input);
          tool.result = result;
          sendTool({
            name: tool.name,
            message: result.ok ? result.message : `Failed: ${result.error}`,
            ok: result.ok,
          });
        }

        // Build follow-up messages with tool_result
        const toolResultBlocks = tools.map((t) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: t.result?.ok ? t.result.message : `Error: ${t.result?.error ?? "unknown"}`,
          is_error: !t.result?.ok,
        }));

        const followUpMessages: typeof initialMessages = [
          ...initialMessages,
          { role: "assistant", content: firstBlocks },
          { role: "user", content: toolResultBlocks as unknown as AssistantBlock[] },
        ];

        // Second pass — Claude confirms in natural language. Should not emit more tool calls.
        await runOnce(followUpMessages);
      }

      done();
      controller.close();

      await service.from("overseer_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: fullText || "(action completed)",
      });
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
