"use client";

import { useMemo } from "react";

export type OrbState = "idle" | "listening" | "thinking" | "speaking";

const STATE_HUE: Record<OrbState, number> = {
  idle:      200,  // cyan-blue
  listening: 185,  // bright cyan
  thinking:  220,  // electric blue-violet
  speaking:  195,  // warm cyan
};

const STATE_SPIN: Record<OrbState, number> = {
  idle:      40,   // seconds per rotation
  listening: 14,
  thinking:  22,
  speaking:  10,
};

type Props = { state: OrbState; size?: number };

// Stable particle positions generated once — random looks but doesn't reshuffle on every render
function useParticles(count: number, seed = 42) {
  return useMemo(() => {
    const out: Array<{ x: number; y: number; r: number; delay: number }> = [];
    let s = seed;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let i = 0; i < count; i++) {
      // Polar coordinate inside a disc, denser toward center
      const angle = rand() * Math.PI * 2;
      const radius = Math.pow(rand(), 1.6) * 0.42;  // bias toward center
      const x = 0.5 + Math.cos(angle) * radius;
      const y = 0.5 + Math.sin(angle) * radius;
      const r = 0.4 + rand() * 1.6;
      const delay = rand() * 4;
      out.push({ x, y, r, delay });
    }
    return out;
  }, [count, seed]);
}

export default function Orb({ state, size = 320 }: Props) {
  const hue = STATE_HUE[state];
  const spinSec = STATE_SPIN[state];
  const particles = useParticles(180);

  const c1 = `hsla(${hue}, 95%, 78%, 1)`;     // bright core highlight
  const c2 = `hsla(${hue}, 90%, 56%, 0.85)`;  // main orb body
  const c3 = `hsla(${hue}, 85%, 38%, 0.45)`;  // outer glow
  const ringStroke = `hsla(${hue}, 80%, 60%, 0.55)`;
  const ringStrokeFaint = `hsla(${hue}, 80%, 60%, 0.18)`;
  const particleFill = `hsla(${hue}, 90%, 78%, 0.85)`;

  return (
    <div style={{ width: size, height: size, position: "relative" }} aria-hidden>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: "visible" }}>
        <defs>
          {/* Core radial gradient */}
          <radialGradient id="orbCore" cx="40%" cy="35%">
            <stop offset="0%"  stopColor={c1} stopOpacity="1" />
            <stop offset="35%" stopColor={c2} stopOpacity="0.9" />
            <stop offset="75%" stopColor={c2} stopOpacity="0.3" />
            <stop offset="100%" stopColor={c2} stopOpacity="0" />
          </radialGradient>
          {/* Outer glow */}
          <radialGradient id="orbGlow" cx="50%" cy="50%">
            <stop offset="0%"  stopColor={c2} stopOpacity="0.0" />
            <stop offset="60%" stopColor={c2} stopOpacity="0.0" />
            <stop offset="85%" stopColor={c3} stopOpacity="0.3" />
            <stop offset="100%" stopColor={c3} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer glow halo */}
        <circle cx="50" cy="50" r="48" fill="url(#orbGlow)" />

        {/* Faint outermost ring with cardinal tick marks */}
        <g style={{ transformOrigin: "50px 50px", animation: `orbSpinSlow ${spinSec * 2.5}s linear infinite` }}>
          <circle cx="50" cy="50" r="44" fill="none" stroke={ringStrokeFaint} strokeWidth="0.25" />
          {Array.from({ length: 36 }).map((_, i) => {
            const a = (i / 36) * Math.PI * 2;
            const x1 = 50 + Math.cos(a) * 43;
            const y1 = 50 + Math.sin(a) * 43;
            const x2 = 50 + Math.cos(a) * (i % 9 === 0 ? 41.5 : 42.5);
            const y2 = 50 + Math.sin(a) * (i % 9 === 0 ? 41.5 : 42.5);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={ringStrokeFaint} strokeWidth="0.3" />;
          })}
        </g>

        {/* Mid ring — dashed, rotating opposite direction */}
        <g style={{ transformOrigin: "50px 50px", animation: `orbSpinReverse ${spinSec}s linear infinite` }}>
          <circle cx="50" cy="50" r="38" fill="none" stroke={ringStroke} strokeWidth="0.4" strokeDasharray="1 2" />
        </g>

        {/* Inner solid ring */}
        <g style={{ transformOrigin: "50px 50px", animation: `orbSpinSlow ${spinSec * 1.4}s linear infinite` }}>
          <circle cx="50" cy="50" r="33" fill="none" stroke={ringStroke} strokeWidth="0.5" />
          {/* Three accent arcs */}
          {[0, 120, 240].map((deg) => (
            <path
              key={deg}
              d={describeArc(50, 50, 33, deg, deg + 20)}
              fill="none"
              stroke={c1}
              strokeWidth="0.9"
              strokeLinecap="round"
              opacity="0.85"
            />
          ))}
        </g>

        {/* Innermost decorative ring */}
        <g style={{ transformOrigin: "50px 50px", animation: `orbSpinReverse ${spinSec * 0.7}s linear infinite` }}>
          <circle cx="50" cy="50" r="26" fill="none" stroke={ringStrokeFaint} strokeWidth="0.4" strokeDasharray="0.5 1.5" />
        </g>

        {/* Particle nebula in the core */}
        <g style={{ animation: `orbPulse ${state === "idle" ? 5 : 1.6}s ease-in-out infinite` }}>
          {particles.map((p, i) => (
            <circle
              key={i}
              cx={p.x * 100}
              cy={p.y * 100}
              r={p.r * 0.35}
              fill={particleFill}
              opacity={0.7}
              style={{ animation: `orbParticle ${1.5 + p.delay}s ease-in-out infinite`, animationDelay: `${p.delay}s` }}
            />
          ))}
          {/* Bright core sphere */}
          <circle cx="50" cy="50" r="14" fill="url(#orbCore)" />
        </g>
      </svg>

      <style>{`
        @keyframes orbSpinSlow    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes orbSpinReverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
        @keyframes orbPulse {
          0%, 100% { transform: scale(1);    filter: brightness(1); }
          50%      { transform: scale(1.04); filter: brightness(1.18); }
        }
        @keyframes orbParticle {
          0%, 100% { opacity: 0.3; }
          50%      { opacity: 0.95; }
        }
      `}</style>
    </div>
  );
}

// SVG arc helper
function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  const s = polarToCartesian(cx, cy, r, end);
  const e = polarToCartesian(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y}`;
}
