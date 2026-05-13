"use client";

import { CSSProperties } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const STATE_COLORS: Record<OrbState, { core: string; mid: string; outer: string; glow: string }> = {
  idle: {
    core:  "rgba(220,235,255,0.95)",
    mid:   "rgba(96,165,250,0.55)",
    outer: "rgba(59,130,246,0.20)",
    glow:  "rgba(59,130,246,0.35)",
  },
  listening: {
    core:  "rgba(220,255,250,1)",
    mid:   "rgba(34,211,238,0.7)",
    outer: "rgba(6,182,212,0.30)",
    glow:  "rgba(6,182,212,0.55)",
  },
  thinking: {
    core:  "rgba(245,235,255,0.95)",
    mid:   "rgba(167,139,250,0.6)",
    outer: "rgba(139,92,246,0.22)",
    glow:  "rgba(139,92,246,0.40)",
  },
  speaking: {
    core:  "rgba(255,250,235,1)",
    mid:   "rgba(251,191,36,0.75)",
    outer: "rgba(245,158,11,0.25)",
    glow:  "rgba(245,158,11,0.55)",
  },
};

const STATE_DURATION: Record<OrbState, string> = {
  idle:      "5s",
  listening: "1.4s",
  thinking:  "2.6s",
  speaking:  "0.9s",
};

type Props = { state: OrbState; size?: number };

export default function Orb({ state, size = 260 }: Props) {
  const c = STATE_COLORS[state];
  const duration = STATE_DURATION[state];

  const containerStyle: CSSProperties = {
    width: size,
    height: size,
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const ringStyle = (delay: number, scale: number): CSSProperties => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: "50%",
    border: `1.5px solid ${c.outer}`,
    animation: `orbRingPulse ${duration} ease-in-out ${delay}s infinite`,
    transform: `scale(${scale})`,
    opacity: 0.6,
  });

  const coreStyle: CSSProperties = {
    width: size * 0.62,
    height: size * 0.62,
    borderRadius: "50%",
    background: `radial-gradient(circle at 35% 30%, ${c.core} 0%, ${c.mid} 45%, ${c.outer} 100%)`,
    boxShadow: `0 0 ${size * 0.4}px ${c.glow}, inset 0 0 ${size * 0.15}px rgba(255,255,255,0.45)`,
    animation: `orbCorePulse ${duration} ease-in-out infinite`,
    position: "relative",
    transition: "background 600ms ease, box-shadow 600ms ease",
  };

  return (
    <div style={containerStyle} aria-hidden>
      <div style={ringStyle(0,   1.00)} />
      <div style={ringStyle(0.4, 1.10)} />
      <div style={ringStyle(0.8, 1.22)} />
      <div style={coreStyle} />
      <style>{`
        @keyframes orbCorePulse {
          0%, 100% { transform: scale(1);    filter: brightness(1); }
          50%      { transform: scale(1.06); filter: brightness(1.18); }
        }
        @keyframes orbRingPulse {
          0%, 100% { opacity: 0.55; }
          50%      { opacity: 0.20; }
        }
      `}</style>
    </div>
  );
}
