"use client";

import { useMemo } from "react";
import type { StackItem } from "@/hooks/useStack";
import type { StackInsight } from "@/hooks/useStackInsights";
import {
  Pill, Beaker, Syringe, Sparkles, Sun, Activity, Utensils, Clock, Repeat, Flame,
  type LucideIcon,
} from "lucide-react";

// Per-category visual defaults. Items can override icon + color individually.
const CATEGORY_STYLE: Record<string, { Icon: LucideIcon; color: string }> = {
  supplement: { Icon: Pill,     color: "#fb923c" }, // orange
  medication: { Icon: Beaker,   color: "#60a5fa" }, // blue
  injection:  { Icon: Syringe,  color: "#a78bfa" }, // purple
  skincare:   { Icon: Sparkles, color: "#f472b6" }, // pink
  habit:      { Icon: Sun,      color: "#818cf8" }, // indigo
  exercise:   { Icon: Activity, color: "#f87171" }, // red
  meal:       { Icon: Utensils, color: "#4ade80" }, // green
};

const DEFAULT_STYLE = { Icon: Clock, color: "#a1a1aa" };

// Map fallback bucket strings to canonical clock times so items WITHOUT a
// specific scheduled_at still sort in a sensible order. Keep both the
// simple add-sheet labels (Morning / Day / Night) and the granular ones
// the AI classifier emits (Pre-workout / Lunch / Afternoon / Evening / Pre-bed).
const BUCKET_FALLBACK_TIME: Record<string, string> = {
  "pre-workout": "06:30",
  "morning":     "07:00",
  "day":         "13:00",
  "lunch":       "12:00",
  "afternoon":   "15:00",
  "evening":     "19:00",
  "night":       "21:00",
  "pre-bed":     "22:00",
  "bedtime":     "22:30",
};

// Returns "HH:MM" when the item has any time anchor (specific clock time OR a
// recognized timing bucket). Returns null when the item is truly untimed —
// those render in the "Anytime" section below the timeline.
function effectiveTime(item: StackItem): string | null {
  if (item.scheduled_at) return item.scheduled_at.slice(0, 5);
  const key = (item.timing ?? "").trim().toLowerCase();
  if (key && BUCKET_FALLBACK_TIME[key]) return BUCKET_FALLBACK_TIME[key];
  return null;
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

function styleFor(item: StackItem) {
  const fromCategory = CATEGORY_STYLE[item.category as string] ?? DEFAULT_STYLE;
  // TODO: resolve item.icon string → Lucide component if we want per-item icon overrides
  return {
    Icon: fromCategory.Icon,
    color: item.color ?? fromCategory.color,
  };
}

function TimeGutter({ time }: { time: string }) {
  // Display the raw "HH:MM" — caller decides whether to dedupe identical
  // consecutive times. We render it tabular so columns align.
  return (
    <div className="w-12 flex-shrink-0 text-right pr-3 pt-5 text-[11px] text-zinc-500 tabular-nums leading-none">
      {time}
    </div>
  );
}

function TimelineRow({
  item,
  insight,
  showGutterTime,
  isFirst,
  isLast,
  onToggle,
  onEdit,
}: {
  item: StackItem;
  insight?: StackInsight;
  showGutterTime: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
  onEdit?: () => void;
}) {
  const start = effectiveTime(item) ?? "12:00";  // TimelineRow only called for timed items
  const range = formatTimeRange(start, item.duration_min);
  const { Icon, color } = styleFor(item);
  const recurring = true; // every supplement_stack item is recurring daily by definition

  // Use a translucent fill of the category color for the circle. The icon
  // sits centered with full opacity. Checkbox border picks up the same color.
  const circleStyle = {
    background: `${color}22`, // alpha ~13%
    border: `1px solid ${color}55`,
  };
  const checkboxStyle = item.taken
    ? { background: color, borderColor: color }
    : { borderColor: color };

  return (
    <div className="flex items-stretch gap-0 group">
      {showGutterTime
        ? <TimeGutter time={start} />
        : <div className="w-12 flex-shrink-0" />}

      {/* Vertical connector + circle */}
      <div className="relative flex-shrink-0 w-14 flex flex-col items-center">
        {/* Top half of the connector — hidden on first row */}
        <div className={`w-px flex-1 ${isFirst ? "bg-transparent" : "bg-zinc-800"}`} />
        {/* Circle with icon */}
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center my-1"
          style={circleStyle}
        >
          <Icon size={20} style={{ color }} />
        </div>
        {/* Bottom half */}
        <div className={`w-px flex-1 ${isLast ? "bg-transparent" : "bg-zinc-800"}`} />
      </div>

      {/* Content + checkbox */}
      <div className="flex-1 min-w-0 flex items-center gap-2 py-3 pl-2">
        {/* Tapping the content area opens the edit sheet; the checkbox
            (below) uses stopPropagation so it stays a toggle. */}
        <button
          onClick={onEdit}
          className="flex-1 min-w-0 text-left"
          aria-label="Edit item"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-zinc-500 tabular-nums">{range}</span>
            {recurring && <Repeat size={11} className="text-zinc-600" />}
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
                {insight.longestStreak > insight.streak && (
                  <span className="text-zinc-600"> / {insight.longestStreak}</span>
                )}
              </span>
            )}
            {insight && insight.expected7d > 0 && (
              <span className="text-[10px] text-zinc-600 tabular-nums">
                · {insight.done7d}/{insight.expected7d} this wk
              </span>
            )}
          </div>
          <div className={`text-sm font-semibold mt-0.5 truncate ${item.taken ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
            {item.name}
          </div>
          {item.dose && (
            <div className="text-[11px] text-zinc-500 mt-0.5 truncate">{item.dose}</div>
          )}
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
    </div>
  );
}

function UntimedRow({
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
  const circleStyle = { background: `${color}22`, border: `1px solid ${color}55` };
  const checkboxStyle = item.taken
    ? { background: color, borderColor: color }
    : { borderColor: color };

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#1f1f1f]/60 last:border-0 group">
      <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center" style={circleStyle}>
        <Icon size={15} style={{ color }} />
      </div>
      <button
        onClick={onEdit}
        className="flex-1 min-w-0 text-left"
        aria-label="Edit item"
      >
        <div className="flex items-center gap-1.5">
          {insight && insight.streak >= 2 && (
            <span className="flex items-center gap-0.5 text-[10px] text-orange-400 tabular-nums">
              <Flame size={10} /> {insight.streak}
              {insight.longestStreak > insight.streak && <span className="text-zinc-600"> / {insight.longestStreak}</span>}
            </span>
          )}
          {insight && insight.expected7d > 0 && (
            <span className="text-[10px] text-zinc-600 tabular-nums">{insight.done7d}/{insight.expected7d} this wk</span>
          )}
        </div>
        <div className={`text-sm font-semibold truncate ${item.taken ? "text-zinc-500 line-through" : "text-zinc-100"}`}>
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
  // Split: items with an effective time render on the timeline; items with no
  // time anchor at all render in a flat "Anytime" cluster below.
  const { timed, untimed } = useMemo(() => {
    const timed: Array<{ item: StackItem; t: string }>   = [];
    const untimed: StackItem[]                            = [];
    for (const item of items) {
      const t = effectiveTime(item);
      if (t) timed.push({ item, t });
      else   untimed.push(item);
    }
    timed.sort((a, b) => a.t !== b.t ? a.t.localeCompare(b.t) : a.item.sort_order - b.item.sort_order);
    untimed.sort((a, b) => a.sort_order - b.sort_order);
    return { timed, untimed };
  }, [items]);

  if (timed.length === 0 && untimed.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-6 text-center">
        No items yet. Tap + Add to start.
      </p>
    );
  }

  // Dedupe identical consecutive times in the gutter so it doesn't look noisy.
  let prevTime = "";
  return (
    <div className="flex flex-col">
      {timed.map(({ item, t }, i) => {
        const showGutterTime = t !== prevTime;
        prevTime = t;
        return (
          <TimelineRow
            key={item.id}
            item={item}
            insight={insights?.[item.id]}
            showGutterTime={showGutterTime}
            isFirst={i === 0}
            isLast={i === timed.length - 1}
            onToggle={() => onToggle(item.id, item.taken, item.log_id)}
            onEdit={onEdit ? () => onEdit(item) : undefined}
          />
        );
      })}

      {untimed.length > 0 && (
        <div className={timed.length > 0 ? "mt-4 pt-3 border-t border-[#1f1f1f]" : ""}>
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Anytime today</div>
          {untimed.map((item) => (
            <UntimedRow
              key={item.id}
              item={item}
              insight={insights?.[item.id]}
              onToggle={() => onToggle(item.id, item.taken, item.log_id)}
              onEdit={onEdit ? () => onEdit(item) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
