"use client";

import { useState } from "react";
import { Sun, X } from "lucide-react";
import Card from "@/components/ui/Card";
import { FormTextarea } from "@/components/ui/FormInput";
import { useDailyContext } from "@/hooks/useDailyContext";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import { PALETTE, TYPE, TINT, BORDER } from "@/lib/design-tokens";

// Merged surface: "What's the plan + Jarvis's read on the day."
//
// Replaces the two separate cards (MorningBriefing + CheckInCard) with one
// flow:
//   1. Sir hasn't checked in yet  → show plan-input prompt at top
//   2. Sir has checked in         → show the plan (collapsed pill) +
//                                   Jarvis's briefing under it
//
// Both halves are dismissible independently so once Sir has read the
// briefing it gets out of the way for the rest of the day.

export default function DayBrief() {
  const { hasCheckedIn, submit, context } = useDailyContext();
  const { body: briefingBody, loading: briefingLoading } = useMorningBriefing();
  const [text, setText]                 = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [briefingDismissed, setBriefingDismissed] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    await submit(text.trim());
    setSubmitting(false);
  }

  // Loading state — single skeleton, not two.
  if (briefingLoading && !context && !hasCheckedIn) {
    return <div className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />;
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";
  const showBriefing = hasCheckedIn && briefingBody && !briefingDismissed;

  return (
    <Card>
      {/* — PLAN INPUT or COLLAPSED PILL — */}
      {!hasCheckedIn ? (
        <>
          <p className="text-[13px] font-semibold text-zinc-100 mb-1">{greeting} What&apos;s the plan?</p>
          <p className={`${TYPE.label} mb-2`}>Jarvis tailors the day around this</p>
          <FormTextarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Lifts in the morning, dinner with M, early night..."
            rows={3}
            className="mb-2"
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(); }}
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="w-full py-2 rounded-xl text-sm font-semibold bg-white text-zinc-900 disabled:opacity-40 transition-opacity"
          >
            {submitting ? "Setting…" : "Set the plan"}
          </button>
        </>
      ) : (
        <button
          onClick={() => setPlanExpanded((x) => !x)}
          className="w-full text-left"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: PALETTE.success }} />
            <span className="text-[11px] text-zinc-400 font-medium">Plan set</span>
            {!planExpanded && context?.raw_text && (
              <span className="ml-auto text-[10px] text-zinc-600 truncate max-w-[65%]">{context.raw_text}</span>
            )}
          </div>
          {planExpanded && context?.raw_text && (
            <p className="text-sm text-zinc-300 leading-relaxed mt-2 whitespace-pre-line">{context.raw_text}</p>
          )}
        </button>
      )}

      {/* — JARVIS'S BRIEFING — */}
      {showBriefing && (
        <div
          className="relative rounded-xl mt-3 p-3"
          style={{ background: TINT.celebration, border: `1px solid ${BORDER.celebration}` }}
        >
          <button
            onClick={() => setBriefingDismissed(true)}
            className="absolute top-2 right-2 text-zinc-500 hover:text-zinc-200 transition-colors"
            aria-label="Dismiss briefing"
          >
            <X size={12} />
          </button>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sun size={11} style={{ color: PALETTE.celebration }} />
            <span className={`${TYPE.label}`} style={{ color: PALETTE.celebration }}>
              Jarvis&apos;s read
            </span>
          </div>
          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line">{briefingBody}</p>
        </div>
      )}
    </Card>
  );
}
