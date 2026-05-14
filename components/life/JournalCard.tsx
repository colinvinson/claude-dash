"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { useJournal } from "@/hooks/useJournal";

export default function JournalCard() {
  const { entries, addEntry } = useJournal();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function handleSave() {
    if (!text.trim()) return;
    setSaving(true);
    await addEntry(text.trim());
    setText("");
    setSaving(false);
  }

  return (
    <Card>
      <div className="mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Brain Dump</span>
        <p className="text-[10px] text-zinc-600 mt-0.5">Goals, ideas, feelings, anything — Jarvis reads this.</p>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="New business idea, feeling scattered today, want to learn piano..."
        rows={4}
        className="w-full px-3 py-2 rounded-xl text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none resize-none placeholder-zinc-700 mb-3"
      />
      <button
        onClick={handleSave}
        disabled={!text.trim() || saving}
        className="w-full py-2 rounded-xl text-sm font-semibold text-black disabled:opacity-40 transition-opacity mb-4"
        style={{ background: "#ffffff" }}
      >
        {saving ? "Saving..." : "Save to Journal"}
      </button>

      {/* Recent entries */}
      {entries.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Recent</p>
          {entries.slice(0, 5).map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl overflow-hidden"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
            >
              <button
                onClick={() => setExpanded((p) => (p === entry.id ? null : entry.id))}
                className="w-full px-3 py-2.5 text-left"
              >
                <p className="text-[11px] text-zinc-400 line-clamp-1">
                  {entry.ai_summary ?? entry.content}
                </p>
                <p className="text-[9px] text-zinc-700 mt-0.5">
                  {new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </p>
              </button>
              {expanded === entry.id && (
                <div className="px-3 pb-3">
                  <p className="text-xs text-zinc-300 leading-relaxed">{entry.content}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
