"use client";

import {
  AreaChart, Area, XAxis, ReferenceLine, ResponsiveContainer, Tooltip,
} from "recharts";

const energyData = Array.from({ length: 25 }, (_, hour) => {
  let energy = 0;
  if (hour < 8)  energy = 10 + hour * 2;
  else if (hour < 10) energy = 30 + (hour - 8) * 35;
  else if (hour < 12) energy = 100 - (hour - 10) * 10;
  else if (hour < 14) energy = 75 - (hour - 12) * 5;
  else if (hour < 16) energy = 60 - (hour - 14) * 8;
  else if (hour < 18) energy = 44 + Math.sin((hour - 14) * 1.2) * 10;
  else energy = Math.max(10, 40 - (hour - 18) * 8);
  return { hour, energy: Math.round(energy) };
});

const currentHour = 16;

const windows = [
  { label: "Peak",   x1: 8,  x2: 12, color: "#f97316" },
  { label: "Steady", x1: 12, x2: 17, color: "#eab308" },
  { label: "Foggy",  x1: 17, x2: 24, color: "#6366f1" },
];

export default function EnergyGraph() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {windows.map((w) => (
          <div key={w.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: w.color }} />
            <span className="text-[10px] text-zinc-400">{w.label}</span>
          </div>
        ))}
      </div>

      <div className="h-28">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={energyData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#f97316" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0}   />
              </linearGradient>
            </defs>
            <XAxis dataKey="hour" hide />
            <Tooltip
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200">
                    {`${payload[0].payload.hour}:00 — ${payload[0].value}%`}
                  </div>
                ) : null
              }
            />
            <Area
              type="monotone"
              dataKey="energy"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#energyGrad)"
              dot={false}
              activeDot={{ r: 3, fill: "#f97316" }}
            />
            <ReferenceLine
              x={currentHour}
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex justify-between text-[10px] text-zinc-600 px-0.5">
        <span>12 AM</span>
        <span>6 AM</span>
        <span>12 PM</span>
        <span>6 PM</span>
        <span>12 AM</span>
      </div>
    </div>
  );
}
