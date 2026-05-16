"use client";

import { useState, useEffect, useRef } from "react";
import { X, Sparkles, Trash2 } from "lucide-react";
import type { StackCategory, CreateItemArgs, StackItem } from "@/hooks/useStack";
import { useLongTermGoals } from "@/hooks/useLongTermGoals";
import { FormInput, FormTextarea, FormSelect } from "@/components/ui/FormInput";
import FormLabel from "@/components/ui/FormLabel";
import { ICON } from "@/lib/design-tokens";

type Classification = {
  category: StackCategory;
  duration_min: number | null;
  timing_bucket: string;
  suggested_time: string | null;
  notes: string | null;
  icon: string | null;     // lucide name from the curated set; resolveItemStyle uses this directly
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

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (args: CreateItemArgs) => Promise<string | null>;
  // Edit-mode additions. When `existingItem` is set, the sheet switches from
  // "Add to Schedule" to "Edit routine item" — fields pre-populate, submit
  // routes to onUpdate, and an Archive button appears.
  existingItem?: StackItem | null;
  onUpdate?: (id: string, patch: Partial<CreateItemArgs>) => Promise<boolean>;
  onArchive?: (id: string) => Promise<boolean>;
};

export default function AddScheduleItem({
  open,
  onClose,
  onCreate,
  existingItem,
  onUpdate,
  onArchive,
}: Props) {
  const isEdit = !!existingItem;
  const [name, setName]         = useState("");
  const [dose, setDose]         = useState("");
  const [notes, setNotes]       = useState("");
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

  // When edit mode opens (or the target item changes), seed every input from
  // the existing item. Resets on close are handled in the existing flow.
  useEffect(() => {
    if (!open) return;
    if (existingItem) {
      setName(existingItem.name);
      setDose(existingItem.dose ?? "");
      setNotes(existingItem.notes ?? "");
      setBucket(existingItem.timing ?? "");
      setTime(existingItem.scheduled_at ? existingItem.scheduled_at.slice(0, 5) : "");
      setDuration(existingItem.duration_min != null ? String(existingItem.duration_min) : "");
      setCategory((existingItem.category as StackCategory) ?? "habit");
      setLinkedGoalId(existingItem.linked_goal_id ?? "");
      // Recurrence reverse-mapping
      const dow = existingItem.days_of_week;
      if (!dow || dow.length === 0 || dow.length === 7) {
        setRecurrence("daily"); setSpecificDays([]);
      } else if (dow.length === 5 && [1,2,3,4,5].every((d) => dow.includes(d))) {
        setRecurrence("weekdays"); setSpecificDays([]);
      } else if (dow.length === 2 && [0,6].every((d) => dow.includes(d))) {
        setRecurrence("weekends"); setSpecificDays([]);
      } else {
        setRecurrence("specific"); setSpecificDays([...dow]);
      }
      setClassification(null);
    }
  }, [open, existingItem]);

  // Auto-classify ~600ms after the user stops typing the name. Skipped in
  // edit mode — no point re-classifying an item the user already curated.
  useEffect(() => {
    if (classifyTimer.current) clearTimeout(classifyTimer.current);
    if (isEdit) return;
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
    const payload: CreateItemArgs = {
      name: name.trim(),
      dose: dose.trim(),
      // Notes are now manual — only what Sir typed. The classifier's note
      // suggestion is offered as a tap-to-apply chip but never silently
      // overrides the field.
      notes: notes.trim() || undefined,
      // Bucket and specific time are INDEPENDENT. Both optional. If both null,
      // the item lands in "Anytime today" on the Schedule timeline.
      timing: bucket || undefined,
      category,
      scheduled_at: time || null,
      duration_min: parsedDuration && !Number.isNaN(parsedDuration) ? parsedDuration : null,
      days_of_week: days,
      linked_goal_id: linkedGoalId || null,
      // Icon: only set on creation (classifier suggestion). Edits don't
      // re-classify, so existing icon is preserved.
      icon: isEdit ? undefined : (classification?.icon ?? undefined),
    };

    let ok: boolean;
    if (isEdit && existingItem && onUpdate) {
      ok = await onUpdate(existingItem.id, payload);
    } else {
      ok = !!(await onCreate(payload));
    }
    setSubmitting(false);
    if (ok) {
      setName(""); setDose(""); setNotes(""); setBucket(""); setTime(""); setDuration("");
      setCategory("habit"); setRecurrence("daily"); setSpecificDays([]);
      setLinkedGoalId("");
      setClassification(null);
      onClose();
    }
  }

  async function archive() {
    if (!existingItem || !onArchive) return;
    if (!confirm(`Archive "${existingItem.name}"? It stops appearing on the schedule but historical logs are kept.`)) return;
    setSubmitting(true);
    const ok = await onArchive(existingItem.id);
    setSubmitting(false);
    if (ok) onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-zinc-950 border-t border-zinc-800 rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto anim-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-zinc-100">{isEdit ? "Edit routine item" : "Add to Schedule"}</h2>
          <button onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-200 -m-2 p-2"><X size={ICON.md} /></button>
        </div>

        {/* Name */}
        <div className="mb-3">
          <FormLabel>Name</FormLabel>
          <FormInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Morning sunlight, Yoga, …"
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
            </p>
          )}
        </div>

        {/* Dose / detail */}
        <div className="mb-3">
          <FormLabel optional>Dose / detail</FormLabel>
          <FormInput
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="400mg, 30 min, …"
          />
        </div>

        {/* Notes — fully manual. The classifier's suggestion appears as a
            tap-to-apply chip below; it never auto-fills this field. */}
        <div className="mb-1">
          <FormLabel optional>Notes</FormLabel>
          <FormTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="empty stomach, 10 min before food, only on lift days…"
            rows={2}
          />
        </div>
        {classification?.notes && classification.notes.trim() !== notes.trim() && !classifying && (
          <button
            onClick={() => setNotes(classification.notes!)}
            className="mb-3 w-full text-[10px] text-left px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors text-zinc-400"
          >
            <Sparkles size={9} className="inline mr-1" />
            Suggestion: {classification.notes}
            <span className="text-zinc-600"> · tap to use</span>
          </button>
        )}
        {!classification?.notes && <div className="mb-3" />}

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
            {["Morning", "Day", "Night", "Anytime"].map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBucket((prev) => prev === b ? "" : b);
                  // Picking "Anytime" is incompatible with a specific clock
                  // time — clear it so the item lands cleanly in the Anytime cluster.
                  if (b === "Anytime") setTime("");
                }}
                className={`flex-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                  bucket === b ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel optional>Specific time</FormLabel>
              <FormInput type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <FormLabel optional>Duration</FormLabel>
              <FormInput type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="min" />
            </div>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1.5">
            {bucket === "Anytime"   && `Lands in the "Anytime today" cluster — no clock time.`}
            {bucket && bucket !== "Anytime" && !time && `Will render at ${bucket === "Morning" ? "~7am" : bucket === "Day" ? "~1pm" : "~9pm"}.`}
            {!bucket && !time && `No clock time set → "Anytime today" cluster below the timeline.`}
            {time && `At ${time}${bucket && bucket !== "Anytime" ? ` (${bucket})` : ""}.`}
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
            <FormLabel optional>Link to a goal</FormLabel>
            <FormSelect value={linkedGoalId} onChange={(e) => setLinkedGoalId(e.target.value)}>
              <option value="">— not linked —</option>
              {allGoals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.bucket === "business" ? "Biz" : "Life"} · {g.title}
                </option>
              ))}
            </FormSelect>
          </div>
        )}

        <button
          onClick={submit}
          disabled={!name.trim() || submitting}
          className="w-full py-2.5 bg-white text-zinc-900 disabled:opacity-40 rounded-xl text-sm font-semibold transition-opacity"
        >
          {submitting ? (isEdit ? "Saving…" : "Adding…") : (isEdit ? "Save changes" : "Add to Schedule")}
        </button>

        {/* Archive — edit mode only. Keeps historical logs; hides from schedule. */}
        {isEdit && (
          <button
            onClick={archive}
            disabled={submitting}
            className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 text-zinc-500 hover:text-red-400 text-xs font-medium transition-colors disabled:opacity-40"
          >
            <Trash2 size={12} /> Archive this item
          </button>
        )}
      </div>
    </div>
  );
}
