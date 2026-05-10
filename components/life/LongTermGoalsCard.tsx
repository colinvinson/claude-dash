"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { useJournal } from "@/hooks/useJournal";

const CATEGORIES = ["Health", "Fitness", "Career", "Personal", "Faith", "Finance"];

export default function LongTermGoalsCard() {
  const { longTermGoals, addLongTermGoal, archiveGoal } = useJournal();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Personal");
  const [targetDate, setTargetDate] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function handleAdd() {
    if (!title.trim()) return;
    setAdding(true);
    await addLongTermGoal(title.trim(), category, targetDate || undefined);
    setTitle("");
    setTargetDate("");
    setShowForm(false);
    setAdding(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">Long-term Goals</span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showForm ? "cancel" : "+ Add"}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-4 space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. wear retainer every night"
            className="w-full px-3 py-2 rounded-xl text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none placeholder-zinc-600"
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          />
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                style={{
                  background: category === c ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.06)",
                  color: category === c ? "#a78bfa" : "#71717a",
                  border: `1px solid ${category === c ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {c}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3 py-1.5 rounded-xl text-sm bg-transparent text-zinc-400 border border-zinc-700 focus:border-zinc-500 outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!title.trim() || adding}
            className="w-full py-2 rounded-xl text-sm font-semibold text-black disabled:opacity-40 transition-opacity"
            style={{ background: "#ffffff" }}
          >
            {adding ? "Adding..." : "Add Goal"}
          </button>
        </div>
      )}

      {/* Goals list */}
      <div className="space-y-2">
        {longTermGoals.length === 0 && !showForm && (
          <p className="text-sm text-zinc-600 text-center py-4">No long-term goals yet</p>
        )}
        {longTermGoals.map((goal) => (
          <div
            key={goal.id}
            className="rounded-xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            <button
              onClick={() => setExpanded((p) => (p === goal.id ? null : goal.id))}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-200 font-medium truncate">{goal.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className="text-[9px] font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
                    style={{ background: "rgba(139,92,246,0.15)", color: "#a78bfa" }}
                  >
                    {goal.category}
                  </span>
                  {goal.target_date && (
                    <span className="text-[10px] text-zinc-600">
                      by {new Date(goal.target_date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-zinc-600 text-xs" style={{ transform: expanded === goal.id ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.2s" }}>▼</span>
            </button>
            {expanded === goal.id && (
              <div className="px-3 pb-3 space-y-2">
                {goal.ai_action_plan ? (
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">
                    {goal.ai_action_plan}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-600 italic">Generating action plan...</p>
                )}
                <button
                  onClick={() => archiveGoal(goal.id)}
                  className="text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Archive goal
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
