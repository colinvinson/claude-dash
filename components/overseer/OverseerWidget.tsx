"use client";

import { useState, useRef, useEffect } from "react";
import { useOverseer } from "@/hooks/useOverseer";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/layout/SectionLabel";
import { Send, Mic } from "lucide-react";

export default function OverseerWidget() {
  const { messages, streaming, send } = useOverseer();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    send(text);
    setInput("");
  }

  return (
    <div>
      <SectionLabel>Overseer</SectionLabel>
      <Card className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-sm select-none">
            ✦
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-zinc-100">Overseer</span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[10px] text-green-400">online</span>
              </span>
            </div>
            <span className="text-[11px] text-zinc-500">Knows your dashboard. Ask anything.</span>
          </div>
        </div>

        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-xs text-zinc-600 italic">Start a conversation…</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-zinc-700 text-zinc-100" : "bg-zinc-800 text-zinc-200"
              }`}>
                {m.content}
                {m.content === "" && streaming && (
                  <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse rounded-sm ml-0.5" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex items-center gap-2 bg-zinc-800 rounded-xl px-3 py-2">
          <Mic size={15} className="text-zinc-500 flex-shrink-0" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Message Overseer…"
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-600 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="w-7 h-7 rounded-full bg-white flex items-center justify-center flex-shrink-0 hover:bg-zinc-200 transition-colors disabled:opacity-40"
          >
            <Send size={12} className="text-zinc-900 ml-0.5" />
          </button>
        </div>
      </Card>
    </div>
  );
}
