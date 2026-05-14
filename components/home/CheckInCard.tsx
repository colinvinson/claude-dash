"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { useDailyContext } from "@/hooks/useDailyContext";

export default function CheckInCard() {
  const { hasCheckedIn, submit, context } = useDailyContext();
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    await submit(text.trim());
    setSubmitting(false);
    setCollapsed(true);
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning." : hour < 17 ? "Good afternoon." : "Good evening.";

  // Already checked in and collapsed — show pill
  if (hasCheckedIn && collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="w-full text-left"
      >
        <Card style={{ padding: "10px 14px" }}>
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="text-[11px] text-zinc-400 font-medium">Plan set for today</span>
            <span className="ml-auto text-[10px] text-zinc-600 truncate max-w-[60%]">
              {context?.raw_text}
            </span>
          </div>
        </Card>
      </button>
    );
  }

  // Already checked in but expanded — show read-only
  if (hasCheckedIn && !collapsed) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Today&apos;s Plan</span>
          <button
            onClick={() => setCollapsed(true)}
            className="text-[10px] text-zinc-600 hover:text-zinc-400"
          >
            collapse
          </button>
        </div>
        <p className="text-sm text-zinc-300 leading-relaxed">{context?.raw_text}</p>
      </Card>
    );
  }

  // Not checked in — show input
  return (
    <Card style={{ border: "1px solid rgba(255,255,255,0.10)" }}>
      <p className="text-[13px] font-semibold text-zinc-200 mb-1">{greeting} What&apos;s the plan?</p>
      <p className="text-[10px] text-zinc-500 mb-3 uppercase tracking-widest">Jarvis will tailor your day around this</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Cubs game at 8pm, drinking after... going to gym in the morning..."
        rows={3}
        className="w-full px-3 py-2 rounded-xl text-sm bg-transparent text-white border border-zinc-800 focus:border-zinc-600 outline-none resize-none placeholder-zinc-700 mb-3"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!text.trim() || submitting}
        className="w-full py-2 rounded-xl text-sm font-semibold text-black transition-opacity disabled:opacity-40"
        style={{ background: "#ffffff" }}
      >
        {submitting ? "Setting plan..." : "Set the plan"}
      </button>
    </Card>
  );
}
