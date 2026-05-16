"use client";

import { useState, useEffect } from "react";
import { useWorkout, CoachStatus } from "@/hooks/useWorkout";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/layout/SectionLabel";
import Toggle from "@/components/ui/Toggle";
import WeeklyVolumeCard from "@/components/fitness/WeeklyVolumeCard";
import RecoveryStrainCard from "@/components/fitness/RecoveryStrainCard";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";
import { X, Zap } from "lucide-react";
import { kgToLb, lbToKg, roundToPlate } from "@/lib/units";
import { haptic } from "@/lib/feedback/haptics";
import { pick } from "@/lib/feedback/phrases";
import ConfettiBurst from "@/components/ui/ConfettiBurst";

const STATUS_STYLES: Record<CoachStatus, { pill: string; border: string; glow: string; label: string }> = {
  NEW:        { pill: "bg-zinc-800 text-zinc-300 border border-zinc-700",          border: "border-zinc-700",       glow: "",                             label: "NEW"        },
  PROGRESS:   { pill: "bg-green-500/15 text-green-400 border border-green-500/40", border: "border-green-500/30",   glow: "shadow-green-500/10 shadow-lg", label: "PROGRESS"   },
  GRIND:      { pill: "bg-blue-500/15 text-blue-400 border border-blue-500/40",    border: "border-blue-500/30",    glow: "shadow-blue-500/10 shadow-lg",  label: "GRIND"      },
  STALLING:   { pill: "bg-amber-500/15 text-amber-400 border border-amber-500/40", border: "border-amber-500/30",   glow: "shadow-amber-500/10 shadow-lg", label: "STALLING"   },
  REGRESSION: { pill: "bg-red-500/15 text-red-400 border border-red-500/40",       border: "border-red-500/30",     glow: "shadow-red-500/10 shadow-lg",   label: "REGRESSION" },
  DELOAD:     { pill: "bg-sky-500/15 text-sky-400 border border-sky-500/40",       border: "border-sky-500/30",     glow: "shadow-sky-500/10 shadow-lg",   label: "DELOAD"     },
};

const TYPE_BADGE: Record<string, { label: string; color: string }> = {
  Compound:  { label: "Compound",  color: "bg-violet-500/15 text-violet-400 border border-violet-500/30" },
  Secondary: { label: "Secondary", color: "bg-blue-500/15 text-blue-400 border border-blue-500/30" },
  Isolation: { label: "Isolation", color: "bg-rose-500/15 text-rose-400 border border-rose-500/30" },
};

const REPS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20];

export default function ProgressiveOverloadCoach() {
  const {
    gyms, filteredExercises, pastSessions, todaySets, trendData, loading,
    activeGymId, setActiveGymId,
    activeDay,   setActiveDay,
    activeExId,  setActiveExId,
    activeExercise, verdict, logSet, deleteSet,
    muscleStatus,
  } = useWorkout();

  // weight is in POUNDS for input + display. Convert to kg only at logSet time.
  // The verdict.targetWeight comes from useWorkout in kg, so we kg→lb on
  // initialization and round to a 2.5lb plate increment.
  const [weight,    setWeight]    = useState(45);
  const [reps,      setReps]      = useState(8);
  const [logging,   setLogging]   = useState(false);
  const [flash,     setFlash]     = useState<string | null>(null);
  const [forcePR,   setForcePR]   = useState(false);

  // Pre-fill from verdict when exercise or override changes
  useEffect(() => {
    if (!activeExId) return;
    if (verdict) {
      const useOriginal = forcePR && verdict.recoveryAdjustment?.applied;
      const src = useOriginal && verdict.recoveryAdjustment
        ? verdict.recoveryAdjustment.original
        : { targetWeight: verdict.targetWeight, targetReps: verdict.targetReps };
      setWeight(roundToPlate(kgToLb(src.targetWeight), 2.5));
      setReps(src.targetReps);
    } else {
      setWeight(45);
      setReps(8);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeExId, forcePR, verdict?.recoveryAdjustment?.applied]);

  const [setBurst, setSetBurst] = useState(0);
  const [isPr,     setIsPr]     = useState(false);
  async function handleLog() {
    setLogging(true);
    const newEst1rm = Math.round(lbToKg(weight) * (1 + reps / 30));
    // PR check: bigger than every prior session's top est_1rm for this exercise.
    const prevBest = pastSessions.reduce((m, s) => Math.max(m, s.topEst1rm), 0);
    const pr = newEst1rm > prevBest && prevBest > 0;
    await logSet(lbToKg(weight), reps);
    setLogging(false);
    setSetBurst((n) => n + 1);
    if (pr) {
      setIsPr(true);
      haptic("milestone");
      setFlash(`PR! ${kgToLb(newEst1rm).toFixed(0)} lb estimated 1RM`);
      setTimeout(() => setIsPr(false), 1800);
    } else {
      haptic("success");
      setFlash(pick("setLogged", { n: todaySets.length + 1 }));
    }
    setTimeout(() => setFlash(null), 2500);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionLabel>Hypertrophy Coach</SectionLabel>
        <div className="h-40 bg-[#111111] border border-[#1f1f1f] rounded-2xl animate-pulse" />
      </div>
    );
  }

  const style       = verdict ? STATUS_STYLES[verdict.status] : null;
  const inRange     = verdict ? (reps >= verdict.repRange.min && reps <= verdict.repRange.max) : false;
  const typeBadge   = activeExercise?.exercise_type ? TYPE_BADGE[activeExercise.exercise_type] : null;
  const adjustment  = verdict?.recoveryAdjustment;
  const isAdjusted  = !!adjustment?.applied;

  return (
    <div className="space-y-4">
      <SectionLabel>Hypertrophy Coach</SectionLabel>

      <RecoveryStrainCard />

      {/* Selectors */}
      <Card>
        <div className="space-y-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5 block">Split</span>
            <Toggle options={["Push", "Pull", "Legs"]} value={activeDay} onChange={setActiveDay} />
          </div>
          <div>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Exercise</span>
            <select
              value={activeExId ?? ""}
              onChange={(e) => setActiveExId(e.target.value || null)}
              className="w-full bg-zinc-800 text-zinc-100 rounded-xl px-4 py-3 text-sm outline-none border border-zinc-700 focus:border-zinc-600"
            >
              <option value="">Select exercise…</option>
              {filteredExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {activeExercise && verdict && style && (
        <>
          {/* Coaching Verdict */}
          <div className={`bg-[#111111] border ${style.border} ${style.glow} rounded-2xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">{activeExercise.name.toUpperCase()}</span>
                {typeBadge && (
                  <span className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${typeBadge.color}`}>
                    {typeBadge.label}
                  </span>
                )}
                {isAdjusted && !forcePR && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/40">
                    Auto-adjusted
                  </span>
                )}
                {forcePR && (
                  <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/40">
                    PR Mode
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${style.pill}`}>
                {style.label}
              </span>
            </div>
            <p className="text-xl font-bold text-white leading-snug mb-2">{verdict.headline}</p>
            <p className="text-xs text-zinc-500 leading-relaxed mb-2">{verdict.tip}</p>
            {muscleStatus && muscleStatus.hoursSince != null && muscleStatus.hoursSince < 72 && (
              <p className="text-[10px] text-zinc-600 mb-2">
                {activeExercise.muscle_group} hit {muscleStatus.hoursSince}h ago · {muscleStatus.hardSetsLast48h} hard sets in 48h · {muscleStatus.status.replace("-", " ")}
              </p>
            )}

            {/* Lifestyle drivers — sleep, alcohol, supplement adherence,
                composition phase. Shown right under the verdict because
                they're often the actual cause of whatever it landed on. */}
            {verdict.lifestyleDrivers.length > 0 && (
              <div className="mt-3 space-y-1.5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">Context</p>
                {verdict.lifestyleDrivers.map((d, i) => {
                  const color =
                    d.severity === "good" ? "border-emerald-500/25 bg-emerald-500/5 text-emerald-200" :
                    d.severity === "warn" ? "border-amber-500/25  bg-amber-500/5  text-amber-200"  :
                                            "border-zinc-700      bg-zinc-900/40   text-zinc-300";
                  return (
                    <p key={i} className={`text-[11px] leading-relaxed rounded-md px-2.5 py-1.5 border ${color}`}>
                      {d.text}
                    </p>
                  );
                })}
              </div>
            )}
            {isAdjusted && adjustment && (
              <div className="mt-3 p-3 bg-orange-500/5 border border-orange-500/20 rounded-xl">
                <p className="text-[10px] uppercase tracking-widest text-orange-400 font-bold mb-1">Recovery adjustment</p>
                <p className="text-xs text-zinc-300 leading-relaxed mb-2">{adjustment.reason}</p>
                {!forcePR && (
                  <p className="text-[10px] text-zinc-500">
                    Original: {kgToLb(adjustment.original.targetWeight).toFixed(0)}lb × {adjustment.original.targetReps} · {adjustment.original.targetSets} sets
                    {" → "}
                    Now: {kgToLb(adjustment.adjusted.targetWeight).toFixed(0)}lb × {adjustment.adjusted.targetReps} · {adjustment.adjusted.targetSets} sets
                  </p>
                )}
                <button
                  onClick={() => setForcePR(!forcePR)}
                  className={`mt-2 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    forcePR
                      ? "bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  {forcePR ? "Disable PR Mode" : "Force PR Mode"}
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 pt-3 mt-3 border-t border-[#1f1f1f]">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">Target</p>
                <p className="text-lg font-bold text-white">{weight}<span className="text-xs text-zinc-500 font-normal ml-0.5">lb</span></p>
              </div>
              <div className="w-px h-8 bg-[#1f1f1f]" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">Reps</p>
                <p className="text-lg font-bold text-white">{verdict.targetReps}</p>
              </div>
              <div className="w-px h-8 bg-[#1f1f1f]" />
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">Sets</p>
                <p className="text-lg font-bold text-white">{verdict.targetSets}</p>
              </div>
              {pastSessions.length > 0 && (
                <>
                  <div className="w-px h-8 bg-[#1f1f1f]" />
                  <div className="text-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-0.5">Est. 1RM</p>
                    <p className="text-lg font-bold text-white">{kgToLb(pastSessions[0].topEst1rm).toFixed(0)}<span className="text-xs text-zinc-500 font-normal ml-0.5">lb</span></p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Per-set intensity protocol — when to push, when to hold back, when to extend past failure */}
          {(verdict.setProtocol.length > 0 || verdict.warmupSets.length > 0) && (
            <Card>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Plan for today</span>

              {/* Warm-up rows render above working sets — visually distinct,
                  no RIR (warmups aren't effort-graded). */}
              {verdict.warmupSets.length > 0 && (
                <div className="space-y-1 mb-3 pb-3 border-b border-[#1f1f1f]">
                  {verdict.warmupSets.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 py-1 px-3 rounded-lg opacity-70">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-16">Warm-up {i + 1}</span>
                      <span className="text-[11px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border bg-zinc-800 text-zinc-400 border-zinc-700">
                        Easy
                      </span>
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {kgToLb(w.weight).toFixed(0)}<span className="text-zinc-600">lb</span> × {w.reps}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-1.5">
                {verdict.setProtocol.map((p) => {
                  const done = todaySets.length >= p.setNum;
                  const upNext = todaySets.length + 1 === p.setNum;
                  const isFailure = p.rir === 0 || p.rir === null;
                  const badgeColor = p.technique
                    ? "bg-orange-500/15 text-orange-300 border-orange-500/30"
                    : isFailure
                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                      : "bg-zinc-800 text-zinc-400 border-zinc-700";
                  return (
                    <div
                      key={p.setNum}
                      className={`flex items-start gap-3 py-2 px-3 rounded-xl border transition-opacity ${
                        upNext ? "bg-white/5 border-white/15"
                              : done ? "opacity-40 border-transparent"
                              : "border-transparent"
                      }`}
                    >
                      <span className="text-[10px] uppercase tracking-widest text-zinc-600 w-10 pt-0.5">
                        {done ? "✓" : `Set ${p.setNum}`}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeColor}`}>
                            {p.label}
                          </span>
                          {upNext && (
                            <span className="text-[9px] uppercase tracking-widest text-zinc-500">Up next</span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400 leading-snug">{p.note}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Today's Sets */}
          {todaySets.length > 0 && (
            <Card>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Today&apos;s Session</span>
              <div className="space-y-1.5">
                {todaySets.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between py-2 px-3 bg-zinc-800/50 rounded-xl">
                    <span className="text-[10px] text-zinc-600 uppercase tracking-widest w-10">Set {i + 1}</span>
                    <span className="text-sm font-semibold text-zinc-100 flex-1 text-center">
                      {kgToLb(s.weight_kg).toFixed(0)}lb × {s.reps}
                    </span>
                    <span className="text-[10px] text-zinc-600 w-16 text-right">
                      {`${kgToLb(s.est_1rm).toFixed(0)}lb 1RM`}
                    </span>
                    <button
                      onClick={() => deleteSet(s.id)}
                      className="ml-3 text-zinc-700 hover:text-red-400 transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-[#1f1f1f] flex items-center gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Volume</p>
                  <p className="text-sm font-semibold text-zinc-300">
                    {kgToLb(todaySets.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)).toFixed(0).toLocaleString()}lb
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Sets</p>
                  <p className="text-sm font-semibold text-zinc-300">{todaySets.length}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600">Best 1RM</p>
                  <p className="text-sm font-semibold text-zinc-300">
                    {kgToLb(Math.max(...todaySets.map((s) => s.est_1rm))).toFixed(0)}lb
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Log a Set */}
          <Card>
            <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">
              — {todaySets.length > 0 ? `Log Set ${todaySets.length + 1}` : "Log First Set"}
            </span>

            {/* Weight — input + display in pounds. Increments match US gym plate
                conventions: 5 lb (a single 5 plate per side) and 2.5 lb (a single
                2.5 per side). Stored as kg via lbToKg() at logSet time. */}
            <div className="mb-4">
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Weight (lb)</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setWeight((w) => Math.max(0, Math.round((w - 5) * 10) / 10))}
                  className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xl flex items-center justify-center transition-colors"
                  aria-label="Subtract 5 lb"
                >
                  −
                </button>
                <span className="text-5xl font-bold text-white flex-1 text-center tabular-nums">{weight}</span>
                <button
                  onClick={() => setWeight((w) => Math.round((w + 5) * 10) / 10)}
                  className="w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white font-bold text-xl flex items-center justify-center transition-colors"
                  aria-label="Add 5 lb"
                >
                  +
                </button>
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={() => setWeight((w) => Math.max(0, Math.round((w - 2.5) * 10) / 10))}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-700"
                >
                  −2.5
                </button>
                <button
                  onClick={() => setWeight((w) => Math.round((w + 2.5) * 10) / 10)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-700"
                >
                  +2.5
                </button>
              </div>
            </div>

            {/* Reps */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-widest text-zinc-500">Reps</span>
                <span className="text-[10px] text-zinc-600">target: {verdict.repRange.min}–{verdict.repRange.max}</span>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {REPS.map((r) => {
                  const isSelected = reps === r;
                  const isTarget   = r >= verdict.repRange.min && r <= verdict.repRange.max;
                  return (
                    <button
                      key={r}
                      onClick={() => setReps(r)}
                      className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-white text-zinc-900 scale-105"
                          : isTarget
                          ? "bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                          : "bg-zinc-800/60 text-zinc-500 hover:bg-zinc-800"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>


            {/* est 1RM preview — Epley formula on the lb input. */}
            <div className="mb-4">
              <span className="text-[10px] text-zinc-600">
                est. 1RM: <span className="text-zinc-400 font-semibold">{Math.round(weight * (1 + reps / 30))} lb</span>
                {inRange && <span className="text-zinc-600 ml-1">· in target range</span>}
              </span>
            </div>

            <div className="relative">
              <button
                onClick={handleLog}
                disabled={logging || !activeGymId}
                className={`w-full py-3.5 bg-white hover:bg-zinc-100 disabled:bg-zinc-800 rounded-xl text-sm font-bold text-zinc-900 disabled:text-zinc-600 transition-colors ${isPr ? "anim-pr-flash" : ""}`}
              >
                {logging ? "Logging…" : `Log Set ${todaySets.length + 1}`}
              </button>
              <ConfettiBurst trigger={setBurst} count={isPr ? 36 : 20} spread={isPr ? 140 : 90} />
            </div>
            {flash && (
              <p className={`text-xs text-center mt-2 ${isPr ? "text-amber-300 font-semibold tracking-wide" : "text-green-400"}`}>
                {flash}
              </p>
            )}
          </Card>

          {/* Trend */}
          {trendData.length > 1 && (
            <Card>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Est. 1RM Trend</span>
              <div className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <Line
                      type="monotone"
                      dataKey="est1rm"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: "#fff" }}
                    />
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200">
                            {`Session ${payload[0].payload.session}: ${kgToLb(payload[0].value as number).toFixed(0)} lb`}
                          </div>
                        ) : null
                      }
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Session History */}
          {pastSessions.length > 0 && (
            <Card>
              <span className="text-[10px] uppercase tracking-widest text-zinc-500 block mb-3">— Session History</span>
              <div className="space-y-0">
                {pastSessions.slice(0, 6).map((sess) => (
                  <div
                    key={sess.date}
                    className="flex items-center justify-between py-2.5 border-b border-[#1f1f1f] last:border-0"
                  >
                    <span className="text-xs text-zinc-500 w-16">
                      {new Date(sess.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className="text-sm font-semibold text-zinc-200 flex-1 text-center">
                      {kgToLb(sess.bestSet.weight_kg).toFixed(0)}lb × {sess.bestSet.reps}
                    </span>
                    <div className="text-right">
                      <p className="text-[10px] text-zinc-600">{kgToLb(sess.topEst1rm).toFixed(0)}lb 1RM</p>
                      <p className="text-[10px] text-zinc-700">{kgToLb(sess.volume).toFixed(0).toLocaleString()}lb vol</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {/* Weekly volume — always visible */}
      <WeeklyVolumeCard />

      {/* No exercise selected */}
      {!activeExercise && (
        <div className="text-center py-8 text-zinc-600 text-sm">
          Select an exercise above to start tracking
        </div>
      )}
    </div>
  );
}
