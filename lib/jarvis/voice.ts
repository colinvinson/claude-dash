// Voice plumbing for Jarvis — STT (SpeechRecognition) + TTS (speechSynthesis).
// Pure browser APIs. Falls back gracefully where not supported.

// ============================================================
// TTS — pick the best-available "Jarvis-ish" voice
// ============================================================

// Preference order: cinematic UK male voices first
const VOICE_PREFERENCES = ["Daniel", "Oliver", "Arthur", "Alex", "Samantha"];

let cachedVoice: SpeechSynthesisVoice | null = null;

function pickVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  for (const name of VOICE_PREFERENCES) {
    const match = voices.find((v) => v.name === name);
    if (match) { cachedVoice = match; return match; }
  }
  const enMale = voices.find((v) => v.lang?.startsWith("en") && /male/i.test(v.name));
  if (enMale) { cachedVoice = enMale; return enMale; }
  const en = voices.find((v) => v.lang?.startsWith("en"));
  cachedVoice = en ?? voices[0];
  return cachedVoice;
}

// Wait for voices to populate (some browsers fire `voiceschanged` after load).
export function primeVoices(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { resolve(); return; }
    if (window.speechSynthesis.getVoices().length > 0) { resolve(); return; }
    const handler = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
      resolve();
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Fallback timeout
    setTimeout(resolve, 1000);
  });
}

export function speak(text: string, opts?: { rate?: number; pitch?: number; onEnd?: () => void }): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  utter.rate  = opts?.rate  ?? 0.95;
  utter.pitch = opts?.pitch ?? 0.95;
  if (opts?.onEnd) utter.addEventListener("end", opts.onEnd);
  window.speechSynthesis.speak(utter);
}

export function cancelSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

// Streams text chunks → speaks complete sentences as they arrive.
// Prevents awkward mid-word pauses while still feeling reactive.
export class StreamingSpeaker {
  private buffer = "";
  private spoken = "";
  private endCallback?: () => void;

  feed(chunk: string) {
    this.buffer += chunk;
    this.flushCompleteSentences();
  }

  private flushCompleteSentences() {
    // Match through end-of-sentence punctuation OR a comma if the chunk is getting long
    const match = this.buffer.match(/^([\s\S]*?[.!?…])(\s|$)/);
    if (match) {
      const sentence = match[1].trim();
      if (sentence) speak(sentence, { onEnd: this.endCallback });
      this.buffer = this.buffer.slice(match[0].length);
      this.spoken += sentence + " ";
    }
  }

  finish(onComplete?: () => void) {
    // Speak any remainder
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
  rec.continuous = false;       // we want single-utterance mode for hold-to-talk
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
