"use client";

import { useState } from "react";
import { useMorningBriefing } from "@/hooks/useMorningBriefing";
import { Sun, X } from "lucide-react";

export default function MorningBriefing() {
  const { body, loading } = useMorningBriefing();
  const [dismissed, setDismissed] = useState(false);

  if (loading) {
    return (
      <div className="h-24 rounded-2xl animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
    );
  }
  if (!body || dismissed) return null;

  return (
    <div
      className="relative rounded-2xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(255,184,77,0.08), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,184,77,0.18)",
      }}
    >
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-zinc-600 hover:text-zinc-300 transition-colors"
      >
        <X size={14} />
      </button>
      <div className="flex items-center gap-2 mb-2">
        <Sun size={14} className="text-orange-300" />
        <span className="text-[10px] uppercase tracking-widest text-orange-300 font-semibold">Today&apos;s briefing</span>
      </div>
      <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}
