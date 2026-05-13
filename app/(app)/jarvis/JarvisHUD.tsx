"use client";

import { useEffect, useRef, useState } from "react";
import { X, Mic, Send } from "lucide-react";
import { useHealth } from "@/hooks/useHealth";
import { useGoals } from "@/hooks/useGoals";
import { useProtein } from "@/hooks/useProtein";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";
import { listen, cancelSpeech, StreamingSpeaker, primeVoices, speechRecognitionAvailable } from "@/lib/jarvis/voice";
import {
  isTauri,
  takeScreenshot,
  mouseClick,
  keyboardType,
  keyboardKey,
  runShell,
  readFile,
  writeFile,
  listDir,
} from "@/lib/tauri/bridge";
import Orb, { OrbState } from "./Orb";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tools?: Array<{ name: string; message: string; ok: boolean }>;
};

const HUE = 195;  // cyan
const TXT_BRIGHT = `hsl(${HUE}, 90%, 78%)`;
const TXT_DIM    = `hsl(${HUE}, 60%, 55%)`;
const TXT_FAINT  = `hsl(${HUE}, 40%, 40%)`;
const BORDER     = `hsla(${HUE}, 80%, 50%, 0.30)`;
const BORDER_FAINT = `hsla(${HUE}, 80%, 50%, 0.12)`;
const PANEL_BG   = "rgba(10, 18, 28, 0.85)";

// Fake but plausible telemetry
function generateSession(): string {
  const hex = (n: number) => Math.floor(Math.random() * 16).toString(16).toUpperCase().padStart(1, "0");
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, hex).join("")).join("-");
}

export default function JarvisHUD({ onClose }: { onClose: () => void }) {
  const { health } = useHealth();
  const { streak, goals } = useGoals();
  const { totalToday: proteinToday, target: proteinTarget } = useProtein();
  const { toast } = useToast();

  const [orbState, setOrbState]   = useState<OrbState>("idle");
  const [transcript, setTranscript] = useState("");
  const [textInput, setTextInput] = useState("");
  const [chat, setChat]           = useState<ChatTurn[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [hasMic, setHasMic]       = useState(false);
  const [audioLevels, setAudioLevels] = useState<number[]>(Array(7).fill(0));
  const [tick, setTick]           = useState(0);
  const [sessionId]               = useState(generateSession);

  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const speakerRef     = useRef<StreamingSpeaker | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const audioRafRef    = useRef<number | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);

  // Prime voices + ticker
  useEffect(() => {
    primeVoices();
    setHasMic(speechRecognitionAvailable());
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(id);
      cancelSpeech();
      recognitionRef.current?.stop();
      stopAudioMeter();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startAudioMeter() {
    if (typeof window === "undefined") return;
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      streamRef.current = stream;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      const src = ctx.createMediaStreamSource(stream);
      src.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tickAudio = () => {
        analyser.getByteFrequencyData(data);
        // Downsample to 7 bars
        const bars = Array.from({ length: 7 }, (_, i) => {
          const start = Math.floor((i * data.length) / 7);
          const end   = Math.floor(((i + 1) * data.length) / 7);
          let sum = 0;
          for (let j = start; j < end; j++) sum += data[j];
          return Math.min(1, sum / ((end - start) * 180));
        });
        setAudioLevels(bars);
        audioRafRef.current = requestAnimationFrame(tickAudio);
      };
      tickAudio();
    }).catch(() => { /* mic denied */ });
  }

  function stopAudioMeter() {
    if (audioRafRef.current != null) cancelAnimationFrame(audioRafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    setAudioLevels(Array(7).fill(0));
  }

  function startListening() {
    if (!hasMic || isListening) return;
    cancelSpeech();
    setTranscript("");
    setOrbState("listening");
    setIsListening(true);
    haptic("light");
    startAudioMeter();

    let lastTranscript = "";
    const handle = listen({
      onResult: (r) => {
        lastTranscript = r.transcript;
        setTranscript(r.transcript);
        if (r.isFinal) {
          finishListening(r.transcript);
        }
      },
      onError: (msg) => {
        stopAudioMeter();
        setIsListening(false);
        setOrbState("idle");
        if (msg !== "no-speech") toast(`Mic error: ${msg}`, "error");
      },
      onEnd: () => {
        // If recognition ends naturally and we have a transcript, send it
        if (isListeningRef.current && lastTranscript) {
          finishListening(lastTranscript);
        } else {
          stopAudioMeter();
          setIsListening(false);
          if (orbStateRef.current === "listening") setOrbState("idle");
        }
      },
    });
    recognitionRef.current = handle ?? null;
  }

  // Refs to read current state inside listener callbacks
  const isListeningRef = useRef(false);
  const orbStateRef    = useRef<OrbState>("idle");
  useEffect(() => { isListeningRef.current = isListening; }, [isListening]);
  useEffect(() => { orbStateRef.current = orbState; }, [orbState]);

  function finishListening(text: string) {
    stopAudioMeter();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    const final = text.trim();
    if (final) sendMessage(final);
    else setOrbState("idle");
  }

  function toggleMic() {
    if (isListening) {
      // User tapped to stop — send whatever's in the transcript
      finishListening(transcript);
    } else {
      startListening();
    }
  }

  // Execute a single native tool via the Tauri bridge and produce a tool_result
  // payload Anthropic understands. Screenshots come back as image blocks so Claude actually sees the screen.
  async function executeNativeTool(
    name: string,
    input: Record<string, unknown>
  ): Promise<{ content: string | Array<{ type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } }>; is_error: boolean }> {
    try {
      switch (name) {
        case "take_screenshot": {
          const b64 = await takeScreenshot();
          if (!b64) return { content: "Failed to capture screen (permission denied?)", is_error: true };
          return {
            content: [
              { type: "text", text: "Screenshot of primary display:" },
              { type: "image", source: { type: "base64", media_type: "image/png", data: b64 } },
            ],
            is_error: false,
          };
        }
        case "mouse_click": {
          const r = await mouseClick(input.x as number, input.y as number, (input.button as "left" | "right" | "middle" | undefined) ?? "left");
          return { content: r === null ? "Click failed (permission denied?)" : `Clicked (${input.x},${input.y})`, is_error: r === null };
        }
        case "keyboard_type": {
          const r = await keyboardType(input.text as string);
          return { content: r === null ? "Type failed" : `Typed ${(input.text as string).length} chars`, is_error: r === null };
        }
        case "keyboard_key": {
          const r = await keyboardKey(input.combo as string);
          return { content: r === null ? "Key press failed" : `Pressed ${input.combo}`, is_error: r === null };
        }
        case "run_shell": {
          const r = await runShell(input.program as string, (input.args as string[]) ?? []);
          if (!r) return { content: "Shell exec failed", is_error: true };
          return {
            content: `exit ${r.code}\nstdout:\n${r.stdout || "(empty)"}\nstderr:\n${r.stderr || "(empty)"}`,
            is_error: r.code !== 0,
          };
        }
        case "read_file": {
          const r = await readFile(input.path as string);
          return r === null
            ? { content: `Failed to read ${input.path}`, is_error: true }
            : { content: r, is_error: false };
        }
        case "write_file": {
          const ok = await writeFile(input.path as string, input.content as string);
          return { content: ok ? `Wrote ${input.path}` : `Failed to write ${input.path}`, is_error: !ok };
        }
        case "list_directory": {
          const r = await listDir(input.path as string);
          return r === null
            ? { content: `Failed to list ${input.path}`, is_error: true }
            : { content: r.length === 0 ? "(empty directory)" : r.join("\n"), is_error: false };
        }
        default:
          return { content: `Unknown native tool: ${name}`, is_error: true };
      }
    } catch (err) {
      return { content: `Tool error: ${(err as Error).message}`, is_error: true };
    }
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

    const history = chat.slice(-8).map((t) => ({ role: t.role, content: t.text || " " }));
    speakerRef.current = new StreamingSpeaker();
    const tauriMode = isTauri();

    type NativeCall = { id: string; name: string; input: Record<string, unknown> };
    type ServerResult = { tool_use_id: string; content: string; is_error: boolean };

    // Body for the first turn — subsequent turns substitute `resumeFrom`.
    let body: Record<string, unknown> = { content: text, history, tauriMode };
    let firstChunkOverall = true;

    try {
      // Loop while Claude keeps yielding for native tools.
      for (let loop = 0; loop < 6; loop++) {
        const res = await fetch("/api/jarvis/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.body) throw new Error("No stream");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = (loop === 0) ? "" : (chat.find((t) => t.id === assistantId)?.text ?? "");

        let pendingMessages: unknown[] | null = null;
        let pendingNativeCalls: NativeCall[] = [];
        let priorServerResults: ServerResult[] = [];

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
                if (firstChunkOverall) { setOrbState("speaking"); firstChunkOverall = false; }
                accumulated += parsed.text;
                speakerRef.current?.feed(parsed.text);
                setChat((prev) => prev.map((t) => t.id === assistantId ? { ...t, text: accumulated } : t));
              }
              if (parsed.tool) {
                setChat((prev) => prev.map((t) => t.id === assistantId ? { ...t, tools: [...(t.tools ?? []), parsed.tool] } : t));
              }
              if (parsed.openUrl && typeof window !== "undefined") {
                window.open(parsed.openUrl, "_blank", "noopener,noreferrer");
              }
              if (parsed.pendingNative) {
                pendingMessages = parsed.pendingNative.messages;
                pendingNativeCalls = parsed.pendingNative.nativeCalls;
              }
              if (parsed.priorServerResults) {
                priorServerResults = parsed.priorServerResults;
              }
              if (parsed.error) {
                toast(`Jarvis error: ${parsed.error}`, "error");
              }
            } catch {}
          }
        }

        // If no native tools pending, we're done.
        if (!pendingMessages || pendingNativeCalls.length === 0) break;

        // Execute every native tool the client owes Claude.
        setOrbState("thinking");
        const nativeResults: Array<{ tool_use_id: string; content: unknown; is_error: boolean }> = [];
        for (const call of pendingNativeCalls) {
          const result = await executeNativeTool(call.name, call.input);
          nativeResults.push({ tool_use_id: call.id, content: result.content, is_error: result.is_error });
          setChat((prev) => prev.map((t) => t.id === assistantId
            ? { ...t, tools: [...(t.tools ?? []), { name: call.name, message: result.is_error ? `Failed` : `Done`, ok: !result.is_error }] }
            : t));
        }

        // Build resume payload: server results FIRST (preserve tool_use order), then native results.
        const allResults = [
          ...priorServerResults.map((r) => ({ tool_use_id: r.tool_use_id, content: r.content, is_error: r.is_error })),
          ...nativeResults,
        ];

        body = {
          history,
          tauriMode,
          resumeFrom: { messages: pendingMessages, toolResults: allResults },
        };
      }
    } catch (e) {
      console.error(e);
      toast("Connection error", "error");
    } finally {
      speakerRef.current?.finish(() => setOrbState("idle"));
      if (firstChunkOverall) setOrbState("idle");
    }
  }

  function handleTextSubmit() {
    if (!textInput.trim()) return;
    sendMessage(textInput);
  }

  // ── Telemetry data ────────────────────────────────────────
  const now = new Date();
  const timestamp = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr   = now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  const ms = String(now.getMilliseconds()).padStart(3, "0").slice(0, 2);

  // Fake but plausible system vitals (oscillate slightly to feel alive)
  const wave = (period: number, amp: number, base: number) =>
    base + Math.sin(tick / period) * amp;

  const vitals = [
    { label: "RECOVERY",   value: health.readiness_score != null ? `${health.readiness_score}%`        : "—" },
    { label: "HRV",        value: health.hrv != null            ? `${health.hrv}ms`                    : "—" },
    { label: "RHR",        value: health.rhr != null            ? `${health.rhr}bpm`                   : "—" },
    { label: "SLEEP",      value: health.sleep_score != null    ? `${health.sleep_score}%`             : "—" },
    { label: "GOALS",      value: `${goals.filter((g) => g.is_complete).length}/${goals.length}`       },
    { label: "PROTEIN",    value: `${Math.round(proteinToday)}/${proteinTarget}g`                      },
    { label: "STREAK",     value: `${streak}D`                                                          },
    { label: "NEURAL CORE",value: `${wave(3, 1.2, 96.4).toFixed(1)}%`                                  },
    { label: "LATENCY",    value: `${wave(2, 4, 22).toFixed(1)}ms`                                     },
    { label: "THROUGHPUT", value: `${wave(5, 0.08, 1.092).toFixed(3)} G/s`                             },
  ];

  // Scrolling telemetry log
  const telemetry: string[] = [
    `${timestamp} > recovery probe ok :: readiness=${health.readiness_score ?? "—"}`,
    `${timestamp} > goals subroutine :: ${goals.filter((g) => g.is_complete).length}/${goals.length}`,
    `${timestamp} > protein sync :: ${Math.round(proteinToday)}g/${proteinTarget}g`,
    `${timestamp} > hrv stream stable :: ${health.hrv ?? "—"}ms`,
    `${timestamp} > sleep telemetry :: ${health.sleep_hours ?? "—"}h`,
    `${timestamp} > kernel handshake established`,
    `${timestamp} > oura packet integrity ok`,
    `${timestamp} > facts buffer flushed`,
    `${timestamp} > worker queue idle`,
    `${timestamp} > anomaly scanner armed`,
  ];

  const diagnostics: string[] = [
    `${timestamp} > overseer.context :: built ok`,
    `${timestamp} > supabase.realtime :: connected`,
    `${timestamp} > anthropic.sonnet :: handshake`,
    `${timestamp} > tools.registry :: ${17} loaded`,
    `${timestamp} > memory.lookup :: ready`,
    `${timestamp} > workers.dispatcher :: idle`,
    `${timestamp} > artifacts.store :: open`,
    `${timestamp} > telemetry.heart :: pulsing`,
  ];

  // Radar sweep angle
  const radarAngle = (tick * 6) % 360;

  const lastAssistant = chat.slice().reverse().find((t) => t.role === "assistant" && t.text);

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col font-mono"
      style={{
        background: `radial-gradient(ellipse at center, hsl(${HUE}, 100%, 4%) 0%, #02050a 70%, #000 100%)`,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
        color: TXT_DIM,
        fontFamily: "'SF Mono', 'JetBrains Mono', 'Consolas', monospace",
      }}
    >
      {/* Background grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${BORDER_FAINT} 1px, transparent 1px), linear-gradient(90deg, ${BORDER_FAINT} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
          opacity: 0.5,
          marginTop: "env(safe-area-inset-top)",
        }}
      />

      {/* Close */}
      <button
        onClick={() => { cancelSpeech(); recognitionRef.current?.stop(); stopAudioMeter(); onClose(); }}
        className="absolute top-3 right-3 z-20 w-8 h-8 rounded-sm flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.4)", border: `1px solid ${BORDER}`, color: TXT_DIM, marginTop: "env(safe-area-inset-top)" }}
        aria-label="Close"
      >
        <X size={14} />
      </button>

      {/* ── TOP BAR: Title + status pills + timestamp ───────── */}
      <div className="relative z-10 px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${BORDER_FAINT}` }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: TXT_BRIGHT, boxShadow: `0 0 8px ${TXT_BRIGHT}` }} />
              <span className="text-[11px] font-bold tracking-[0.18em]" style={{ color: TXT_BRIGHT }}>
                J.A.R.V.I.S.
              </span>
              <span className="text-[9px] tracking-widest" style={{ color: TXT_FAINT }}>
                — JUST A RATHER VERY INTELLIGENT SYSTEM
              </span>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              {["ONLINE", "SECURE", "ENCRYPTED", "AUTO-LVL9"].map((s) => (
                <span
                  key={s}
                  className="text-[8px] font-semibold tracking-widest px-1.5 py-0.5"
                  style={{ border: `1px solid ${BORDER}`, color: TXT_DIM, background: "rgba(0,0,0,0.3)" }}
                >
                  ▸ {s}
                </span>
              ))}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[14px] tabular-nums tracking-tight" style={{ color: TXT_BRIGHT }}>
              {timestamp}<span style={{ color: TXT_FAINT }}>.{ms}</span>
            </div>
            <div className="text-[9px] tracking-widest mt-0.5" style={{ color: TXT_FAINT }}>{dateStr}</div>
            <div className="text-[8px] tracking-wider mt-1" style={{ color: TXT_FAINT }}>SESSION · {sessionId}</div>
          </div>
        </div>
      </div>

      {/* ── BODY: 3 columns ─────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-12 gap-2 px-3 py-3 min-h-0 relative z-10">

        {/* LEFT: System Vitals + Telemetry */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
          <Panel title="SYSTEM VITALS">
            <div className="space-y-1">
              {vitals.map((v) => (
                <div key={v.label} className="flex justify-between items-baseline text-[10px]">
                  <span style={{ color: TXT_FAINT }}>{v.label}</span>
                  <span className="tabular-nums" style={{ color: TXT_BRIGHT }}>{v.value}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="TELEMETRY" flex>
            <div className="text-[9px] leading-snug space-y-0.5 overflow-hidden">
              {telemetry.map((line, i) => (
                <div key={i} style={{ color: i === 0 ? TXT_BRIGHT : TXT_FAINT, opacity: 1 - i * 0.07 }}>{line}</div>
              ))}
            </div>
          </Panel>
        </div>

        {/* CENTER: Orb + caption */}
        <div className="col-span-6 flex flex-col items-center justify-center min-h-0">
          <Orb state={orbState} size={Math.min(340, 320)} />

          {/* Caption strip */}
          <div className="mt-4 min-h-[60px] max-w-md w-full text-center px-4">
            {transcript && (
              <p className="text-[12px] italic" style={{ color: TXT_BRIGHT }}>
                <span style={{ color: TXT_FAINT }}>▸ </span>{transcript}
              </p>
            )}
            {!transcript && lastAssistant?.text && (
              <p className="text-[13px] leading-relaxed" style={{ color: TXT_BRIGHT }}>{lastAssistant.text}</p>
            )}
            {!transcript && !lastAssistant?.text && orbState === "idle" && (
              <p className="text-[11px] tracking-wider" style={{ color: TXT_FAINT }}>
                {hasMic ? "▸ TAP MIC OR TYPE TO BEGIN" : "▸ TYPE TO BEGIN"}
              </p>
            )}
          </div>

          {/* Tool chips */}
          {lastAssistant?.tools && lastAssistant.tools.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5 justify-center max-w-md px-2">
              {lastAssistant.tools.map((t, i) => (
                <span
                  key={i}
                  className="text-[9px] font-semibold tracking-widest px-2 py-1"
                  style={{
                    border: `1px solid ${t.ok ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.4)"}`,
                    color: t.ok ? "hsl(160, 90%, 65%)" : "hsl(0, 85%, 70%)",
                    background: "rgba(0,0,0,0.4)",
                  }}
                >
                  {t.ok ? "✓" : "⚠"} {t.message.toUpperCase()}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: Proximity radar + Audio I/O + Diagnostics */}
        <div className="col-span-3 flex flex-col gap-2 min-h-0">
          <Panel title="PROXIMITY">
            <svg viewBox="0 0 100 100" className="w-full h-auto" style={{ maxHeight: 90 }}>
              <circle cx="50" cy="50" r="45" fill="none" stroke={BORDER} strokeWidth="0.5" />
              <circle cx="50" cy="50" r="30" fill="none" stroke={BORDER_FAINT} strokeWidth="0.5" />
              <circle cx="50" cy="50" r="15" fill="none" stroke={BORDER_FAINT} strokeWidth="0.5" />
              <line x1="5"  y1="50" x2="95" y2="50" stroke={BORDER_FAINT} strokeWidth="0.4" />
              <line x1="50" y1="5"  x2="50" y2="95" stroke={BORDER_FAINT} strokeWidth="0.4" />
              {/* sweeping arm */}
              <line
                x1="50" y1="50"
                x2={50 + Math.cos((radarAngle - 90) * Math.PI / 180) * 45}
                y2={50 + Math.sin((radarAngle - 90) * Math.PI / 180) * 45}
                stroke={TXT_BRIGHT} strokeWidth="0.6" opacity="0.8"
              />
              {/* blips */}
              <circle cx="62" cy="38" r="1.5" fill={TXT_BRIGHT} opacity="0.85" />
              <circle cx="32" cy="55" r="1.2" fill={TXT_BRIGHT} opacity="0.6" />
              <circle cx="58" cy="68" r="1" fill={TXT_BRIGHT} opacity="0.4" />
            </svg>
          </Panel>

          <Panel title="AUDIO I/O">
            <div className="flex items-end gap-1 h-10">
              {audioLevels.map((lvl, i) => (
                <div key={i} className="flex-1 flex flex-col justify-end">
                  <div
                    style={{
                      height: `${Math.max(2, lvl * 100)}%`,
                      background: `linear-gradient(180deg, ${TXT_BRIGHT}, hsla(${HUE}, 80%, 40%, 0.6))`,
                      transition: "height 80ms ease-out",
                      boxShadow: `0 0 6px hsla(${HUE}, 90%, 60%, 0.5)`,
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="text-[8px] mt-1 tracking-widest" style={{ color: TXT_FAINT }}>
              {isListening ? "▸ LIVE — TAP TO STOP" : "▸ STANDBY"}
            </div>
          </Panel>

          <Panel title="DIAGNOSTICS" flex>
            <div className="text-[9px] leading-snug space-y-0.5 overflow-hidden">
              {diagnostics.map((line, i) => (
                <div key={i} style={{ color: i === 0 ? TXT_BRIGHT : TXT_FAINT, opacity: 1 - i * 0.08 }}>{line}</div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* ── BOTTOM: input bar ───────────────────────────────── */}
      <div className="relative z-10 px-3 pt-2 pb-1" style={{ borderTop: `1px solid ${BORDER_FAINT}` }}>
        <div className="flex items-center gap-2">
          <span className="text-[10px] tracking-widest" style={{ color: TXT_FAINT }}>▸</span>
          <input
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
            placeholder="ENTER COMMAND…"
            className="flex-1 bg-transparent text-[12px] tracking-wider outline-none placeholder:tracking-widest"
            style={{ color: TXT_BRIGHT, caretColor: TXT_BRIGHT }}
          />
          <button
            onClick={handleTextSubmit}
            disabled={!textInput.trim()}
            className="w-9 h-9 flex items-center justify-center disabled:opacity-30"
            style={{ border: `1px solid ${BORDER}`, color: TXT_BRIGHT }}
            aria-label="Send"
          >
            <Send size={13} />
          </button>
          {hasMic && (
            <button
              onClick={toggleMic}
              className="w-11 h-11 flex items-center justify-center"
              style={{
                border: `1px solid ${isListening ? `hsla(${HUE}, 95%, 70%, 0.9)` : BORDER}`,
                background: isListening
                  ? `radial-gradient(circle at center, hsla(${HUE}, 90%, 55%, 0.45), hsla(${HUE}, 80%, 30%, 0.15))`
                  : "rgba(0,0,0,0.4)",
                color: isListening ? "#fff" : TXT_BRIGHT,
                boxShadow: isListening ? `0 0 24px hsla(${HUE}, 95%, 65%, 0.7)` : "none",
                transition: "all 200ms ease",
              }}
              aria-label={isListening ? "Stop listening" : "Tap to talk"}
            >
              <Mic size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Reusable HUD panel
function Panel({ title, children, flex = false }: { title: string; children: React.ReactNode; flex?: boolean }) {
  return (
    <div
      className={flex ? "flex-1 min-h-0" : ""}
      style={{
        background: PANEL_BG,
        border: `1px solid ${BORDER}`,
        padding: "8px 10px",
        position: "relative",
      }}
    >
      {/* Corner ticks */}
      <span style={{ position: "absolute", top: -1, left: -1, width: 8, height: 8, borderTop: `1.5px solid ${TXT_BRIGHT}`, borderLeft: `1.5px solid ${TXT_BRIGHT}` }} />
      <span style={{ position: "absolute", top: -1, right: -1, width: 8, height: 8, borderTop: `1.5px solid ${TXT_BRIGHT}`, borderRight: `1.5px solid ${TXT_BRIGHT}` }} />
      <span style={{ position: "absolute", bottom: -1, left: -1, width: 8, height: 8, borderBottom: `1.5px solid ${TXT_BRIGHT}`, borderLeft: `1.5px solid ${TXT_BRIGHT}` }} />
      <span style={{ position: "absolute", bottom: -1, right: -1, width: 8, height: 8, borderBottom: `1.5px solid ${TXT_BRIGHT}`, borderRight: `1.5px solid ${TXT_BRIGHT}` }} />

      <div className="text-[9px] font-bold tracking-[0.22em] mb-2" style={{ color: TXT_BRIGHT, borderBottom: `1px solid ${BORDER_FAINT}`, paddingBottom: 4 }}>
        ▸ {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
