"use client";

import { useEffect, useState } from "react";
import { Sparkles, Droplet, Smile, ScrollText, Church, Brain, Footprints } from "lucide-react";
import { useLog } from "@/hooks/useLog";
import { useStack } from "@/hooks/useStack";
import { useProtein } from "@/hooks/useProtein";
import { useMeditation } from "@/hooks/useMeditation";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import HealthCard from "@/components/health/HealthCard";
import DailyStack from "@/components/health/DailyStack";
import JournalCard from "@/components/life/JournalCard";
import LongTermGoalsCard from "@/components/life/LongTermGoalsCard";
import ProteinTile from "@/components/protein/ProteinTile";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";

const MOOD_EMOJIS = ["😞", "😐", "🙂", "😊", "🤩"];
const MED_DURATIONS = [5, 10, 15, 20, 30];

export default function LifeMaxPage() {
  const { state, addWater, logMeditation, logMood, updateFaith, brainDump } = useLog();
  const { totalToday, target, pctOfTarget } = useProtein();
  const { items: stack } = useStack();
  const { toast } = useToast();

  const [proteinExpanded, setProteinExpanded] = useState(false);
  const [dumpText, setDumpText] = useState("");
  const [bibleMin, setBibleMin] = useState("");
  const [savingDump, setSavingDump] = useState(false);

  // Group routine items by category
  const grouped = stack.reduce<Record<string, typeof stack>>((acc, item) => {
    const cat = (item as { category?: string }).category ?? "supplement";
    acc[cat] = acc[cat] ?? [];
    acc[cat].push(item);
    return acc;
  }, {});

  const proteinColor =
    pctOfTarget >= 80 ? "#34d399" :
    pctOfTarget >= 50 ? "#fbbf24" :
                        "#a1a1aa";

  async function saveBrainDump() {
    if (!dumpText.trim()) return;
    setSavingDump(true);
    await brainDump(dumpText.trim());
    setDumpText("");
    setSavingDump(false);
    toast("Saved to personal journal");
  }

  function logFaithBible() {
    const min = parseInt(bibleMin, 10);
    if (min > 0) {
      updateFaith({ bible_min: (state.faith.bible_min || 0) + min });
      setBibleMin("");
      toast(`Logged ${min}min bible`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="anim-fade-up">
        <SectionLabel>LifeMax</SectionLabel>
      </div>

      {/* Oura / Health snapshot */}
      <div className="anim-fade-up stagger-1">
        <HealthCard />
      </div>

      {/* Daily quick toggles row */}
      <div className="anim-fade-up stagger-2">
        <Card>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Daily quick logs</span>

          {/* Water + Mood + Prayer + Bible row */}
          <div className="grid grid-cols-2 gap-2">
            {/* Water */}
            <button
              onClick={() => { haptic("light"); addWater(); }}
              className="flex items-center justify-between px-3 py-3 rounded-xl"
              style={{ background: "rgba(59,130,246,0.10)", border: "1px solid rgba(59,130,246,0.20)" }}
            >
              <div className="flex items-center gap-2">
                <Droplet size={16} className="text-blue-300" />
                <span className="text-xs text-zinc-300">Water</span>
              </div>
              <span className="text-lg font-bold text-white tabular-nums">{state.water}</span>
            </button>

            {/* Prayer */}
            <button
              onClick={() => { haptic("light"); updateFaith({ prayed: !state.faith.prayed }); }}
              className="flex items-center justify-between px-3 py-3 rounded-xl"
              style={{
                background: state.faith.prayed ? "rgba(52,211,153,0.12)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${state.faith.prayed ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <div className="flex items-center gap-2">
                <Church size={16} className={state.faith.prayed ? "text-emerald-300" : "text-zinc-500"} />
                <span className="text-xs text-zinc-300">Prayer</span>
              </div>
              <span className={`text-xs font-semibold ${state.faith.prayed ? "text-emerald-300" : "text-zinc-500"}`}>
                {state.faith.prayed ? "✓" : "—"}
              </span>
            </button>
          </div>

          {/* Mood */}
          <div className="mt-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">Mood</span>
            <div className="flex gap-2">
              {MOOD_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => { haptic("light"); logMood(i + 1); }}
                  className="flex-1 py-2 rounded-lg text-xl"
                  style={{
                    background: state.mood === i + 1 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Meditation */}
          <div className="mt-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
              Meditation {state.meditation > 0 && <span className="text-zinc-600 normal-case tracking-normal">— {state.meditation}min today</span>}
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {MED_DURATIONS.map((min) => (
                <button
                  key={min}
                  onClick={() => { haptic("light"); logMeditation(min); }}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                  style={{ background: "rgba(139,92,246,0.20)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.20)" }}
                >
                  {min}m
                </button>
              ))}
            </div>
          </div>

          {/* Bible reading */}
          <div className="mt-3">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1.5">
              Bible {state.faith.bible_min > 0 && <span className="text-zinc-600 normal-case tracking-normal">— {state.faith.bible_min}min today</span>}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="minutes"
                value={bibleMin}
                onChange={(e) => setBibleMin(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800 outline-none focus:border-zinc-700"
              />
              <button
                onClick={logFaithBible}
                disabled={!bibleMin}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.20)" }}
              >
                Log
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Protein logger */}
      <div className="anim-fade-up stagger-3">
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">— Protein</span>
            <span className="text-xs tabular-nums" style={{ color: proteinColor }}>
              {Math.round(totalToday)}g <span className="text-zinc-600">/ {target}g</span>
            </span>
          </div>
          <ProteinTile expanded={proteinExpanded} onToggle={() => setProteinExpanded((v) => !v)} />
        </Card>
      </div>

      {/* Routine: supplements, meds, injections, skincare grouped */}
      <div className="anim-fade-up stagger-4">
        <DailyStack categories={["supplement", "medication", "injection", "skincare"]} />
      </div>

      {/* Personal journal */}
      <div className="anim-fade-up stagger-5">
        <Card>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Brain dump (personal)</span>
          <textarea
            value={dumpText}
            onChange={(e) => setDumpText(e.target.value)}
            placeholder="Ideas, feelings, thoughts, prayers..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 text-zinc-100 border border-zinc-800 outline-none focus:border-zinc-700 resize-none"
          />
          <button
            onClick={saveBrainDump}
            disabled={!dumpText.trim() || savingDump}
            className="mt-2 w-full py-2 rounded-lg text-sm font-semibold text-zinc-200 disabled:opacity-40"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.10)" }}
          >
            {savingDump ? "Saving..." : "Save to Journal"}
          </button>
        </Card>
      </div>

      <div className="anim-fade-up stagger-6">
        <JournalCard />
      </div>

      <div className="anim-fade-up stagger-7">
        <LongTermGoalsCard />
      </div>
    </div>
  );
}
