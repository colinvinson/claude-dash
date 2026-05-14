"use client";

import { useHealth } from "@/hooks/useHealth";
import { val } from "@/lib/fmt";
import SectionLabel from "@/components/layout/SectionLabel";
import Card from "@/components/ui/Card";
import ReadinessRing from "@/components/health/ReadinessRing";
import SleepStages from "@/components/health/SleepStages";
import TodaysCall from "@/components/health/TodaysCall";

function StatBox({ label, value, color = "text-white" }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">{label}</span>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

export default function HealthCard() {
  const { health, loading, syncing } = useHealth();

  const r = health.readiness_score;
  const actColor =
    health.activity_score == null ? "text-zinc-400"
    : health.activity_score >= 67  ? "text-green-400"
    : health.activity_score >= 34  ? "text-yellow-400"
    : "text-orange-400";

  const hasStages =
    health.rem_min != null || health.deep_min != null ||
    health.light_min != null || health.awake_min != null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <SectionLabel>Oura</SectionLabel>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${health.is_final ? "bg-green-400" : "bg-yellow-400"}`} />
          <span className="text-[10px] text-zinc-500">
            {syncing ? "Syncing Oura…" : loading ? "Loading…" : health.is_final ? "Final" : health.readiness_score == null ? "No data today" : "Preliminary"}
          </span>
        </div>
      </div>

      <Card>
        {/* Ring + stats grid */}
        <div className="flex items-center gap-5 mb-4">
          <ReadinessRing
            score={r ?? 0}
            label={health.readiness_label ?? (r == null ? "No data" : "—")}
            dimmed={r == null}
          />
          <div className="grid grid-cols-3 gap-3 flex-1">
            <StatBox label="Sleep"    value={val(health.sleep_score, "%")} />
            <StatBox label="Activity" value={val(health.activity_score)} color={actColor} />
            <StatBox label="HRV"      value={val(health.hrv, "ms")} />
            <StatBox label="RHR"      value={val(health.rhr, "bpm")} />
            <StatBox label="SpO₂"     value={val(health.spo2_pct, "%")} />
            <StatBox label="Resp"     value={val(health.resp_rate, "/m")} />
          </div>
        </div>

        {/* Sleep stages */}
        {hasStages && (
          <div className="border-t border-[#1f1f1f] pt-4 mb-4">
            <SleepStages stages={{
              rem:   health.rem_min   ?? 0,
              deep:  health.deep_min  ?? 0,
              light: health.light_min ?? 0,
              awake: health.awake_min ?? 0,
            }} />
          </div>
        )}

        {/* Today's Call */}
        {health.todays_call_body ? (
          <div className={`border-t border-[#1f1f1f] pt-4 ${hasStages ? "" : "mt-0"}`}>
            <TodaysCall
              severity={health.todays_call_severity ?? "green"}
              headline={health.todays_call_body}
              bullets={[]}
            />
          </div>
        ) : (
          <div className="border-t border-[#1f1f1f] pt-4">
            <p className="text-xs text-zinc-600">
              {r == null
                ? "Oura data not synced yet. Data will appear here once your ring syncs after waking."
                : "Today's call will appear once Jarvis analyzes your data."}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
