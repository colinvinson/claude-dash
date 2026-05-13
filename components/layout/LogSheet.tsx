"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useLog } from "@/hooks/useLog";
import { useJournal } from "@/hooks/useJournal";
import ProteinTile from "@/components/protein/ProteinTile";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";

const DRINK_TYPES = ["Beer", "Wine", "Spirits", "Cocktail"];
const MOOD_EMOJIS = ["😞", "😐", "🙂", "😊", "🤩"];
const MED_DURATIONS = [5, 10, 15, 20, 30];
const DUMP_CATEGORIES = ["personal", "business", "other"] as const;
type DumpCategory = typeof DUMP_CATEGORIES[number];

export default function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addWater, logMeditation, logAlcohol, updateFaith, logMood, logWeight } = useLog();
  const { addEntry } = useJournal();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Local input state
  const [drinkType, setDrinkType] = useState("Beer");
  const [drinkCount, setDrinkCount] = useState(1);
  const [bibleMin, setBibleMin] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [dumpText, setDumpText] = useState("");
  const [dumpCat, setDumpCat] = useState<DumpCategory>("personal");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function toggle(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  async function handle(key: string, fn: () => Promise<void> | void) {
    setSaving(key);
    haptic("light");
    await fn();
    setSaving(null);
    setSaved(key);
    setTimeout(() => setSaved(null), 1500);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 anim-fade" onClick={onClose} />

      <div
        className="fixed bottom-0 inset-x-0 z-50 rounded-t-3xl overflow-y-auto anim-sheet"
        style={{
          maxHeight: "85vh",
          background: "rgba(10,10,12,0.97)",
          backdropFilter: "blur(32px) saturate(1.2)",
          WebkitBackdropFilter: "blur(32px) saturate(1.2)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-zinc-700" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold uppercase tracking-widest text-zinc-300">Log</span>
            <span className="text-[10px] text-zinc-600">Tap anything to record it</span>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-4 pb-8 space-y-2">
          {/* Water — one-tap counter */}
          <LogTile
            emoji="💧"
            label="Water"
            meta={`${state.water} glasses today`}
            expanded={expanded === "water"}
            onToggle={() => toggle("water")}
          >
            <div className="flex items-center gap-3 pt-2">
              <span className="text-2xl font-bold text-white tabular-nums">{state.water}</span>
              <span className="text-sm text-zinc-500">glasses today</span>
              <button
                onClick={() => handle("water", addWater)}
                className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "rgba(59,130,246,0.3)", border: "1px solid rgba(59,130,246,0.3)" }}
              >
                {saving === "water" ? "..." : saved === "water" ? "✓" : "+1"}
              </button>
            </div>
          </LogTile>

          {/* Protein — full tile with manual/photo/barcode */}
          <ProteinTile expanded={expanded === "protein"} onToggle={() => toggle("protein")} />

          {/* Meditation */}
          <LogTile
            emoji="🧘"
            label="Meditation"
            meta={state.meditation > 0 ? `${state.meditation} min today` : "none today"}
            expanded={expanded === "meditation"}
            onToggle={() => toggle("meditation")}
          >
            <div className="flex gap-2 pt-2 flex-wrap">
              {MED_DURATIONS.map((min) => (
                <button
                  key={min}
                  onClick={() => handle(`med-${min}`, () => logMeditation(min))}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                  style={{ background: "rgba(139,92,246,0.2)", color: "#a78bfa", border: "1px solid rgba(139,92,246,0.2)" }}
                >
                  {saved === `med-${min}` ? "✓" : `${min}m`}
                </button>
              ))}
            </div>
          </LogTile>

          {/* Mood */}
          <LogTile
            emoji="😊"
            label="Mood"
            meta={state.mood ? `${MOOD_EMOJIS[state.mood - 1]} ${state.mood}/5` : "not logged"}
            expanded={expanded === "mood"}
            onToggle={() => toggle("mood")}
          >
            <div className="flex gap-3 pt-2">
              {MOOD_EMOJIS.map((emoji, i) => (
                <button
                  key={i}
                  onClick={() => handle("mood", () => logMood(i + 1))}
                  className="flex-1 py-2 rounded-lg text-xl transition-transform hover:scale-110"
                  style={{
                    background: state.mood === i + 1 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </LogTile>

          {/* Weight */}
          <LogTile
            emoji="⚖️"
            label="Weight"
            meta={state.weight ? `${state.weight} kg` : "not logged"}
            expanded={expanded === "weight"}
            onToggle={() => toggle("weight")}
          >
            <div className="flex items-center gap-3 pt-2">
              <input
                type="number"
                step="0.1"
                placeholder="kg"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-24 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none"
              />
              <button
                onClick={() => {
                  const kg = parseFloat(weightInput);
                  if (kg > 0) {
                    handle("weight", () => logWeight(kg));
                    setWeightInput("");
                  }
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: "rgba(59,130,246,0.25)", border: "1px solid rgba(59,130,246,0.2)" }}
              >
                {saving === "weight" ? "..." : saved === "weight" ? "✓" : "Log"}
              </button>
            </div>
          </LogTile>

          {/* Alcohol */}
          <LogTile
            emoji="🍺"
            label="Alcohol"
            meta={state.alcoholCount > 0 ? `${state.alcoholCount} drinks today` : "none logged"}
            expanded={expanded === "alcohol"}
            onToggle={() => toggle("alcohol")}
          >
            <div className="pt-2 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {DRINK_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setDrinkType(t)}
                    className="px-3 py-1 rounded-lg text-[11px] font-medium"
                    style={{
                      background: drinkType === t ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.06)",
                      color: drinkType === t ? "#fbbf24" : "#71717a",
                      border: `1px solid ${drinkType === t ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setDrinkCount((n) => Math.max(1, n - 1))}
                  className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >−</button>
                <span className="text-xl font-bold text-white w-6 text-center">{drinkCount}</span>
                <button
                  onClick={() => setDrinkCount((n) => n + 1)}
                  className="w-8 h-8 rounded-full text-lg font-bold flex items-center justify-center"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >+</button>
                <button
                  onClick={() => handle("alcohol", () => logAlcohol(drinkType, drinkCount))}
                  className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(251,191,36,0.25)", border: "1px solid rgba(251,191,36,0.2)" }}
                >
                  {saving === "alcohol" ? "..." : saved === "alcohol" ? "✓ Logged" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Faith — combined prayer + bible + church */}
          <LogTile
            emoji="🙏"
            label="Faith"
            meta={faithSummary(state.faith)}
            expanded={expanded === "faith"}
            onToggle={() => toggle("faith")}
          >
            <div className="pt-2 space-y-2.5">
              <div className="flex gap-2">
                <button
                  onClick={() => handle("prayer", () => updateFaith({ prayed: !state.faith.prayed }))}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: state.faith.prayed ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)",
                    color: state.faith.prayed ? "#34d399" : "#a1a1aa",
                    border: `1px solid ${state.faith.prayed ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {state.faith.prayed ? "✓ Prayed" : "Mark prayed"}
                </button>
                <button
                  onClick={() => handle("church", () => updateFaith({ church_attended: !state.faith.church_attended }))}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: state.faith.church_attended ? "rgba(52,211,153,0.2)" : "rgba(255,255,255,0.06)",
                    color: state.faith.church_attended ? "#34d399" : "#a1a1aa",
                    border: `1px solid ${state.faith.church_attended ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {state.faith.church_attended ? "✓ Church" : "Church"}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="bible minutes"
                  value={bibleMin}
                  onChange={(e) => setBibleMin(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none"
                />
                <button
                  onClick={() => {
                    const min = parseInt(bibleMin, 10);
                    if (min > 0) {
                      handle("bible", () => updateFaith({ bible_min: (state.faith.bible_min || 0) + min }));
                      setBibleMin("");
                    }
                  }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(139,92,246,0.25)", border: "1px solid rgba(139,92,246,0.2)" }}
                >
                  {saving === "bible" ? "..." : saved === "bible" ? "✓" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Brain dump — single entry with category tag */}
          <LogTile
            emoji="🧠"
            label="Brain dump"
            meta="thoughts, ideas, notes — tagged"
            expanded={expanded === "dump"}
            onToggle={() => toggle("dump")}
          >
            <div className="pt-2 space-y-2">
              <textarea
                value={dumpText}
                onChange={(e) => setDumpText(e.target.value)}
                placeholder="Dump anything here — ideas, feelings, decisions, prayers, deals..."
                rows={4}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none resize-none placeholder-zinc-600"
              />
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500 mr-1">Tag</span>
                {DUMP_CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setDumpCat(c)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
                    style={{
                      background: dumpCat === c ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.05)",
                      color: dumpCat === c ? "#fafafa" : "#a1a1aa",
                      border: `1px solid ${dumpCat === c ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </button>
                ))}
              </div>
              <button
                disabled={!dumpText.trim()}
                onClick={async () => {
                  if (!dumpText.trim()) return;
                  setSaving("dump");
                  haptic("light");
                  // useJournal addEntry accepts personal | business — map "other" to personal
                  const cat = dumpCat === "business" ? "business" : "personal";
                  await addEntry(dumpText.trim(), cat);
                  setDumpText("");
                  setSaving(null);
                  toast("Saved to journal");
                }}
                className="w-full py-2 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.08)", color: "#e4e4e7" }}
              >
                {saving === "dump" ? "Saving..." : "Save"}
              </button>
            </div>
          </LogTile>
        </div>
      </div>
    </>
  );
}

function faithSummary(faith: { prayed: boolean; bible_min: number; church_attended: boolean }): string {
  const parts: string[] = [];
  if (faith.prayed) parts.push("prayed");
  if (faith.bible_min > 0) parts.push(`${faith.bible_min}min bible`);
  if (faith.church_attended) parts.push("church");
  return parts.length > 0 ? parts.join(" · ") : "nothing logged";
}

function LogTile({
  emoji, label, meta, expanded, onToggle, children,
}: {
  emoji: string;
  label: string;
  meta: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{emoji}</span>
          <div>
            <p className="text-sm font-medium text-zinc-100">{label}</p>
            <p className="text-[11px] text-zinc-500">{meta}</p>
          </div>
        </div>
        <span className="text-zinc-600 text-xs">{expanded ? "−" : "+"}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
