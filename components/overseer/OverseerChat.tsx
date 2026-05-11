"use client";

import { useState, useRef, useEffect } from "react";
import { useOverseer } from "@/hooks/useOverseer";
import { Send } from "lucide-react";

export default function OverseerChat() {
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
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3 flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm select-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          ✦
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">Overseer</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-green-400">online</span>
            </span>
          </div>
          <span className="text-[11px] text-zinc-500">Your 24/7 life coach. Knows everything.</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <span className="text-4xl mb-3">✦</span>
            <p className="text-sm text-zinc-400 font-medium">Ask Overseer anything</p>
            <p className="text-xs text-zinc-600 mt-1">Health, fitness, goals, finances, mindset...</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[88%] flex flex-col gap-1.5">
              {m.tools && m.tools.length > 0 && (
                <div className={`flex flex-wrap gap-1.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.tools.map((t, i) => (
                    <span
                      key={i}
                      className="text-[11px] font-medium px-2 py-1 rounded-full"
                      style={{
                        background: t.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
                        color: t.ok ? "#6ee7b7" : "#fca5a5",
                        border: `1px solid ${t.ok ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`,
                      }}
                    >
                      {t.ok ? "✓" : "⚠"} {t.message}
                    </span>
                  ))}
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === "user" ? "rounded-br-sm" : "rounded-bl-sm"
                }`}
                style={{
                  background: m.role === "user"
                    ? "rgba(255,255,255,0.1)"
                    : "rgba(255,255,255,0.05)",
                  color: m.role === "user" ? "#f4f4f5" : "#d4d4d8",
                }}
              >
                {m.content}
                {m.content === "" && streaming && (!m.tools || m.tools.length === 0) && (
                  <span className="inline-block w-1.5 h-4 bg-zinc-400 animate-pulse rounded-sm ml-0.5" />
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="flex items-center gap-2 mx-4 mb-4 px-4 py-2.5 rounded-2xl flex-shrink-0"
        style={{
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
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
    </div>
  );
}
