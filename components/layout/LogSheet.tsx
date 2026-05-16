"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useLog } from "@/hooks/useLog";
import { useJournal } from "@/hooks/useJournal";
import { useDimensionLogs } from "@/hooks/useDimensionLogs";
import { useLongTermGoals } from "@/hooks/useLongTermGoals";
import ProteinTile from "@/components/protein/ProteinTile";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";
import { matchGoals, formatAlignment, type ActionKind } from "@/lib/goals/alignment";

const DRINK_TYPES = ["Beer", "Wine", "Spirits", "Cocktail"];
const MOOD_EMOJIS = ["😞", "😐", "🙂", "😊", "🤩"];
const MED_DURATIONS = [5, 10, 15, 20, 30];
const DUMP_CATEGORIES = ["personal", "business", "other"] as const;
type DumpCategory = typeof DUMP_CATEGORIES[number];

const CARDIO_KINDS  = ["zone2", "hiit", "walk", "run", "bike", "row"];
const SOCIAL_KINDS  = ["in-person", "call", "text", "event"];
const LEARN_KINDS   = ["reading", "course", "podcast", "video", "practice"];
const MONEY_KINDS   = ["income", "expense", "savings", "business_revenue"] as const;
const AESTHETIC_ANGLES = ["front", "back", "side", "flex", "face"];
const CAFFEINE_PRESETS = [
  { label: "Espresso",   mg: 64, source: "espresso" },
  { label: "Coffee",     mg: 95, source: "coffee" },
  { label: "Tea",        mg: 47, source: "tea" },
  { label: "Pre-workout",mg: 200, source: "preworkout" },
];

export default function LogSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, addWater, logMeditation, logAlcohol, updateFaith, logMood, logWeight } = useLog();
  const { addEntry } = useJournal();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  // Active long-term goals — used for goal-alignment overlay so every
  // logged action visibly ties back to what Sir's moving toward.
  const { goals: allGoals } = useLongTermGoals();
  const alignableGoals = allGoals.map((g) => ({
    id: g.id, title: g.title, category: g.category, goal_type: g.goal_type,
  }));
  function flashAlignment(actionKind: ActionKind) {
    const matches = matchGoals(actionKind, alignableGoals);
    const msg = formatAlignment(matches);
    if (msg) toast(msg);
  }

  // The 9 new dimensions — one hook per table, today's rows only.
  const focus     = useDimensionLogs("focus_sessions");
  const cardio    = useDimensionLogs("cardio_logs");
  const social    = useDimensionLogs("social_logs");
  const libido    = useDimensionLogs("libido_logs");
  const aesthetic = useDimensionLogs("aesthetic_logs");
  const caffeine  = useDimensionLogs("caffeine_logs");
  const sun       = useDimensionLogs("sun_logs");
  const learning  = useDimensionLogs("learning_logs");
  const money     = useDimensionLogs("money_logs");

  // Local input state
  const [drinkType, setDrinkType] = useState("Beer");
  const [drinkCount, setDrinkCount] = useState(1);
  const [bibleMin, setBibleMin] = useState("");
  const [weightInput, setWeightInput] = useState("");
  const [dumpText, setDumpText] = useState("");
  const [dumpCat, setDumpCat] = useState<DumpCategory>("personal");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // New-dimension input state
  const [focusDuration,    setFocusDuration]    = useState("");
  const [focusProject,     setFocusProject]     = useState("");
  const [cardioKind,       setCardioKind]       = useState("zone2");
  const [cardioDuration,   setCardioDuration]   = useState("");
  const [socialKind,       setSocialKind]       = useState("in-person");
  const [socialContact,    setSocialContact]    = useState("");
  const [libidoRating,     setLibidoRating]     = useState<number | null>(null);
  const [aestheticAngle,   setAestheticAngle]   = useState("front");
  const [aestheticRating,  setAestheticRating]  = useState<number | null>(null);
  const [aestheticNotes,   setAestheticNotes]   = useState("");
  const [sunDuration,      setSunDuration]      = useState("");
  const [sunSunscreen,     setSunSunscreen]     = useState(false);
  const [learnKind,        setLearnKind]        = useState("reading");
  const [learnSource,      setLearnSource]      = useState("");
  const [learnDuration,    setLearnDuration]    = useState("");
  const [moneyAmount,      setMoneyAmount]      = useState("");
  const [moneyKind,        setMoneyKind]        = useState<typeof MONEY_KINDS[number]>("expense");
  const [moneyCategory,    setMoneyCategory]    = useState("");

  // Derived summaries
  const focusTotalMin  = focus.rows.reduce((s, r) => s + (Number(r.duration_min) || 0), 0);
  const cardioTotalMin = cardio.rows.reduce((s, r) => s + (Number(r.duration_min) || 0), 0);
  const socialCount    = social.rows.length;
  const libidoLatest   = libido.rows[0]?.rating as number | undefined;
  const aestheticCount = aesthetic.rows.length;
  const caffeineTotalMg = caffeine.rows.reduce((s, r) => s + (Number(r.mg) || 0), 0);
  const sunTotalMin    = sun.rows.reduce((s, r) => s + (Number(r.duration_min) || 0), 0);
  const learnTotalMin  = learning.rows.reduce((s, r) => s + (Number(r.duration_min) || 0), 0);
  const moneyDelta     = money.rows.reduce((s, r) => {
    const a = Number(r.amount) || 0;
    return r.kind === "income" || r.kind === "business_revenue" ? s + a : s - a;
  }, 0);

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

          {/* ── BODY ── */}
          <Section>Body</Section>

          {/* Cardio */}
          <LogTile
            emoji="🏃"
            label="Cardio"
            meta={cardioTotalMin > 0 ? `${cardioTotalMin} min today` : "none today"}
            expanded={expanded === "cardio"}
            onToggle={() => toggle("cardio")}
          >
            <div className="pt-2 space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {CARDIO_KINDS.map((k) => (
                  <PillBtn key={k} on={cardioKind === k} onClick={() => setCardioKind(k)}>{k}</PillBtn>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input type="number" placeholder="min" value={cardioDuration} onChange={(e) => setCardioDuration(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
                <button
                  onClick={async () => {
                    const m = parseInt(cardioDuration, 10);
                    if (!(m > 0)) return;
                    setSaving("cardio"); haptic("light");
                    await cardio.logEntry({ kind: cardioKind, duration_min: m });
                    flashAlignment("cardio");
                    setCardioDuration(""); setSaving(null); setSaved("cardio");
                    setTimeout(() => setSaved(null), 1500);
                  }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(14,165,233,0.25)", border: "1px solid rgba(14,165,233,0.25)" }}
                >
                  {saving === "cardio" ? "..." : saved === "cardio" ? "✓" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Sun */}
          <LogTile
            emoji="☀️"
            label="Sun"
            meta={sunTotalMin > 0 ? `${sunTotalMin} min today` : "none today"}
            expanded={expanded === "sun"}
            onToggle={() => toggle("sun")}
          >
            <div className="pt-2 space-y-2">
              <div className="flex items-center gap-2">
                <input type="number" placeholder="min" value={sunDuration} onChange={(e) => setSunDuration(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <input type="checkbox" checked={sunSunscreen} onChange={(e) => setSunSunscreen(e.target.checked)} />
                  SPF
                </label>
                <button
                  onClick={async () => {
                    const m = parseInt(sunDuration, 10);
                    if (!(m > 0)) return;
                    setSaving("sun"); haptic("light");
                    await sun.logEntry({ duration_min: m, with_sunscreen: sunSunscreen });
                    flashAlignment("sun");
                    setSunDuration(""); setSunSunscreen(false); setSaving(null); setSaved("sun");
                    setTimeout(() => setSaved(null), 1500);
                  }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(251,191,36,0.25)", border: "1px solid rgba(251,191,36,0.25)" }}
                >
                  {saving === "sun" ? "..." : saved === "sun" ? "✓" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Caffeine */}
          <LogTile
            emoji="☕"
            label="Caffeine"
            meta={caffeineTotalMg > 0 ? `${caffeineTotalMg} mg today` : "none today"}
            expanded={expanded === "caffeine"}
            onToggle={() => toggle("caffeine")}
          >
            <div className="pt-2 grid grid-cols-2 gap-1.5">
              {CAFFEINE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={async () => {
                    setSaving(`caffeine-${p.label}`); haptic("light");
                    await caffeine.logEntry({ mg: p.mg, source: p.source });
                    setSaving(null); setSaved(`caffeine-${p.label}`);
                    setTimeout(() => setSaved(null), 1500);
                  }}
                  className="px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{ background: "rgba(120,113,108,0.20)", color: "#a8a29e", border: "1px solid rgba(120,113,108,0.25)" }}
                >
                  {saved === `caffeine-${p.label}` ? "✓" : `${p.label} · ${p.mg}mg`}
                </button>
              ))}
            </div>
          </LogTile>

          {/* ── MIND ── */}
          <Section>Mind</Section>

          {/* Focus session */}
          <LogTile
            emoji="🎯"
            label="Focus session"
            meta={focusTotalMin > 0 ? `${focusTotalMin} min today` : "no deep work logged"}
            expanded={expanded === "focus"}
            onToggle={() => toggle("focus")}
          >
            <div className="pt-2 space-y-2">
              <input value={focusProject} onChange={(e) => setFocusProject(e.target.value)} placeholder="what you worked on (optional)" className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
              <div className="flex items-center gap-2">
                <input type="number" placeholder="min" value={focusDuration} onChange={(e) => setFocusDuration(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
                <button
                  onClick={async () => {
                    const m = parseInt(focusDuration, 10);
                    if (!(m > 0)) return;
                    setSaving("focus"); haptic("light");
                    await focus.logEntry({ duration_min: m, project: focusProject.trim() || null });
                    flashAlignment("focus");
                    setFocusDuration(""); setFocusProject(""); setSaving(null); setSaved("focus");
                    setTimeout(() => setSaved(null), 1500);
                  }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(167,139,250,0.25)", border: "1px solid rgba(167,139,250,0.25)" }}
                >
                  {saving === "focus" ? "..." : saved === "focus" ? "✓" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Libido */}
          <LogTile
            emoji="🔥"
            label="Libido"
            meta={libidoLatest ? `today: ${libidoLatest}/10` : "not logged"}
            expanded={expanded === "libido"}
            onToggle={() => toggle("libido")}
          >
            <div className="pt-2">
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button
                    key={n}
                    onClick={async () => {
                      setLibidoRating(n);
                      setSaving("libido"); haptic("light");
                      await libido.logEntry({ rating: n });
                      flashAlignment("libido");
                      setSaving(null); setSaved("libido");
                      setTimeout(() => { setSaved(null); setLibidoRating(null); }, 1500);
                    }}
                    className="flex-1 py-2 rounded-md text-sm font-bold tabular-nums"
                    style={{
                      background: (libidoRating ?? libidoLatest) === n ? "rgba(244,63,94,0.30)" : "rgba(255,255,255,0.05)",
                      color: (libidoRating ?? libidoLatest) === n ? "#fb7185" : "#a1a1aa",
                      border: `1px solid ${(libidoRating ?? libidoLatest) === n ? "rgba(244,63,94,0.4)" : "rgba(255,255,255,0.05)"}`,
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </LogTile>

          {/* ── LIFE ── */}
          <Section>Life</Section>

          {/* Social */}
          <LogTile
            emoji="👥"
            label="Social"
            meta={socialCount > 0 ? `${socialCount} ${socialCount === 1 ? "interaction" : "interactions"} today` : "no contact logged"}
            expanded={expanded === "social"}
            onToggle={() => toggle("social")}
          >
            <div className="pt-2 space-y-2">
              <input value={socialContact} onChange={(e) => setSocialContact(e.target.value)} placeholder="who (name or context)" className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
              <div className="flex gap-1.5 flex-wrap">
                {SOCIAL_KINDS.map((k) => (
                  <PillBtn key={k} on={socialKind === k} onClick={() => setSocialKind(k)}>{k}</PillBtn>
                ))}
              </div>
              <button
                onClick={async () => {
                  if (!socialContact.trim()) return;
                  setSaving("social"); haptic("light");
                  await social.logEntry({ contact_name: socialContact.trim(), kind: socialKind });
                  flashAlignment("social");
                  setSocialContact(""); setSaving(null); setSaved("social");
                  setTimeout(() => setSaved(null), 1500);
                }}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "rgba(96,165,250,0.25)", border: "1px solid rgba(96,165,250,0.25)" }}
              >
                {saving === "social" ? "..." : saved === "social" ? "✓ Logged" : "Log interaction"}
              </button>
            </div>
          </LogTile>

          {/* Learning */}
          <LogTile
            emoji="📚"
            label="Learning"
            meta={learnTotalMin > 0 ? `${learnTotalMin} min today` : "none today"}
            expanded={expanded === "learning"}
            onToggle={() => toggle("learning")}
          >
            <div className="pt-2 space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {LEARN_KINDS.map((k) => (
                  <PillBtn key={k} on={learnKind === k} onClick={() => setLearnKind(k)}>{k}</PillBtn>
                ))}
              </div>
              <input value={learnSource} onChange={(e) => setLearnSource(e.target.value)} placeholder="source (book / channel / etc)" className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
              <div className="flex items-center gap-2">
                <input type="number" placeholder="min" value={learnDuration} onChange={(e) => setLearnDuration(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
                <button
                  onClick={async () => {
                    const m = parseInt(learnDuration, 10);
                    if (!(m > 0)) return;
                    setSaving("learning"); haptic("light");
                    await learning.logEntry({ kind: learnKind, source: learnSource.trim() || null, duration_min: m });
                    flashAlignment("learning");
                    setLearnDuration(""); setLearnSource(""); setSaving(null); setSaved("learning");
                    setTimeout(() => setSaved(null), 1500);
                  }}
                  className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                  style={{ background: "rgba(52,211,153,0.25)", border: "1px solid rgba(52,211,153,0.25)" }}
                >
                  {saving === "learning" ? "..." : saved === "learning" ? "✓" : "Log"}
                </button>
              </div>
            </div>
          </LogTile>

          {/* Aesthetic check-in */}
          <LogTile
            emoji="🪞"
            label="Aesthetic"
            meta={aestheticCount > 0 ? `${aestheticCount} check-in${aestheticCount === 1 ? "" : "s"} today` : "no check-in today"}
            expanded={expanded === "aesthetic"}
            onToggle={() => toggle("aesthetic")}
          >
            <div className="pt-2 space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {AESTHETIC_ANGLES.map((a) => (
                  <PillBtn key={a} on={aestheticAngle === a} onClick={() => setAestheticAngle(a)}>{a}</PillBtn>
                ))}
              </div>
              <div className="flex gap-1">
                {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                  <button key={n} onClick={() => setAestheticRating(n)} className="flex-1 py-1.5 rounded-md text-xs font-bold tabular-nums"
                    style={{
                      background: aestheticRating === n ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.05)",
                      color: aestheticRating === n ? "#fbbf24" : "#a1a1aa",
                      border: `1px solid ${aestheticRating === n ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.05)"}`,
                    }}>{n}</button>
                ))}
              </div>
              <textarea value={aestheticNotes} onChange={(e) => setAestheticNotes(e.target.value)} placeholder="notes — leaner, fuller, etc" rows={2} className="w-full px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none resize-none" />
              <button
                onClick={async () => {
                  if (aestheticRating == null) return;
                  setSaving("aesthetic"); haptic("light");
                  await aesthetic.logEntry({ angle: aestheticAngle, rating: aestheticRating, notes: aestheticNotes.trim() || null });
                  flashAlignment("aesthetic");
                  setAestheticRating(null); setAestheticNotes(""); setSaving(null); setSaved("aesthetic");
                  setTimeout(() => setSaved(null), 1500);
                }}
                disabled={aestheticRating == null}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-40"
                style={{ background: "rgba(251,191,36,0.25)", border: "1px solid rgba(251,191,36,0.25)" }}
              >
                {saving === "aesthetic" ? "..." : saved === "aesthetic" ? "✓ Logged" : "Log check-in"}
              </button>
            </div>
          </LogTile>

          {/* Money */}
          <LogTile
            emoji="💵"
            label="Money"
            meta={moneyDelta !== 0 ? `${moneyDelta >= 0 ? "+" : ""}$${moneyDelta.toFixed(2)} today` : "nothing logged"}
            expanded={expanded === "money"}
            onToggle={() => toggle("money")}
          >
            <div className="pt-2 space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {MONEY_KINDS.map((k) => (
                  <PillBtn key={k} on={moneyKind === k} onClick={() => setMoneyKind(k)}>{k.replace("_", " ")}</PillBtn>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm">$</span>
                <input type="number" step="0.01" value={moneyAmount} onChange={(e) => setMoneyAmount(e.target.value)} placeholder="amount" className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
                <input value={moneyCategory} onChange={(e) => setMoneyCategory(e.target.value)} placeholder="category" className="flex-1 px-3 py-1.5 rounded-lg text-sm bg-transparent text-white border border-zinc-700 focus:border-zinc-500 outline-none" />
              </div>
              <button
                onClick={async () => {
                  const a = parseFloat(moneyAmount);
                  if (!isFinite(a) || a <= 0) return;
                  setSaving("money"); haptic("light");
                  await money.logEntry({ amount: a, kind: moneyKind, category: moneyCategory.trim() || null });
                  setMoneyAmount(""); setMoneyCategory(""); setSaving(null); setSaved("money");
                  setTimeout(() => setSaved(null), 1500);
                }}
                className="w-full py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "rgba(34,197,94,0.25)", border: "1px solid rgba(34,197,94,0.25)" }}
              >
                {saving === "money" ? "..." : saved === "money" ? "✓ Logged" : "Log"}
              </button>
            </div>
          </LogTile>

          {/* ── REFLECTION ── */}
          <Section>Reflection</Section>

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

// Small section header to chunk the log surfaces (Body / Mind / Life /
// Reflection). Sticky-feeling separator between groups of tiles.
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-3 pb-1">
      <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-600 font-semibold">— {children}</span>
    </div>
  );
}

// Compact pill button for kind/category pickers inside log tiles.
function PillBtn({ children, on, onClick }: { children: React.ReactNode; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors"
      style={{
        background: on ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)",
        color: on ? "#fafafa" : "#a1a1aa",
        border: `1px solid ${on ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {children}
    </button>
  );
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
