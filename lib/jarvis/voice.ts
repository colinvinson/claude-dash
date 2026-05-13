// Voice plumbing for Jarvis.
//   TTS: ElevenLabs (cinematic British "Daniel") via /api/jarvis/tts. Browser speechSynthesis is the fallback.
//   STT: webkitSpeechRecognition.

// ============================================================
// TTS — ElevenLabs proxy with sequential queue + cancellation
// ============================================================

type SpeakItem = {
  audio: HTMLAudioElement;
  onEnd?: () => void;
  revoke: () => void;
};

let currentAudio: HTMLAudioElement | null = null;
const playQueue: SpeakItem[] = [];
const activeAborts = new Set<AbortController>();

function playNext() {
  const next = playQueue.shift();
  if (!next) { currentAudio = null; return; }
  currentAudio = next.audio;
  const finish = () => {
    try { next.revoke(); } catch {}
    next.onEnd?.();
    playNext();
  };
  next.audio.addEventListener("ended", finish, { once: true });
  next.audio.addEventListener("error", finish, { once: true });
  next.audio.play().catch(() => finish());
}

export async function speak(text: string, opts?: { onEnd?: () => void }): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) { opts?.onEnd?.(); return; }

  const ctrl = new AbortController();
  activeAborts.add(ctrl);
  try {
    const res = await fetch("/api/jarvis/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    playQueue.push({ audio, onEnd: opts?.onEnd, revoke: () => URL.revokeObjectURL(url) });
    if (!currentAudio) playNext();
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") return;
    // Fallback to browser speechSynthesis so the assistant still talks if ElevenLabs is down.
    fallbackSpeak(trimmed, opts);
  } finally {
    activeAborts.delete(ctrl);
  }
}

function fallbackSpeak(text: string, opts?: { onEnd?: () => void }) {
  if (typeof window === "undefined" || !window.speechSynthesis) { opts?.onEnd?.(); return; }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  utter.pitch = 0.95;
  if (opts?.onEnd) utter.addEventListener("end", opts.onEnd);
  window.speechSynthesis.speak(utter);
}

export function cancelSpeech(): void {
  activeAborts.forEach((a) => a.abort());
  activeAborts.clear();
  if (currentAudio) {
    try { currentAudio.pause(); currentAudio.currentTime = 0; } catch {}
  }
  currentAudio = null;
  playQueue.length = 0;
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

// Retained as a no-op for compatibility with callers that primed browser voices.
export function primeVoices(): Promise<void> {
  return Promise.resolve();
}

// Streams text chunks → speaks complete sentences as they arrive.
export class StreamingSpeaker {
  private buffer = "";
  private spoken = "";

  feed(chunk: string) {
    this.buffer += chunk;
    this.flushCompleteSentences();
  }

  private flushCompleteSentences() {
    const match = this.buffer.match(/^([\s\S]*?[.!?…])(\s|$)/);
    if (match) {
      const sentence = match[1].trim();
      if (sentence) speak(sentence);
      this.buffer = this.buffer.slice(match[0].length);
      this.spoken += sentence + " ";
      // Recurse to flush additional sentences in one feed.
      if (this.buffer.match(/[.!?…]/)) this.flushCompleteSentences();
    }
  }

  finish(onComplete?: () => void) {
    if (this.buffer.trim()) {
      speak(this.buffer.trim(), { onEnd: onComplete });
      this.spoken += this.buffer;
      this.buffer = "";
    } else if (onComplete) {
      onComplete();
    }
  }

  reset() {
    this.buffer = "";
    this.spoken = "";
    cancelSpeech();
  }
}

// ============================================================
// STT — webkitSpeechRecognition
// ============================================================

type RecognitionResult = { transcript: string; isFinal: boolean };

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string }; isFinal: boolean }; length: number; }; resultIndex: number; }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export function speechRecognitionAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  );
}

export function createRecognition(): ISpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    (window as unknown as { SpeechRecognition?: new () => ISpeechRecognition }).SpeechRecognition ||
    (window as unknown as { webkitSpeechRecognition?: new () => ISpeechRecognition }).webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "en-US";
  return rec;
}

export type ListenHandle = {
  stop: () => void;
};

export function listen(callbacks: {
  onResult: (r: RecognitionResult) => void;
  onError?: (msg: string) => void;
  onEnd?: () => void;
}): ListenHandle | null {
  const rec = createRecognition();
  if (!rec) return null;

  rec.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0].transcript;
      if (result.isFinal) finalText += text;
      else interim += text;
    }
    if (finalText) callbacks.onResult({ transcript: finalText, isFinal: true });
    else if (interim) callbacks.onResult({ transcript: interim, isFinal: false });
  };
  rec.onerror = (e) => { callbacks.onError?.(e.error); };
  rec.onend = () => { callbacks.onEnd?.(); };

  try { rec.start(); } catch { /* ignore double-start */ }

  return { stop: () => { try { rec.stop(); } catch {} } };
}
