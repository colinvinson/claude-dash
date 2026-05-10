"use client";

import { useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import Card from "@/components/ui/Card";
import { Zap, X, ArrowRight } from "lucide-react";

const MAX_VISIBLE = 5;

function dateLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function getTodayIso() {
  const now = new Date();
  if (now.getHours() < 6) {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return y.toISOString().split("T")[0];
  }
  return now.toISOString().split("T")[0];
}

function getTomorrowIso() {
  const now = new Date();
  if (now.getHours() < 6) return now.toISOString().split("T")[0];
  const t = new Date(now); t.setDate(t.getDate() + 1);
  return t.toISOString().split("T")[0];
}

export default function GoalmaxxingCard() {
  const { goals, tomorrowGoals, streak, loading,
          addGoal, addTomorrowGoal, toggleGoal, deleteGoal, pushToTomorrow } = useGoals();

  const [todayInput,    setTodayInput]    = useState("");
  const [tmrInput,      setTmrInput]      = useState("");
  const [polishing,     setPolishing]     = useState(false);
  const [tmrPolishing,  setTmrPolishing]  = useState(false);
  const [showAllToday,  setShowAllToday]  = useState(false);
  const [showAllTmr,    setShowAllTmr]    = useState(false);

  const complete    = goals.filter((g) => g.is_complete).length;
  const allDone     = goals.length > 0 && complete === goals.length;
  const hasIncomplete = goals.some((g) => !g.is_complete);

  const visibleGoals = showAllToday ? goals : goals.slice(0, MAX_VISIBLE);
  const hiddenCount  = goals.length - MAX_VISIBLE;
  const visibleTmr   = showAllTmr ? tomorrowGoals : tomorrowGoals.slice(0, MAX_VISIBLE);
  const hiddenTmrCnt = tomorrowGoals.length - MAX_VISIBLE;

  async function handleAdd(input: string, fn: (t: string) => Promise<void>, clear: () => void) {
    if (!input.trim()) return;
    await fn(input.trim());
    clear();
  }

  async function handlePolish(
    input: string, setInput: (v: string) => void,
    fn: (t: string) => Promise<void>, setP: (v: boolean) => void
  ) {
    if (!input.trim()) return;
    setP(true);
    try {
      const res = await fetch("/api/goals/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: input.trim() }),
      });
      const { polished } = await res.json();
      if (polished) {
        await fn(polished);
        setInput("");
      }
    } catch {
      await fn(input.trim());
      setInput("");
    } finally {
      setP(false);
    }
  }

  const progressLabel =
    goals.length === 0 ? "no goals yet"
    : allDone           ? "all done — solid day"
    : "complete";

  return (
    <div className="space-y-3">
      {/* ── TODAY ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-zinc-600 text-xs">—</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">To Do List</span>
        </div>

        <Card className={allDone ? "border-green-500/20" : ""}>
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-1">
                Today — {dateLabel(getTodayIso())}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-4xl font-bold tabular-nums ${allDone ? "text-green-400" : "text-white"}`}
                  style={{ letterSpacing: "-0.045em" }}>
                  {complete}
                </span>
                <span className="text-sm text-zinc-600 tabular-nums">/ {goals.length}</span>
                <span className={`text-[11px] font-semibold uppercase tracking-[0.10em] ml-1 ${allDone ? "text-green-400" : "text-zinc-500"}`}>
                  {progressLabel}
                </span>
              </div>
            </div>

            {/* Streak pill */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold uppercase tracking-[0.10em] transition-all ${
              streak > 0
                ? "bg-yellow-400/10 text-yellow-400 border border-yellow-400/30"
                : "bg-zinc-800/60 text-zinc-500 border border-zinc-700/40"
            }`}>
              <Zap size={13} className={streak > 0 ? "drop-shadow-[0_0_6px_rgba(242,192,99,0.6)]" : ""} />
              <span className="tabular-nums">{streak}</span>
              <span>day streak</span>
            </div>
          </div>

          {/* Segmented progress bar */}
          {goals.length > 0 && (
            <div className="flex gap-1 mb-4 h-1.5">
              {goals.map((g) => (
                <div key={g.id} className="flex-1 rounded-full transition-all" style={{
                  background: g.is_complete ? "#6BE3A4" : "rgba(255,255,255,0.08)",
                  boxShadow: g.is_complete ? "0 0 6px rgba(107,227,164,0.40)" : "none",
                }} />
              ))}
            </div>
          )}

          {/* Goal list */}
          {loading ? (
            <div className="space-y-2 mb-4">
              {[1,2,3].map((i) => <div key={i} className="h-9 bg-zinc-800/50 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-1 mb-3">
              {goals.length === 0 && (
                <p className="text-xs text-zinc-600 italic py-2 text-center">No goals for today yet — add one below.</p>
              )}
              {visibleGoals.map((goal) => (
                <div key={goal.id}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all group ${
                    goal.is_complete
                      ? "opacity-50 bg-green-400/5"
                      : "bg-zinc-800/40 hover:bg-zinc-800/60"
                  }`}>
                  {/* Checkbox */}
                  <button onClick={() => toggleGoal(goal.id, goal.is_complete)}
                    className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                      goal.is_complete
                        ? "bg-green-400 border-green-400"
                        : "border-zinc-600 hover:border-zinc-400"
                    }`}>
                    {goal.is_complete && (
                      <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none" stroke="#0a0a0b" strokeWidth="2.5">
                        <path d="M1 4l2.5 2.5L9 1" />
                      </svg>
                    )}
                  </button>

                  {/* Title */}
                  <span className={`flex-1 text-sm leading-snug ${
                    goal.is_complete ? "line-through text-zinc-500" : "text-zinc-100"
                  }`}>
                    {goal.title}
                  </span>

                  {/* ⚡ queue indicator if priority set */}
                  {goal.priority > 0 && !goal.is_complete && (
                    <Zap size={13} className="text-yellow-400 flex-shrink-0" />
                  )}

                  {/* Delete */}
                  <button onClick={() => deleteGoal(goal.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all flex-shrink-0">
                    <X size={13} />
                  </button>
                </div>
              ))}

              {/* Show more / less */}
              {hiddenCount > 0 && (
                <button onClick={() => setShowAllToday(!showAllToday)}
                  className="w-full py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors border border-dashed border-zinc-700/50 rounded-xl">
                  {showAllToday ? "Show less ▴" : `Show ${hiddenCount} more ▾`}
                </button>
              )}
            </div>
          )}

          {/* Push remaining */}
          {hasIncomplete && (
            <button onClick={pushToTomorrow}
              className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors mb-3 w-full justify-center border-t border-[#1f1f1f] pt-3">
              <ArrowRight size={12} />
              Push remaining to tomorrow
            </button>
          )}

          {/* Quick-add */}
          <div className={`flex gap-2 ${hasIncomplete ? "" : "pt-3 border-t border-[#1f1f1f]"}`}>
            <input
              value={todayInput}
              onChange={(e) => setTodayInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd(todayInput, addGoal, () => setTodayInput(""))}
              placeholder="Add a goal for today…"
              className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button onClick={() => handleAdd(todayInput, addGoal, () => setTodayInput(""))}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-900 transition-all"
              style={{ background: "linear-gradient(180deg,#fff 0%,#e8e5dd 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset" }}>
              + Add
            </button>
            <button
              disabled={polishing || !todayInput.trim()}
              onClick={() => handlePolish(todayInput, setTodayInput, addGoal, setPolishing)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 border border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800/60 disabled:opacity-40 transition-all">
              {polishing ? "…" : "✨ Polish"}
            </button>
          </div>
        </Card>
      </div>

      {/* ── PLAN TOMORROW ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-zinc-600 text-xs">—</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Plan Tomorrow</span>
          <span className="ml-auto text-[10px] text-zinc-600 tabular-nums uppercase tracking-widest">
            {tomorrowGoals.length} planned
          </span>
        </div>

        <Card>
          <div className="mb-3">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest block mb-0.5">
              {dateLabel(getTomorrowIso())}
            </span>
            <p className="text-[11px] text-zinc-600">Write tonight, starts at 6 AM.</p>
          </div>

          <div className="space-y-1 mb-3">
            {tomorrowGoals.length === 0 && (
              <p className="text-xs text-zinc-600 italic py-2 text-center">Nothing planned for tomorrow yet.</p>
            )}
            {visibleTmr.map((goal) => (
              <div key={goal.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-800/30 group">
                <div className="flex-shrink-0 w-5 h-5 rounded-md border-2 border-zinc-700/60"
                  title="Activates at 6 AM tomorrow" />
                <span className="flex-1 text-sm text-zinc-400">{goal.title}</span>
                <button onClick={() => deleteGoal(goal.id)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all">
                  <X size={13} />
                </button>
              </div>
            ))}
            {hiddenTmrCnt > 0 && (
              <button onClick={() => setShowAllTmr(!showAllTmr)}
                className="w-full py-2 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors border border-dashed border-zinc-700/50 rounded-xl">
                {showAllTmr ? "Show less ▴" : `Show ${hiddenTmrCnt} more ▾`}
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              value={tmrInput}
              onChange={(e) => setTmrInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd(tmrInput, addTomorrowGoal, () => setTmrInput(""))}
              placeholder="Plan something for tomorrow…"
              className="flex-1 bg-zinc-800/60 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button onClick={() => handleAdd(tmrInput, addTomorrowGoal, () => setTmrInput(""))}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-900 transition-all"
              style={{ background: "linear-gradient(180deg,#fff 0%,#e8e5dd 100%)", boxShadow: "0 1px 0 rgba(255,255,255,0.15) inset" }}>
              + Add
            </button>
            <button
              disabled={tmrPolishing || !tmrInput.trim()}
              onClick={() => handlePolish(tmrInput, setTmrInput, addTomorrowGoal, setTmrPolishing)}
              className="px-3 py-2 rounded-xl text-xs font-semibold text-zinc-200 border border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800/60 disabled:opacity-40 transition-all">
              {tmrPolishing ? "…" : "✨ Polish"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
