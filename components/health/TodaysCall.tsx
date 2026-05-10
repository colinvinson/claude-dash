"use client";
import { useState } from "react";
import Badge from "@/components/ui/Badge";
import { ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  severity: "green" | "orange" | "yellow" | "red";
  headline: string;
  bullets: string[];
}

export default function TodaysCall({ severity, headline, bullets }: Props) {
  const [expanded, setExpanded] = useState(false);
  const variant = severity === "green" ? "green" : severity === "red" ? "red" : severity === "yellow" ? "yellow" : "orange";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>Today&apos;s Call</Badge>
        <Badge variant={variant}>{severity.toUpperCase()}</Badge>
      </div>
      <p className="text-sm font-semibold text-zinc-100 leading-snug">{headline}</p>
      {expanded && (
        <ul className="space-y-1 mt-1">
          {bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-xs text-zinc-400">
              <span className="text-zinc-600 mt-0.5">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
