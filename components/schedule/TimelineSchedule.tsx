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
// specific scheduled_at still sort in a sensible order.
const BUCKET_FALLBACK_TIME: Record<string, string> = {
  "pre-workout": "06:30",
  "morning":     "07:00",
  "lunch":       "12:00",
  "afternoon":   "15:00",
  "evening":     "19:00",
  "pre-bed":     "22:00",
  "bedtime":     "22:30",
  "night":       "22:30",
};

function effectiveTime(item: StackItem): string {
  if (item.scheduled_at) return item.scheduled_at.slice(0, 5); // "HH:MM"
  const key = (item.timing ?? "").trim().toLowerCase();
  return BUCKET_FALLBACK_TIME[key] ?? "12:00";
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
}: {
  item: StackItem;
  insight?: StackInsight;
  showGutterTime: boolean;
  isFirst: boolean;
  isLast: boolean;
  onToggle: () => void;
}) {
  const start = effectiveTime(item);
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
        <div className="flex-1 min-w-0">
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
        </div>
        <button
          onClick={onToggle}
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

export default function TimelineSchedule({
  items,
  insights,
  onToggle,
}: {
  items: StackItem[];
  insights?: Record<string, StackInsight>;
  onToggle: (id: string, taken: boolean, logId: string | null) => void;
}) {
  // Sort by effective time; stable on sort_order within the same minute.
  const ordered = useMemo(() => {
    return [...items].sort((a, b) => {
      const at = effectiveTime(a);
      const bt = effectiveTime(b);
      if (at !== bt) return at.localeCompare(bt);
      return a.sort_order - b.sort_order;
    });
  }, [items]);

  if (ordered.length === 0) {
    return (
      <p className="text-xs text-zinc-500 py-6 text-center">
        No scheduled items yet. Add routines in Settings.
      </p>
    );
  }

  // Dedupe identical consecutive times in the gutter so it doesn't look noisy.
  let prevTime = "";
  return (
    <div className="flex flex-col">
      {ordered.map((item, i) => {
        const t = effectiveTime(item);
        const showGutterTime = t !== prevTime;
        prevTime = t;
        return (
          <TimelineRow
            key={item.id}
            item={item}
            insight={insights?.[item.id]}
            showGutterTime={showGutterTime}
            isFirst={i === 0}
            isLast={i === ordered.length - 1}
            onToggle={() => onToggle(item.id, item.taken, item.log_id)}
          />
        );
      })}
    </div>
  );
}
