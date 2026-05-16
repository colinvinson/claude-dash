"use client";

import { useEffect, useMemo, useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useStack } from "@/hooks/useStack";
import { useProtein } from "@/hooks/useProtein";
import { useWorkout } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";
import { Sparkles, Volume2 } from "lucide-react";
import { haptic } from "@/lib/feedback/haptics";
import { speak, cancelSpeech } from "@/lib/jarvis/voice";
import ConfettiBurst from "@/components/ui/ConfettiBurst";

// End-of-day wrap. Surfaces when:
//   - everything is closed (goals 100% + schedule 100% + protein ≥100%), OR
//   - clock is past 9pm.
// Sir can dismiss it for the day. State persists in localStorage so it
// doesn't re-pop on every refresh.

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function TodayWrap() {
  const { goals, streak } = useGoals();
  const { items: stack } = useStack();
  const { totalToday: pToday, target: pTarget } = useProtein();
  const { todaySets } = useWorkout();

  const goalsDone  = goals.filter((g) => g.is_complete).length;
  const stackDone  = stack.filter((s) => s.taken).length;
  const proteinPct = pTarget > 0 ? (pToday / pTarget) : 0;
  const setsLogged = todaySets.length;

  const allClosed = goals.length > 0 && goalsDone === goals.length &&
                    stack.length > 0 && stackDone === stack.length &&
                    proteinPct >= 1;

  const hour = new Date().getHours();
  const pastNine = hour >= 21;
  const eligible = allClosed || pastNine;

  const dismissKey = `wrapDismissed-${todayKey()}`;
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(window.localStorage.getItem(dismissKey) === "1");
  }, [dismissKey]);

  const [burst, setBurst] = useState(0);
  const [speaking, setSpeaking] = useState(false);
  const [recapText, setRecapText] = useState<string | null>(null);

  // Confetti once when wrap appears at the all-closed end of day.
  useEffect(() => {
    if (eligible && !dismissed && allClosed) {
      setBurst((n) => n + 1);
      haptic("milestone");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligible, dismissed]);

  function dismiss() {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(dismissKey, "1");
    setDismissed(true);
    cancelSpeech();
  }

  async function speakRecap() {
    if (speaking) { cancelSpeech(); setSpeaking(false); return; }
    setSpeaking(true);
    try {
      const res = await fetch("/api/jarvis/day-recap", { method: "POST" });
      if (!res.ok) { setSpeaking(false); return; }
      const j = await res.json() as { recap?: string };
      const text = j.recap ?? "Day logged. Well done, sir.";
      setRecapText(text);
      speak(text, { onEnd: () => setSpeaking(false) });
    } catch {
      setSpeaking(false);
    }
  }

  const headline = useMemo(() => {
    if (allClosed) return "Day closed. All three rings, all goals, all stack.";
    if (proteinPct >= 1 && goalsDone === goals.length) return "Strong day — close out the stack to seal it.";
    if (goalsDone === goals.length) return "Goals cleared. Stack and fuel still open.";
    if (stackDone === stack.length) return "Stack done. Goals still open.";
    return `${goalsDone}/${goals.length} goals · ${stackDone}/${stack.length} stack · ${Math.round(proteinPct * 100)}% protein.`;
  }, [allClosed, goalsDone, goals.length, stackDone, stack.length, proteinPct]);

  if (!eligible || dismissed) return null;

  const accent = allClosed ? "#34d399" : "#fbbf24";

  return (
    <Card>
      <div className="relative">
        <ConfettiBurst trigger={burst} count={36} spread={160} />
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accent }}>
            — Today&apos;s wrap
          </span>
          <button
            onClick={dismiss}
            className="text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            Dismiss
          </button>
        </div>
        <h3 className="text-base font-bold text-zinc-50 mb-3 leading-snug">{headline}</h3>
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Stat label="Streak"  value={`${streak}d`} accent={streak > 0 ? "text-amber-300" : "text-zinc-500"} />
          <Stat label="Goals"   value={`${goalsDone}/${goals.length || 0}`} />
          <Stat label="Stack"   value={`${stackDone}/${stack.length || 0}`} />
          <Stat label="Sets"    value={`${setsLogged}`} />
        </div>
        <button
          onClick={speakRecap}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-100 text-zinc-900 text-sm font-bold hover:opacity-90 transition-opacity"
        >
          <Volume2 size={14} />
          {speaking ? "Stop" : "Jarvis recap"}
          <Sparkles size={12} className="opacity-60" />
        </button>
        {recapText && !speaking && (
          <p className="text-[11px] text-zinc-500 mt-2 italic">&ldquo;{recapText}&rdquo;</p>
        )}
      </div>
    </Card>
  );
}

function Stat({ label, value, accent = "text-zinc-200" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase tracking-widest text-zinc-600">{label}</p>
      <p className={`text-base font-bold tabular-nums ${accent}`}>{value}</p>
    </div>
  );
}
