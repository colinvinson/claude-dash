"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export type ToolExecution = { name: string; message: string; ok: boolean };

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
  tools?: ToolExecution[];
};

export function useOverseer() {
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [userId,    setUserId]    = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("overseer_messages")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(50);

      setMessages(data ?? []);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (content: string) => {
    if (!userId || streaming || !content.trim()) return;
    setStreaming(true);

    const userMsg: Message = {
      id: crypto.randomUUID(), role: "user", content,
      created_at: new Date().toISOString(),
    };
    const assistantId = crypto.randomUUID();
    const assistantPlaceholder: Message = {
      id: assistantId, role: "assistant", content: "",
      created_at: new Date().toISOString(),
      tools: [],
    };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);

    try {
      const res = await fetch("/api/overseer/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.body) throw new Error("No stream");
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      const collectedTools: ToolExecution[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw) as { text?: string; tool?: ToolExecution };
            if (parsed.text) {
              accumulated += parsed.text;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, content: accumulated } : m)
              );
            }
            if (parsed.tool) {
              collectedTools.push(parsed.tool);
              setMessages((prev) =>
                prev.map((m) => m.id === assistantId ? { ...m, tools: [...collectedTools] } : m)
              );
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
      setMessages((prev) =>
        prev.map((m) => m.id === assistantId ? { ...m, content: "⚠ Error connecting to Overseer." } : m)
      );
    } finally {
      setStreaming(false);
    }
  }, [userId, streaming]);

  return { messages, streaming, send };
}
