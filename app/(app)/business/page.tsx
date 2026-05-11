"use client";

import { useState } from "react";
import { useJournal } from "@/hooks/useJournal";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/layout/SectionLabel";
import { useToast } from "@/components/ui/Toast";
import { Briefcase, X, Plus } from "lucide-react";

const BUSINESS_CATEGORIES = ["Business", "Career"];

export default function BusinessPage() {
  const { entries, longTermGoals, addEntry, addLongTermGoal, archiveGoal } = useJournal({
    entryCategory: "business",
    goalCategories: BUSINESS_CATEGORIES,
  });
  const { toast } = useToast();

  const [dumpText, setDumpText] = useState("");
  const [savingDump, setSavingDump] = useState(false);
  const [goalTitle, setGoalTitle] = useState("");
  const [goalCategory, setGoalCategory] = useState("Business");
  const [adding, setAdding] = useState(false);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

  async function saveBrainDump() {
    if (!dumpText.trim()) return;
    setSavingDump(true);
    await addEntry(dumpText.trim(), "business");
    setDumpText("");
    setSavingDump(false);
    toast("Saved to business journal");
  }

  async function handleAddGoal() {
    if (!goalTitle.trim()) return;
    setAdding(true);
    await addLongTermGoal(goalTitle.trim(), goalCategory);
    setGoalTitle("");
    setAdding(false);
  }

  return (
    <div className="space-y-4">
      <div className="anim-fade-up flex items-center gap-2">
        <Briefcase size={14} className="text-zinc-500" />
        <SectionLabel>Business</SectionLabel>
      </div>

      {/* Goals + projects */}
      <div className="anim-fade-up stagger-1">
        <Card>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Goals & projects</span>

          {longTermGoals.length === 0 ? (
            <p className="text-xs text-zinc-500 mb-3">No business goals yet. Add one below.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {longTermGoals.map((g) => {
                const open = expandedGoal === g.id;
                return (
                  <div key={g.id} className="rounded-xl overflow-hidden" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <button
                      onClick={() => setExpandedGoal(open ? null : g.id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-zinc-100 font-medium truncate">{g.title}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {g.category}{g.target_date ? ` · target ${g.target_date}` : ""}
                        </p>
                      </div>
                      <span className="text-zinc-600 text-xs ml-2">{open ? "−" : "+"}</span>
                    </button>
                    {open && (
                      <div className="px-3 pb-3 -mt-1">
                        {g.ai_action_plan ? (
                          <div className="mt-2 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.04)" }}>
                            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Action plan</span>
                            <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{g.ai_action_plan}</p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-zinc-600 italic mt-2">Generating action plan…</p>
                        )}
                        <button
                          onClick={() => archiveGoal(g.id)}
                          className="mt-3 text-[11px] text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-1"
                        >
                          <X size={11} /> Archive
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add goal */}
          <div className="space-y-2 pt-3 border-t border-zinc-800">
            <input
              value={goalTitle}
              onChange={(e) => setGoalTitle(e.target.value)}
              placeholder="New business goal or project"
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
            <div className="flex gap-2">
              <select
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value)}
                className="bg-zinc-900 text-zinc-100 rounded-xl px-2.5 py-2 text-sm outline-none border border-zinc-800"
              >
                {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={handleAddGoal}
                disabled={!goalTitle.trim() || adding}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-zinc-100 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Brain dump */}
      <div className="anim-fade-up stagger-2">
        <Card>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Business brain dump</span>
          <textarea
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            placeholder="Ideas, notes, decisions, deals, anything..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800 outline-none focus:border-zinc-700 resize-none"
          />
          <button
            onClick={saveBrainDump}
            disabled={!dumpText.trim() || savingDump}
            className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-zinc-200 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {savingDump ? "Saving..." : "Save"}
          </button>
        </Card>
      </div>

      {/* Recent business entries */}
      {entries.length > 0 && (
        <div className="anim-fade-up stagger-3">
          <Card>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Recent entries</span>
            <div className="space-y-3">
              {entries.slice(0, 10).map((e) => (
                <div key={e.id} className="pb-3 last:pb-0 border-b border-zinc-800 last:border-b-0">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest mb-1">
                    {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                  {e.ai_summary && (
                    <p className="text-xs font-semibold text-zinc-300 mb-1">{e.ai_summary}</p>
                  )}
                  <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line">{e.content}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
