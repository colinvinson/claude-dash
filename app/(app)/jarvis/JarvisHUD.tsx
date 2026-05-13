"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mic, MicOff, Send } from "lucide-react";
import { useHealth } from "@/hooks/useHealth";
import { useGoals } from "@/hooks/useGoals";
import { useProtein } from "@/hooks/useProtein";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";
import { listen, speak, cancelSpeech, StreamingSpeaker, primeVoices, speechRecognitionAvailable } from "@/lib/jarvis/voice";
import Orb, { OrbState } from "./Orb";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: Array<{ name: string; message: string; ok: boolean }>;
};

export default function JarvisHUD({ onClose }: { onClose: () => void }) {
  const { health } = useHealth();
  const { streak, goals } = useGoals();
  const { totalToday: proteinToday, target: proteinTarget } = useProtein();
  const { toast } = useToast();

  const [orbState, setOrbState] = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [hasMic, setHasMic] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const speakerRef = useRef<StreamingSpeaker | null>(null);

  // Prime voices on mount (some browsers need this delay)
  useEffect(() => {
    primeVoices();
    setHasMic(speechRecognitionAvailable());
    return () => {
      cancelSpeech();
      recognitionRef.current?.stop();
    };
  }, []);

  function startListening() {
    if (!hasMic || isListening) return;
    cancelSpeech();
    setTranscript("");
    setOrbState("listening");
    setIsListening(true);
    haptic("light");

    const handle = listen({
      onResult: (r) => {
        setTranscript(r.transcript);
        if (r.isFinal) {
          setIsListening(false);
          handle?.stop();
          recognitionRef.current = null;
          sendMessage(r.transcript);
        }
      },
      onError: (msg) => {
        setIsListening(false);
        setOrbState("idle");
        if (msg !== "no-speech") toast(`Mic error: ${msg}`, "error");
      },
      onEnd: () => {
        setIsListening(false);
        if (orbState === "listening") setOrbState("idle");
      },
    });
    recognitionRef.current = handle ?? null;
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setOrbState("idle");
  }

  async function sendMessage(content: string) {
    const text = content.trim();
    if (!text) return;
    const turnId = crypto.randomUUID();
    const assistantId = crypto.randomUUID();

    setChat((prev) => [
      ...prev,
      { id: turnId, role: "user", text },
      { id: assistantId, role: "assistant", text: "", tools: [] },
    ]);
    setTranscript("");
    setTextInput("");
    setOrbState("thinking");

    // Build short history (last 8 turns excluding the placeholder assistant)
    const history = chat.slice(-8).map((t) => ({ role: t.role, content: t.text || " " }));

    speakerRef.current = new StreamingSpeaker();
    let firstChunk = true;

    try {
      const res = await fetch("/api/jarvis/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, history }),
      });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.text) {
              if (firstChunk) { setOrbState("speaking"); firstChunk = false; }
              accumulated += parsed.text;
              speakerRef.current?.feed(parsed.text);
              setChat((prev) =>
                prev.map((t) => t.id === assistantId ? { ...t, text: accumulated } : t)
              );
            }
            if (parsed.tool) {
              setChat((prev) =>
                prev.map((t) => t.id === assistantId ? { ...t, tools: [...(t.tools ?? []), parsed.tool] } : t)
              );
            }
            if (parsed.openUrl && typeof window !== "undefined") {
              window.open(parsed.openUrl, "_blank", "noopener,noreferrer");
            }
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
      toast("Connection error", "error");
    } finally {
      speakerRef.current?.finish(() => setOrbState("idle"));
      // If we never started speaking, return to idle now
      if (firstChunk) setOrbState("idle");
    }
  }

  function handleTextSubmit() {
    if (!textInput.trim()) return;
    sendMessage(textInput);
  }

  // Telemetry strings
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
  const recovery = health.readiness_score != null ? `Recovery ${health.readiness_score}` : "—";
  const goalsDone = goals.filter((g) => g.is_complete).length;
  const lastAssistant = chat.slice().reverse().find((t) => t.role === "assistant" && t.text);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{
        background: "radial-gradient(ellipse at center, #0a0a0f 0%, #050506 80%)",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
      }}
    >
      {/* Close */}
      <button
        onClick={() => { cancelSpeech(); recognitionRef.current?.stop(); onClose(); }}
        className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", marginTop: "env(safe-area-inset-top)" }}
        aria-label="Close"
      >
        <X size={16} className="text-zinc-300" />
      </button>

      {/* Top-left telemetry */}
      <div className="absolute top-6 left-5 z-10" style={{ marginTop: "env(safe-area-inset-top)" }}>
        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{date}</p>
        <p className="text-xl font-semibold text-zinc-200 tabular-nums leading-tight">{time}</p>
        <p className="text-[11px] text-zinc-500 mt-1">{recovery}</p>
      </div>

      {/* Top-right telemetry */}
      <div className="absolute top-6 right-16 z-10 text-right" style={{ marginTop: "env(safe-area-inset-top)" }}>
        <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Today</p>
        <p className="text-xl font-semibold text-zinc-200 tabular-nums leading-tight">{goalsDone}/{goals.length}</p>
        <p className="text-[11px] text-zinc-500 mt-1">{Math.round(proteinToday)}/{proteinTarget}g · {streak}🔥</p>
      </div>

      {/* Center orb */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 anim-fade">
        <Orb state={orbState} size={260} />

        {/* Caption strip */}
        <div className="mt-8 min-h-[80px] max-w-md text-center">
          {transcript && (
            <p className="text-sm text-zinc-400 italic">{transcript}</p>
          )}
          {!transcript && lastAssistant?.text && (
            <p className="text-base text-zinc-200 leading-relaxed">{lastAssistant.text}</p>
          )}
          {!transcript && !lastAssistant?.text && orbState === "idle" && (
            <p className="text-sm text-zinc-600">Sir. {hasMic ? "Hold the mic and speak." : "Type below to begin."}</p>
          )}
        </div>

        {/* Tool chips for last assistant turn */}
        {lastAssistant?.tools && lastAssistant.tools.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 justify-center max-w-md">
            {lastAssistant.tools.map((t, i) => (
              <span
                key={i}
                className="text-[10px] font-medium px-2 py-1 rounded-full"
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
      </div>

      {/* Bottom controls */}
      <div className="px-4 flex items-center gap-2">
        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
          placeholder={hasMic ? "Or type…" : "Type to Jarvis…"}
          className="flex-1 px-4 py-3 rounded-full text-sm outline-none"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#fafafa",
          }}
        />
        <button
          onClick={handleTextSubmit}
          disabled={!textInput.trim()}
          className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-30"
          style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.12)" }}
          aria-label="Send"
        >
          <Send size={14} className="text-zinc-200" />
        </button>
        {hasMic && (
          <button
            onPointerDown={startListening}
            onPointerUp={stopListening}
            onPointerLeave={() => isListening && stopListening()}
            className="w-13 h-13 rounded-full flex items-center justify-center"
            style={{
              width: 52,
              height: 52,
              background: isListening
                ? "linear-gradient(180deg, rgba(6,182,212,0.5), rgba(6,182,212,0.25))"
                : "linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06))",
              border: `1px solid ${isListening ? "rgba(6,182,212,0.55)" : "rgba(255,255,255,0.14)"}`,
              boxShadow: isListening ? "0 0 24px rgba(6,182,212,0.45)" : "0 4px 12px rgba(0,0,0,0.25)",
              transition: "background 200ms ease, box-shadow 200ms ease",
            }}
            aria-label={isListening ? "Stop listening" : "Hold to talk"}
          >
            {isListening ? <MicOff size={18} className="text-white" /> : <Mic size={18} className="text-white" />}
          </button>
        )}
      </div>
    </div>
  );
}
