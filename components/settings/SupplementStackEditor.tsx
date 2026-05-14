"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import { X, Plus } from "lucide-react";

type Category = "supplement" | "medication" | "injection" | "skincare" | "habit" | "exercise" | "meal";

type Stack = {
  id: string;
  name: string;
  dose: string | null;
  timing: string | null;
  category: Category;
  is_active: boolean;
  scheduled_at: string | null;   // "HH:MM:SS"
  duration_min: number | null;
};

const CATEGORY_LABEL: Record<Category, string> = {
  supplement: "Supplement",
  medication: "Medication",
  injection:  "Injection",
  skincare:   "Skincare",
  habit:      "Habit",
  exercise:   "Exercise",
  meal:       "Meal",
};

const TIMING_OPTIONS = ["Morning", "Pre-workout", "Lunch", "Afternoon", "Evening", "Pre-bed"];

// Drop the seconds component so the input bound to type="time" can accept it.
function timeForInput(t: string | null): string {
  return t ? t.slice(0, 5) : "";
}

function fmtScheduled(t: string | null, duration: number | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const tot = h * 60 + m;
  const fmt = (mins: number) => {
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    const period = hh >= 12 ? "PM" : "AM";
    const hh12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${hh12}:${String(mm).padStart(2, "0")} ${period}`;
  };
  if (!duration || duration <= 0) return fmt(tot);
  return `${fmt(tot).replace(/ (AM|PM)$/, "")} – ${fmt(tot + duration)}`;
}

export default function SupplementStackEditor() {
  const supabase = createClient();
  const [items, setItems]   = useState<Stack[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [name, setName]       = useState("");
  const [dose, setDose]       = useState("");
  const [timing, setTiming]   = useState("Morning");
  const [category, setCategory] = useState<Category>("supplement");
  const [scheduledAt, setScheduledAt] = useState<string>("");      // "HH:MM"
  const [durationMin, setDurationMin] = useState<string>("");      // free text → parsed
  const [userId, setUserId]   = useState<string | null>(null);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase
      .from("supplement_stack")
      .select("id, name, dose, timing, category, is_active, scheduled_at, duration_min")
      .eq("user_id", user.id)
      .order("sort_order");
    setItems((data ?? []) as Stack[]);
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function addItem() {
    if (!userId || !name.trim()) return;
    setAdding(true);
    const parsedDuration = durationMin ? Math.max(0, parseInt(durationMin, 10)) : null;
    await supabase.from("supplement_stack").insert({
      user_id: userId,
      name: name.trim(),
      dose: dose.trim() || null,
      timing,
      category,
      scheduled_at: scheduledAt || null,
      duration_min: parsedDuration && !Number.isNaN(parsedDuration) ? parsedDuration : null,
      is_active: true,
      sort_order: items.length,
    });
    setName(""); setDose(""); setScheduledAt(""); setDurationMin("");
    setAdding(false);
    await load();
  }

  async function updateTime(id: string, scheduled_at: string | null) {
    await supabase.from("supplement_stack").update({ scheduled_at }).eq("id", id);
    await load();
  }

  async function updateDuration(id: string, duration_min: number | null) {
    await supabase.from("supplement_stack").update({ duration_min }).eq("id", id);
    await load();
  }

  async function archive(id: string) {
    await supabase.from("supplement_stack").update({ is_active: false }).eq("id", id);
    await load();
  }

  if (loading) return null;

  return (
    <Card>
      <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-4">— Routine items (supplements / meds / habits / exercise / meals)</span>

      {items.length === 0 ? (
        <p className="text-xs text-zinc-500 mb-4">No routine items yet. Add one below.</p>
      ) : (
        <div className="space-y-1.5 mb-4">
          {items.map((s) => (
            <div
              key={s.id}
              className={`flex flex-col gap-1.5 py-2 px-3 rounded-xl ${s.is_active ? "bg-zinc-800/50" : "bg-zinc-900 opacity-50"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 truncate">{s.name}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    <span className="text-zinc-400">{CATEGORY_LABEL[s.category ?? "supplement"]}</span>
                    {s.dose && <span> · {s.dose}</span>}
                    {s.timing && <span> · {s.timing}</span>}
                    {s.scheduled_at && <span> · {fmtScheduled(s.scheduled_at, s.duration_min)}</span>}
                    {!s.is_active && <span> · archived</span>}
                  </p>
                </div>
                {s.is_active && (
                  <button
                    onClick={() => archive(s.id)}
                    className="ml-3 text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {s.is_active && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={timeForInput(s.scheduled_at)}
                    onChange={(e) => updateTime(s.id, e.target.value || null)}
                    className="bg-zinc-900 text-zinc-200 rounded-md px-2 py-1 text-[11px] outline-none border border-zinc-800 focus:border-zinc-700"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="duration (min)"
                    value={s.duration_min ?? ""}
                    onChange={(e) => updateDuration(s.id, e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-32 bg-zinc-900 text-zinc-200 rounded-md px-2 py-1 text-[11px] outline-none border border-zinc-800 focus:border-zinc-700"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 pt-3 border-t border-zinc-800">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">Add routine item</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Magnesium Glycinate, Morning sunlight, Yoga)"
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
        />
        <input
          value={dose}
          onChange={(e) => setDose(e.target.value)}
          placeholder="Dose / detail (e.g. 400mg, 10 min, optional)"
          className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
        />
        <div>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Category</span>
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  category === c ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Bucket (fallback if no specific time)</span>
          <div className="flex gap-1.5 flex-wrap">
            {TIMING_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTiming(t)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  timing === t ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Scheduled time (optional)</span>
            <input
              type="time"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </div>
          <div className="flex-1">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Duration (min)</span>
            <input
              type="number"
              min={0}
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </div>
        </div>
        <button
          onClick={addItem}
          disabled={adding || !name.trim()}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded-xl text-sm font-semibold text-zinc-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <Plus size={14} />
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
    </Card>
  );
}
