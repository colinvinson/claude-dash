"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
import type { StackCategory, CreateItemArgs } from "@/hooks/useStack";
import { useLongTermGoals } from "@/hooks/useLongTermGoals";

type Classification = {
  category: StackCategory;
  duration_min: number | null;
  timing_bucket: string;
  suggested_time: string | null;
  notes: string | null;
};

const CATEGORIES: { id: StackCategory; label: string }[] = [
  { id: "supplement", label: "Supplement" },
  { id: "medication", label: "Medication" },
  { id: "injection",  label: "Injection" },
  { id: "skincare",   label: "Skincare" },
  { id: "habit",      label: "Habit" },
  { id: "exercise",   label: "Exercise" },
  { id: "meal",       label: "Meal" },
];

// JS day-of-week indices: Sunday=0..Saturday=6
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type Recurrence = "daily" | "weekdays" | "weekends" | "specific";

function recurrenceToDays(r: Recurrence, specific: number[]): number[] | null {
  if (r === "daily") return null;
  if (r === "weekdays") return [1, 2, 3, 4, 5];
  if (r === "weekends") return [0, 6];
  return specific.length === 0 ? null : [...specific].sort();
}

export default function AddScheduleItem({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (args: CreateItemArgs) => Promise<string | null>;
}) {
  const [name, setName]         = useState("");
  const [dose, setDose]         = useState("");
  const [bucket, setBucket]     = useState<string>("");   // "Morning" | "Day" | "Night" | ""
  const [time, setTime]         = useState("");           // "HH:MM" — optional, independent of bucket
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState<StackCategory>("habit");
  const [recurrence, setRecurrence] = useState<Recurrence>("daily");
  const [specificDays, setSpecificDays] = useState<number[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [linkedGoalId, setLinkedGoalId] = useState<string>("");
  const classifyTimer = useRef<NodeJS.Timeout | null>(null);
  const { goals: allGoals } = useLongTermGoals();

  // Auto-classify ~600ms after the user stops typing the name.
  useEffect(() => {
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    if (!name.trim() || name.trim().length < 3) {
      setClassification(null);
      return;
    }
    classifyTimer.current = setTimeout(async () => {
      setClassifying(true);
      try {
        const res = await fetch("/api/jarvis/classify-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() }),
        });
        if (!res.ok) return;
        const c = (await res.json()) as Classification;
        setClassification(c);
        // Apply CATEGORY + BUCKET suggestions silently (only if still unset).
        setCategory((prev) => (prev === "habit" ? c.category : prev));
        setBucket((prev) => prev || (c.timing_bucket && /^(Morning|Pre-workout|Lunch|Afternoon|Day|Evening|Pre-bed|Night)$/.test(c.timing_bucket) ? c.timing_bucket : prev));
        // Specific time + duration are NOT auto-filled — they surface as a
        // tap-to-apply chip below the inputs so Sir keeps explicit control.
      } finally {
        setClassifying(false);
      }
    }, 600);
    return () => { if (classifyTimer.current) clearTimeout(classifyTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  function toggleDay(d: number) {
    setRecurrence("specific");
    setSpecificDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  async function submit() {
    if (!name.trim()) return;
    setSubmitting(true);
    const days = recurrenceToDays(recurrence, specificDays);
    const parsedDuration = duration ? parseInt(duration, 10) : null;
    const id = await onCreate({
      name: name.trim(),
      dose: dose.trim(),
      notes: classification?.notes ?? undefined,
      // Bucket and specific time are INDEPENDENT. Both optional. If both null,
      // the item lands in "Anytime today" on the Schedule timeline.
      timing: bucket || undefined,
      category,
      scheduled_at: time || null,
      duration_min: parsedDuration && !Number.isNaN(parsedDuration) ? parsedDuration : null,
      days_of_week: days,
      linked_goal_id: linkedGoalId || null,
    });
    setSubmitting(false);
    if (id) {
      setName(""); setDose(""); setBucket(""); setTime(""); setDuration("");
      setCategory("habit"); setRecurrence("daily"); setSpecificDays([]);
      setLinkedGoalId("");
      setClassification(null);
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">Add to Schedule</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200"><X size={18} /></button>
        </div>

        {/* Name */}
        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning sunlight, Yoga, …"
            className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            autoFocus
          />
          {classifying && (
            <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <Sparkles size={10} /> Jarvis is recognizing this…
            </p>
          )}
          {classification && !classifying && (
            <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
              <Sparkles size={10} /> Recognized as <span className="text-zinc-300 capitalize">{classification.category}</span>
              {classification.notes && <span className="text-zinc-600">· {classification.notes}</span>}
            </p>
          )}
        </label>

        {/* Dose / detail */}
        <label className="block mb-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Dose / detail (optional)</span>
          <input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="400mg, 30 min, …"
            className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
          />
        </label>

        {/* Category */}
        <div className="mb-3">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block">Category</span>
          <div className="flex gap-1.5 flex-wrap">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategory(c.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  category === c.id ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* When — bucket and specific time are INDEPENDENT, BOTH OPTIONAL.
              - Tap Morning/Day/Night → item lives in that part of the day
                (renders on the timeline at a soft fallback time of 07/13/21).
              - Type a specific clock time → renders at exactly that time.
              - Set both → specific time wins for placement; bucket is a hint.
              - Set neither → "Anytime today" section below the timeline. */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">When (optional)</span>
            {(bucket || time) && (
              <button
                onClick={() => { setBucket(""); setTime(""); }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {/* Bucket pills — set the part of day, do NOT touch specific time. */}
          <div className="flex gap-1.5 mb-2">
            {["Morning", "Day", "Night"].map((b) => (
              <button
                key={b}
                onClick={() => setBucket((prev) => prev === b ? "" : b)}
                className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  bucket === b ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Specific time (optional)</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
              />
            </label>
            <label>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Duration (optional)</span>
              <input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="min"
                className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
              />
            </label>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5">
            {bucket && !time && `Will render at ${bucket === "Morning" ? "~7am" : bucket === "Day" ? "~1pm" : "~9pm"}. Skip both for "anytime today".`}
            {!bucket && !time && `No clock time set → "Anytime today" cluster below the timeline.`}
            {time && `At ${time}${bucket ? ` (${bucket})` : ""}.`}
          </p>
          {/* Jarvis classifier suggestion chip — tap to apply, never auto-fills */}
          {classification && (classification.suggested_time || classification.duration_min != null) && !time && (
            <button
              onClick={() => {
                if (classification.suggested_time) setTime(classification.suggested_time);
                if (classification.duration_min != null) setDuration(String(classification.duration_min));
              }}
              className="mt-2 w-full text-[10px] text-left px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-400"
            >
              <Sparkles size={9} className="inline mr-1" />
              Suggestion: specific time {classification.suggested_time ?? "—"}
              {classification.duration_min != null && ` · ${classification.duration_min} min`}
              <span className="text-zinc-600"> · tap to apply</span>
            </button>
          )}
        </div>

        {/* Recurrence */}
        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block">Repeats</span>
          <div className="flex gap-1.5 flex-wrap mb-2">
            {(["daily", "weekdays", "weekends", "specific"] as Recurrence[]).map((r) => (
              <button
                key={r}
                onClick={() => setRecurrence(r)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                  recurrence === r ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {r === "daily" ? "Every day"
                 : r === "weekdays" ? "Weekdays"
                 : r === "weekends" ? "Weekends"
                 : "Specific days"}
              </button>
            ))}
          </div>
          {recurrence === "specific" && (
            <div className="flex gap-1">
              {DAY_LABELS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(i)}
                  className={`w-9 h-9 rounded-full text-[12px] font-semibold transition-colors ${
                    specificDays.includes(i)
                      ? "bg-white text-zinc-900"
                      : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Optional goal linkage — surfaces this item under its parent goal in /goals. */}
        {allGoals.length > 0 && (
          <div className="mb-4">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block">Link to a goal (optional)</span>
            <select
              value={linkedGoalId}
              onChange={(e) => setLinkedGoalId(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            >
              <option value="">— not linked —</option>
              {allGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.bucket === "business" ? "Biz" : "Life"} · {g.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          className="w-full py-2.5 bg-white text-zinc-900 disabled:opacity-40 rounded-xl text-sm font-semibold transition-opacity"
        >
          {submitting ? "Adding…" : "Add to Schedule"}
        </button>
      </div>
    </div>
  );
}
