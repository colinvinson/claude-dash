"use client";

import { useMemo } from "react";
import type { StackItem } from "@/hooks/useStack";
import type { StackInsight } from "@/hooks/useStackInsights";
import {
  Pill, Beaker, Syringe, Sparkles, Sun, Activity, Utensils, Clock, Repeat, Flame,
  type LucideIcon,
} from "lucide-react";

// Section grouping (Morning / Day / Night / Anytime) drives the visual
// structure. Each item lands in a section based on:
//   1. its scheduled_at clock time, if set; otherwise
//   2. its `timing` bucket string, if recognized; otherwise
//   3. Anytime.
//
// Rows display the SPECIFIC clock time only when scheduled_at is set. A row
// in (e.g.) the Morning section with no scheduled_at just shows the item name
// — no fake 7am label.

// ────────────────────────────────────────────────────────────────────────
// Visual config
// ────────────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, { Icon: LucideIcon; color: string }> = {
  supplement: { Icon: Pill,     color: "#fb923c" },
  medication: { Icon: Beaker,   color: "#60a5fa" },
  injection:  { Icon: Syringe,  color: "#a78bfa" },
  skincare:   { Icon: Sparkles, color: "#f472b6" },
  habit:      { Icon: Sun,      color: "#818cf8" },
  exercise:   { Icon: Activity, color: "#f87171" },
  meal:       { Icon: Utensils, color: "#4ade80" },
};
const DEFAULT_STYLE = { Icon: Clock, color: "#a1a1aa" };

function styleFor(item: StackItem) {
  const fromCategory = CATEGORY_STYLE[item.category as string] ?? DEFAULT_STYLE;
  return { Icon: fromCategory.Icon, color: item.color ?? fromCategory.color };
}

// ────────────────────────────────────────────────────────────────────────
// Time + bucket helpers
// ────────────────────────────────────────────────────────────────────────

type Section = "morning" | "day" | "night" | "anytime";

// Maps a `timing` string (free-form, from the classifier or stack editor) to
// the Morning / Day / Night sections. Anything unrecognized → null (caller
// falls back to Anytime).
const TIMING_TO_SECTION: Record<string, Section> = {
  "pre-workout": "morning",
  "morning":     "morning",
  "day":         "day",
  "lunch":       "day",
  "afternoon":   "day",
  "evening":     "night",
  "night":       "night",
  "pre-bed":     "night",
  "bedtime":     "night",
};

// HH:MM (24h) → Section by hour. <12 morning, 12-17 day, 18+ night.
function sectionFromTime(hhmm: string): Section {
  const h = parseInt(hhmm.split(":")[0], 10);
  if (isNaN(h)) return "anytime";
  if (h < 12)  return "morning";
  if (h < 18)  return "day";
  return "night";
}

function sectionFor(item: StackItem): Section {
  if (item.scheduled_at) return sectionFromTime(item.scheduled_at.slice(0, 5));
  const key = (item.timing ?? "").trim().toLowerCase();
  return TIMING_TO_SECTION[key] ?? "anytime";
}

// Sort key WITHIN a section. Items with a specific clock time sort earliest
// to latest by clock; bucket-only items sort last (by sort_order).
function sortKey(item: StackItem): string {
  if (item.scheduled_at) return `0_${item.scheduled_at}`;
  return `1_${String(item.sort_order).padStart(6, "0")}`;
}

function formatTimeRange(start: string, durationMin: number | null): string {
  const [h, m] = start.split(":").map(Number);
  const startTotal = h * 60 + m;
  const fmt = (mins: number) => {
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    const period = hh >= 12 ? "PM" : "AM";
    const hh12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${hh12}:${String(mm).padStart(2, "0")} ${period}`;
  };
  if (!durationMin || durationMin <= 0) return fmt(startTotal);
  return `${fmt(startTotal).replace(/ (AM|PM)$/, "")} – ${fmt(startTotal + durationMin)} (${durationMin} min)`;
}

// ────────────────────────────────────────────────────────────────────────
// Row component (shared across all sections)
// ────────────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  insight,
  onToggle,
  onEdit,
}: {
  item: StackItem;
  insight?: StackInsight;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const { Icon, color } = styleFor(item);
  const circleStyle = {
    background: `${color}22`,
    border: `1px solid ${color}55`,
  };
  const checkboxStyle = item.taken
    ? { background: color, borderColor: color }
    : { borderColor: color };

  // Only render a time/range if the user actually set a specific clock time.
  // Bucket-only items have no clock display — section header carries the context.
  const timeLabel = item.scheduled_at
    ? formatTimeRange(item.scheduled_at.slice(0, 5), item.duration_min)
    : null;

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#1f1f1f]/60 last:border-0 group">
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={circleStyle}>
        <Icon size={16} style={{ color }} />
      </div>

      <button onClick={onEdit} className="flex-1 min-w-0 text-left" aria-label="Edit item">
        {/* meta line: only renders when there's something to show */}
        {(timeLabel || (insight && insight.streak >= 2) || (insight && insight.expected7d > 0)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {timeLabel && (
              <>
                <span className="text-[11px] text-zinc-500 tabular-nums">{timeLabel}</span>
                <Repeat size={11} className="text-zinc-600" />
              </>
            )}
            {insight && insight.streak >= 2 && (
              <span
                className={`flex items-center gap-0.5 text-[10px] tabular-nums ${
                  insight.streak >= insight.longestStreak && insight.streak >= 7
                    ? "text-amber-300"
                    : "text-orange-400"
                }`}
                title={insight.longestStreak > insight.streak
                  ? `Best ever: ${insight.longestStreak}d · logged ${insight.totalLogged}× since ${insight.firstLoggedDate ?? "?"}`
                  : `All-time best · logged ${insight.totalLogged}× since ${insight.firstLoggedDate ?? "?"}`}
              >
                <Flame size={10} /> {insight.streak}
                {insight.longestStreak > insight.streak && <span className="text-zinc-600"> / {insight.longestStreak}</span>}
              </span>
            )}
            {insight && insight.expected7d > 0 && (
              <span className="text-[10px] text-zinc-600 tabular-nums">{insight.done7d}/{insight.expected7d} this wk</span>
            )}
          </div>
        )}
        <div className={`text-sm font-semibold mt-0.5 truncate ${item.taken ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
          {item.name}
        </div>
        {item.dose && <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{item.dose}</div>}
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        aria-label={item.taken ? "Mark not done" : "Mark done"}
        className="flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all"
        style={checkboxStyle}
      >
        {item.taken && (
          <svg viewBox="0 0 10 8" className="w-3 h-2.5" fill="none" stroke="white" strokeWidth="2">
            <path d="M1 4l2.5 2.5L9 1" />
          </svg>
        )}
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Top-level component
// ────────────────────────────────────────────────────────────────────────

const SECTION_META: Array<{ key: Section; label: string }> = [
  { key: "morning", label: "Morning" },
  { key: "day",     label: "Day" },
  { key: "night",   label: "Night" },
  { key: "anytime", label: "Anytime" },
];

export default function TimelineSchedule({
  items,
  insights,
  onToggle,
  onEdit,
}: {
  items: StackItem[];
  insights?: Record<string, StackInsight>;
  onToggle: (id: string, taken: boolean, logId: string | null) => void;
  onEdit?: (item: StackItem) => void;
}) {
  const grouped = useMemo(() => {
    const buckets: Record<Section, StackItem[]> = {
      morning: [], day: [], night: [], anytime: [],
    };
    for (const item of items) buckets[sectionFor(item)].push(item);
    for (const k of Object.keys(buckets) as Section[]) {
      buckets[k].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    }
    return buckets;
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-6 text-center">
        No items yet. Tap + Add to start.
      </p>
    );
  }

  return (
    <div className="flex flex-col">
      {SECTION_META.map(({ key, label }, sectionIdx) => {
        const sectionItems = grouped[key];
        if (sectionItems.length === 0) return null;
        const doneInSection = sectionItems.filter((i) => i.taken).length;
        return (
          <div key={key} className={sectionIdx > 0 ? "mt-5" : ""}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500">— {label}</span>
              <span className="text-[10px] text-zinc-600 tabular-nums">
                {doneInSection}/{sectionItems.length}
              </span>
            </div>
            {sectionItems.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                insight={insights?.[item.id]}
                onToggle={() => onToggle(item.id, item.taken, item.log_id)}
                onEdit={onEdit ? () => onEdit(item) : undefined}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}
