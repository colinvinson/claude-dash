"use client";

import { DollarSign, Bot, FileText, CheckCircle2 } from "lucide-react";
import FormLabel from "@/components/ui/FormLabel";
import { useBusinessActivity, type ActivityKind } from "@/hooks/useBusinessActivity";
import { PALETTE, ICON } from "@/lib/design-tokens";

// Per-business activity feed. Chronological merge of revenue logs, agent
// dispatches, artifact creations, task completions. Tells Sir "what just
// happened with this business" at a glance — no scrolling through four
// different sections to find it.

function kindIcon(kind: ActivityKind) {
  switch (kind) {
    case "revenue":   return { Icon: DollarSign,   color: PALETTE.success };
    case "agent_run": return { Icon: Bot,          color: PALETTE.info };
    case "artifact":  return { Icon: FileText,     color: PALETTE.celebration };
    case "task_done": return { Icon: CheckCircle2, color: PALETTE.success };
  }
}

function timeSinceShort(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)   return "just now";
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export default function BusinessActivity({ businessId }: { businessId: string }) {
  const { entries, loading } = useBusinessActivity(businessId, 12);

  if (loading || entries.length === 0) return null;

  return (
    <div>
      <FormLabel>Recent activity</FormLabel>
      <div className="space-y-1.5">
        {entries.map((e) => {
          const { Icon, color } = kindIcon(e.kind);
          return (
            <div key={e.id} className="flex items-start gap-2.5">
              <Icon size={ICON.xs} style={{ color }} className="flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-zinc-200 leading-snug truncate">{e.title}</p>
                {e.subtitle && (
                  <p className="text-[10px] text-zinc-500 truncate">{e.subtitle}</p>
                )}
              </div>
              <span className="text-[10px] text-zinc-600 tabular-nums flex-shrink-0">
                {timeSinceShort(e.at)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
