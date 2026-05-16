"use client";

import { Compass, ArrowRight } from "lucide-react";
import Card from "@/components/ui/Card";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useNetWorth } from "@/hooks/useNetWorth";
import { useWishlist } from "@/hooks/useWishlist";
import { useMoneyFlow } from "@/hooks/useMoneyFlow";
import { PALETTE, TYPE, ICON } from "@/lib/design-tokens";

// THE hero of the Finances tab — the strategic decision surface.
// Per Sir's directive ("rich, not wannabe entrepreneur") the most
// valuable thing the dashboard can do isn't show him numbers;
// it's surface the DECISION those numbers create.
//
// Tapping the prompt opens Jarvis HUD with a pre-formed strategy
// question that includes his current cash, MRR, wants total, and
// the consumption-vs-leverage flag. Jarvis answers from his full
// context — businesses, goals, training, time data — none of which
// ChatGPT sees. That's the wedge.

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(Math.abs(n) / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000)     return `$${(Math.abs(n) / 1000).toFixed(1)}k`;
  return `$${Math.round(Math.abs(n))}`;
}

function openJarvis(prompt: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("jarvis:open", { detail: { prompt } }));
}

export default function StrategySection() {
  const { totalMRR, businesses }            = useBusinesses();
  const { latest, latestTotal }             = useNetWorth();
  const { totalWanted, wantedLeverage, wantedConsumption } = useWishlist({});
  const { summary }                         = useMoneyFlow();

  const cash = latest?.cash ?? 0;
  const consumptionOverleveraged = wantedConsumption > 0 && wantedConsumption > wantedLeverage * 2;

  function askStrategy() {
    const lines: string[] = [
      `I'm reviewing my financial position. Here's the snapshot:`,
      `- Cash on hand: ${fmt(cash)}`,
      `- Total net worth: ${fmt(latestTotal)}`,
      `- Total business MRR: ${fmt(totalMRR)}/mo across ${businesses.length} businesses`,
      `- Net cash flow last 30d: ${fmt(summary.net30d)} (in ${fmt(summary.income30d)}, out ${fmt(summary.expense30d)})`,
      `- Open wants list: ${fmt(totalWanted)} (${fmt(wantedLeverage)} leverage, ${fmt(wantedConsumption)} consumption)`,
    ];
    if (consumptionOverleveraged) lines.push(`- Flag: my consumption wants are more than 2x my leverage wants.`);
    lines.push(``);
    lines.push(`Given my goal is wealth (not just being "successful"), what's the highest-EV move for me right now? Be specific — name the actual decision, not generic advice. Push back if my wants list is cope. Factor in my businesses, goals, and the stage I'm at (19, long horizon, low burn).`);
    openJarvis(lines.join("\n"));
  }

  // Compact one-liner — what's the situation in 60 chars?
  let oneLine: string;
  if (cash === 0 && totalMRR === 0)             oneLine = "Punch in a net worth snapshot to get started.";
  else if (consumptionOverleveraged)            oneLine = "Wants list is tilting consumption-heavy. Worth a check.";
  else if (summary.net30d < 0)                  oneLine = `Burning ${fmt(Math.abs(summary.net30d))} more than coming in last 30d.`;
  else if (totalMRR > 0 && cash > totalMRR * 6) oneLine = `Cash buffer is ${Math.round(cash / Math.max(totalMRR, 1))}× MRR. Reinvest some of it?`;
  else                                          oneLine = `Net positive ${fmt(summary.net30d)} last 30d. What's the next move?`;

  return (
    <Card variant="hero">
      <div className="flex items-center gap-2 mb-3">
        <Compass size={ICON.sm} style={{ color: PALETTE.celebration }} />
        <span className={TYPE.label}>Strategy</span>
      </div>
      <p className="text-base font-semibold text-zinc-100 leading-snug mb-3">{oneLine}</p>
      <button
        onClick={askStrategy}
        className="w-full flex items-center justify-between px-3 py-3 rounded-xl bg-white text-zinc-900 font-bold text-sm transition-opacity hover:opacity-90"
      >
        <span>Ask Jarvis: highest-EV move with what I have?</span>
        <ArrowRight size={ICON.sm} />
      </button>
      <p className="text-[10px] text-zinc-500 mt-2 leading-snug">
        Jarvis answers from your full context — businesses, MRR, goals, training, time data. ChatGPT can&apos;t do this; it has no idea what you&apos;re building.
      </p>
    </Card>
  );
}
