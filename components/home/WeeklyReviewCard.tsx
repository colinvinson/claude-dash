"use client";

import { useState } from "react";
import { useWeeklyReview } from "@/hooks/useWeeklyReview";
import Card from "@/components/ui/Card";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";

export default function WeeklyReviewCard() {
  const { body, highlights, loading } = useWeeklyReview();
  const [open, setOpen] = useState(false);

  if (loading || !body) return null;

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2.5">
          <Mail size={16} className="text-zinc-300" />
          <div>
            <p className="text-sm font-semibold text-zinc-100">This week&apos;s review</p>
            {highlights && (highlights.prs.length > 0 || highlights.stalled.length > 0) && (
              <p className="text-[10px] text-zinc-500 mt-0.5">
                {highlights.prs.length > 0 && <span className="text-emerald-400">{highlights.prs.length} PR{highlights.prs.length > 1 ? "s" : ""}</span>}
                {highlights.prs.length > 0 && highlights.stalled.length > 0 && <span className="text-zinc-700"> · </span>}
                {highlights.stalled.length > 0 && <span className="text-amber-400">{highlights.stalled.length} stalled</span>}
              </p>
            )}
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
      </button>

      {open && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">{body}</p>
        </div>
      )}
    </Card>
  );
}
