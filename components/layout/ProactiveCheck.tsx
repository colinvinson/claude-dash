"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

export default function ProactiveCheck() {
  const [insight,  setInsight]  = useState<string | null>(null);
  const [severity, setSeverity] = useState<"green" | "yellow" | "red">("green");
  const [dismissed, setDismissed] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check last insight time
      const { data } = await supabase
        .from("jarvis_insights")
        .select("triggered_at")
        .eq("user_id", user.id)
        .order("triggered_at", { ascending: false })
        .limit(1);

      const lastAt = data?.[0]?.triggered_at;
      const ninetyMin = 90 * 60 * 1000;
      const isStale = !lastAt || Date.now() - new Date(lastAt).getTime() > ninetyMin;

      if (!isStale) return;

      const res  = await fetch("/api/jarvis/analyze", { method: "POST" });
      const json = await res.json();
      if (json.insight) {
        setInsight(json.insight);
        setSeverity(json.severity ?? "green");
      }
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also seed on first load
  useEffect(() => {
    fetch("/api/seed", { method: "POST" });
  }, []);

  if (!insight || dismissed) return null;

  const colors = {
    green:  "bg-green-500/10 border-green-500/30 text-green-300",
    yellow: "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
    red:    "bg-red-500/10 border-red-500/30 text-red-300",
  };

  return (
    <div className={`mx-4 mt-2 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${colors[severity]}`}>
      <span className="flex-1 leading-snug">{insight}</span>
      <button onClick={() => setDismissed(true)} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
        <X size={14} />
      </button>
    </div>
  );
}
