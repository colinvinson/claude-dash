"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles } from "lucide-react";
import type { StackCategory, CreateItemArgs } from "@/hooks/useStack";

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
  const [time, setTime]         = useState("");           // "HH:MM"
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState<StackCategory>("habit");
  const [recurrence, setRecurrence] = useState<Recurrence>("daily");
  const [specificDays, setSpecificDays] = useState<number[]>([]);
  const [classifying, setClassifying] = useState(false);
  const [classification, setClassification] = useState<Classification | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const classifyTimer = useRef<NodeJS.Timeout | null>(null);

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
        // Apply suggestions only if the user hasn't already edited those fields
        setCategory((prev) => (prev === "habit" ? c.category : prev));
        if (c.suggested_time && !time) setTime(c.suggested_time);
        if (c.duration_min != null && !duration) setDuration(String(c.duration_min));
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
      timing: classification?.timing_bucket ?? "Morning",
      category,
      scheduled_at: time || null,
      duration_min: parsedDuration && !Number.isNaN(parsedDuration) ? parsedDuration : null,
      days_of_week: days,
    });
    setSubmitting(false);
    if (id) {
      // Reset + close
      setName(""); setDose(""); setTime(""); setDuration("");
      setCategory("habit"); setRecurrence("daily"); setSpecificDays([]);
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
            placeholder="Morning sunlight, Yoga, Magnesium, …"
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

        {/* Time + Duration */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <label>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </label>
          <label>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Duration (min)</span>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="0"
              className="w-full bg-zinc-900 text-zinc-100 rounded-xl px-3 py-2.5 text-sm outline-none border border-zinc-800 focus:border-zinc-700"
            />
          </label>
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
