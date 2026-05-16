"use client";

import { useRef, useState } from "react";
import type { ComponentType } from "react";
import { Check } from "lucide-react";
import { PALETTE } from "@/lib/design-tokens";
import { haptic } from "@/lib/feedback/haptics";
import ConfettiBurst from "@/components/ui/ConfettiBurst";

// Single completion-check component for the whole app.
// Schedule uses mode="large", Home priority goals use mode="small", workout
// set rows use mode="glyph". One pattern across every "did Sir do the thing?"
// interaction.

type Mode = "large" | "small" | "glyph";

type IconComponent = ComponentType<{ size?: number; style?: React.CSSProperties; className?: string }>;

type Props = {
  done: boolean;
  onToggle: () => void;
  mode?: Mode;
  // Per-item accent (e.g. a pill's color). Defaults to PALETTE.success.
  // When `done`, the circle ALWAYS uses success green — accent only paints
  // the un-done state.
  accent?: string;
  // Icon shown when un-done (small / large modes). Falls back to an empty
  // ring if omitted.
  icon?: IconComponent;
  // Confetti burst + success-haptic on the not→done transition.
  celebrate?: boolean;
  // ARIA label override.
  label?: string;
};

export default function CompletionToggle({
  done, onToggle, mode = "large", accent, icon: Icon, celebrate = true, label,
}: Props) {
  const [burst, setBurst] = useState(0);
  const burstKey = useRef(0);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const willBeDone = !done;
    if (willBeDone) {
      if (celebrate) {
        setBurst((n) => n + 1);
        burstKey.current += 1;
        haptic("success");
      } else {
        haptic("tap");
      }
    } else {
      haptic("tap");
    }
    onToggle();
  }

  // Mode-specific sizing.
  const size       = mode === "large" ? 36 : mode === "small" ? 24 : 20;
  const iconSize   = mode === "large" ? 16 : mode === "small" ? 12 : 10;
  const borderPx   = mode === "glyph" ? 1.5 : 2;

  const color = accent ?? PALETTE.success;
  const bg     = done ? PALETTE.success : (mode === "glyph" ? "transparent" : `${color}1a`);
  const border = done ? PALETTE.success : (mode === "glyph" ? "rgba(255,255,255,0.18)" : `${color}66`);

  return (
    <span className="relative inline-flex" style={{ width: size, height: size }}>
      <button
        onClick={handleClick}
        aria-label={label ?? (done ? "Mark not done" : "Mark done")}
        key={done ? `done-${burstKey.current}` : "undone"}
        className={`flex items-center justify-center rounded-full transition-all ${done && celebrate ? "anim-check-burst" : ""}`}
        style={{
          width:  size,
          height: size,
          background: bg,
          border: `${borderPx}px solid ${border}`,
        }}
      >
        {done
          ? <Check size={iconSize} strokeWidth={3} className="text-white" />
          : Icon ? <Icon size={iconSize} style={{ color }} /> : null
        }
      </button>
      {celebrate && <ConfettiBurst trigger={burst} count={mode === "large" ? 14 : 8} spread={mode === "large" ? 70 : 40} />}
    </span>
  );
}
