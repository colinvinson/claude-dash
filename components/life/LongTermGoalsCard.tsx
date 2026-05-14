"use client";

import Link from "next/link";
import { Target, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";

// Long-term goals now live on /goals with a proper widget UI per goal +
// Life/Businesses pill bar + linked-routine adherence. The old accordion
// surface was deprecated to avoid two interaction surfaces editing the same
// table.
//
// This card sits on the Schedule tab as a small jump-off link.

export default function LongTermGoalsCard() {
  return (
    <Link href="/goals" className="block">
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Target size={14} className="text-zinc-500" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Long-term goals</span>
          </div>
          <ChevronRight size={14} className="text-zinc-600" />
        </div>
        <p className="text-xs text-zinc-400 mt-1.5">
          Track progress on life + business goals in the Goals tab.
        </p>
      </Card>
    </Link>
  );
}
