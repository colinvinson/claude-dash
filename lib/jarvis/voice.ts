// Voice plumbing for Jarvis.
//   TTS: ElevenLabs (cinematic British "Daniel") via /api/jarvis/tts. Browser speechSynthesis is the fallback.
//   STT: webkitSpeechRecognition.

// ============================================================
// TTS text normalization — display vs. spoken decouples here
// ============================================================
//
// The dashboard text Jarvis emits is terse + abbreviated by design ("HRV down
// 18ms", "RIR 2", "5.2σ"). ElevenLabs pronounces those raw bytes inconsistently
// — letter-spelling acronyms wrong, reading "ms" as "ems", choking on "·".
// This function rewrites the SAME prose for natural narration without changing
// what the user reads on screen.
const ACRONYMS_SPELL = [
  "HRV", "RHR", "RPE", "RIR", "AMRAP", "MEV", "MRV", "MAV",
  "TRT", "HRT", "DEXA", "BMI", "GLP", "SSRI", "CNS", "PR", "PRs",
  "1RM",
];

const UNIT_REPLACEMENTS: Array<[RegExp, string]> = [
  // Order matters: longer units first so "ms" doesn't claim "msec" matches.
  [/(\d+(?:\.\d+)?)\s*(?:milliseconds?|msec)\b/gi, "$1 milliseconds"],
  [/(\d+(?:\.\d+)?)\s*ms\b/g,                        "$1 milliseconds"],
  [/(\d+(?:\.\d+)?)\s*kg\b/g,                        "$1 kilograms"],
  [/(\d+(?:\.\d+)?)\s*mg\b/g,                        "$1 milligrams"],
  [/(\d+(?:\.\d+)?)\s*ml\b/g,                        "$1 milliliters"],
  [/(\d+(?:\.\d+)?)\s*bpm\b/g,                       "$1 beats per minute"],
  [/(\d+(?:\.\d+)?)\s*lbs?\b/g,                      "$1 pounds"],
  [/(\d+(?:\.\d+)?)\s*oz\b/g,                        "$1 ounces"],
  [/(\d+(?:\.\d+)?)\s*hrs?\b/g,                      "$1 hours"],
  [/(\d+(?:\.\d+)?)\s*mins?\b/g,                     "$1 minutes"],
  [/(\d+(?:\.\d+)?)\s*sec\b/g,                       "$1 seconds"],
  // "kg/wk" → "kilograms per week"
  [/(\d+(?:\.\d+)?)\s*kg\/wk\b/g,                    "$1 kilograms per week"],
];

const SPECIAL_TOKENS: Array<[RegExp, string]> = [
  // Compound terms that ElevenLabs mangles
  [/\b1RM\b/g,           "one rep max"],
  [/\bVO2 ?max\b/gi,     "V O two max"],
  [/\bVO2\b/gi,          "V O two"],
  [/\bvs\.?\b/gi,        "versus"],
  [/\bi\.e\./gi,         "that is"],
  [/\be\.g\./gi,         "for example"],
  [/\betc\./gi,          "et cetera"],
];

// Symbols → words / pauses. The middle-dot and em-dash get commas so
// ElevenLabs renders a brief pause instead of running clauses together.
const SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/%/g,            " percent"],
  [/°/g,            " degrees"],
  [/σ/g,            " sigma"],
  [/[·•]/g,         ", "],
  [/[—–]/g,         ", "],
  [/…/g,            "."],
  [/[“”]/g,         '"'],
  [/[‘’]/g,         "'"],
];

export function normalizeForSpeech(text: string): string {
  let t = text;

  // Strip markdown that bled through
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/\*([^*]+)\*/g,    "$1");
  t = t.replace(/`([^`]+)`/g,       "$1");
  t = t.replace(/^[-*•]\s+/gm,      "");

  // Symbols first (commas need to land before sentence flush sees them)
  for (const [re, sub] of SYMBOL_REPLACEMENTS) t = t.replace(re, sub);

  // Units (digit + unit → "digit word")
  for (const [re, sub] of UNIT_REPLACEMENTS) t = t.replace(re, sub);

  // Special compound terms
  for (const [re, sub] of SPECIAL_TOKENS) t = t.replace(re, sub);

  // Acronyms: letter-space them so ElevenLabs says each letter individually
  // (otherwise it tries to pronounce "HRV" as a word). Word-boundary anchored
  // so we don't break "Harv" or other real words.
  for (const a of ACRONYMS_SPELL) {
    const re = new RegExp(`\\b${a}\\b`, "g");
    t = t.replace(re, a.split("").join(" "));
  }

  // Collapse whitespace after substitutions
  t = t.replace(/\s+/g, " ").trim();
  // Collapse comma runs e.g. ", , " from a "—·—" sequence
  t = t.replace(/(?:,\s*){2,}/g, ", ");

  return t;
}

// ============================================================
// TTS — ElevenLabs proxy with sequential queue + cancellation
// ============================================================

// Order matters: every speak() reserves a slot in the queue at call time, then
// fills it when the ElevenLabs MP3 arrives. The player only advances when the
// HEAD of the queue is ready — so sentences play in call order regardless of
// which TTS request returns first.
type Slot = {
  ready: boolean;
  audio?: HTMLAudioElement;
  fallbackText?: string;
  onEnd?: () => void;
  revoke?: () => void;
};

let currentAudio: HTMLAudioElement | null = null;
const playQueue: Slot[] = [];
const activeAborts = new Set<AbortController>();

function tryPlayNext() {
  if (currentAudio) return;
  while (playQueue.length > 0) {
    const head = playQueue[0];
    if (!head.ready) return;
    playQueue.shift();
    if (head.audio) {
      currentAudio = head.audio;
      const finish = () => {
        try { head.revoke?.(); } catch {}
        head.onEnd?.();
        currentAudio = null;
        tryPlayNext();
      };
      head.audio.addEventListener("ended", finish, { once: true });
      head.audio.addEventListener("error", finish, { once: true });
      head.audio.play().catch(() => finish());
      return;
    }
    if (head.fallbackText) {
      fallbackSpeak(head.fallbackText, () => { head.onEnd?.(); tryPlayNext(); });
      return;
    }
    head.onEnd?.();
  }
}

export async function speak(text: string, opts?: { onEnd?: () => void }): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) { opts?.onEnd?.(); return; }

  // Display stays as-is; only the spoken version gets normalized so
  // ElevenLabs says "eighteen milliseconds" instead of "eighteen ems".
  const spoken = normalizeForSpeech(trimmed);
  if (!spoken) { opts?.onEnd?.(); return; }

  const slot: Slot = { ready: false, onEnd: opts?.onEnd };
  playQueue.push(slot);

  const ctrl = new AbortController();
  activeAborts.add(ctrl);
  try {
    const res = await fetch("/api/jarvis/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: spoken }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`tts ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    slot.audio = new Audio(url);
    slot.revoke = () => URL.revokeObjectURL(url);
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      slot.ready = true;
      return;
    }
    slot.fallbackText = spoken;
  } finally {
    slot.ready = true;
    activeAborts.delete(ctrl);
    tryPlayNext();
  }
}

function fallbackSpeak(text: string, onEnd?: () => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) { onEnd?.(); return; }
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.95;
  utter.pitch = 0.95;
  if (onEnd) utter.addEventListener("end", onEnd);
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

// True end of a sentence in `text` (index past the last punctuation), or -1.
// Skips decimals ("5.2" — period followed by digit), abbreviations (single
// capital letter ending in period, common short abbrevs like vs / etc).
// Without this, "Recovery 42.5 today." would split mid-decimal and stutter.
const ABBREVS = new Set(["vs", "eg", "ie", "dr", "mr", "mrs", "ms", "st", "etc"]);
function findFirstSentenceEnd(text: string): number {
  // Punctuation that's followed by whitespace OR end-of-string is the
  // only valid sentence end. Avoids breaking inside numbers.
  const re = /[.!?…]+(?=\s|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const endIdx = m.index + m[0].length;

    // What's the word ending right at this punctuation? If it's a 1-letter
    // capital (initial), or a known short abbreviation, don't break.
    const tail = text.slice(0, m.index);
    const wordMatch = tail.match(/(\w+)$/);
    const word = wordMatch?.[1] ?? "";
    if (word.length === 1 && /[A-Z]/.test(word)) continue;
    if (ABBREVS.has(word.toLowerCase())) continue;

    return endIdx;
  }
  return -1;
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
    let end = findFirstSentenceEnd(this.buffer);
    while (end > 0) {
      const sentence = this.buffer.slice(0, end).trim();
      if (sentence) speak(sentence);
      this.buffer = this.buffer.slice(end);
      this.spoken += sentence + " ";
      end = findFirstSentenceEnd(this.buffer);
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
