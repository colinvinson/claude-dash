"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PALETTE } from "@/lib/design-tokens";

// Inline sparkline of a business's recent MRR. Pulls the last ~12
// revenue_log entries and draws a smoothed line + filled area in the
// success color (with a soft dim on the y=0 baseline). Designed to sit
// in the BusinessDetail hero alongside the big MRR number.

type Point = { date: string; amount: number };

export default function MRRSparkline({
  businessId,
  width  = 110,
  height = 32,
}: {
  businessId: string;
  width?: number;
  height?: number;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const supabase = createClient();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("business_revenue_log")
        .select("log_date, amount")
        .eq("user_id",     user.id)
        .eq("business_id", businessId)
        .order("log_date", { ascending: true })
        .limit(24);
      if (!cancelled) {
        setPoints(((data ?? []) as Array<{ log_date: string; amount: number }>).map((r) => ({
          date:   r.log_date,
          amount: Number(r.amount) || 0,
        })));
      }
    }
    void load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const path = useMemo(() => {
    if (points.length < 2) return null;
    const max = Math.max(...points.map((p) => p.amount), 1);
    const xs  = points.map((_, i) => (i / (points.length - 1)) * width);
    const ys  = points.map((p) => height - (p.amount / max) * (height - 4) - 2);
    const linePath = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${ys[i].toFixed(2)}`).join(" ");
    const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(2)},${height} L${xs[0].toFixed(2)},${height} Z`;
    return { linePath, areaPath };
  }, [points, width, height]);

  if (!path) {
    // Not enough data — render an empty placeholder of the same dimensions
    // so the surrounding layout doesn't shift when data arrives.
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  const c = PALETTE.success;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-label="MRR trend">
      <defs>
        <linearGradient id={`spark-${businessId}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%"   stopColor={c} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.areaPath} fill={`url(#spark-${businessId})`} />
      <path d={path.linePath} fill="none" stroke={c} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
