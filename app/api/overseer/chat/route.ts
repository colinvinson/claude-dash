import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { buildContext } from "@/lib/ai/context-builder";
import { buildSystemPrompt } from "@/lib/ai/prompts";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { content } = await req.json();
  const service = createServiceClient();

  // Fetch last 20 messages for conversation history
  const { data: history } = await service
    .from("overseer_messages")
    .select("role, content")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(20);

  // Save user message
  await service.from("overseer_messages").insert({
    user_id: user.id,
    role: "user",
    content,
  });

  const context = await buildContext(user.id);
  const systemPrompt = buildSystemPrompt(context);

  const messages = [
    ...(history ?? []).map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content },
  ];

  let fullResponse = "";

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (text: string) =>
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text })}\n\n`));

      const anthropicStream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 512,
        system: systemPrompt,
        messages,
      });

      for await (const event of anthropicStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          fullResponse += event.delta.text;
          encode(event.delta.text);
        }
      }

      controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
      controller.close();

      // Save assistant message after stream completes
      await service.from("overseer_messages").insert({
        user_id: user.id,
        role: "assistant",
        content: fullResponse,
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
