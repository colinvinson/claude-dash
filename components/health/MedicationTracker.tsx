"use client";

import { useMedications } from "@/hooks/useMedications";
import Card from "@/components/ui/Card";
import SectionLabel from "@/components/layout/SectionLabel";
import { Pill, Zap } from "lucide-react";

export default function MedicationTracker() {
  const { concertaTaken, concertaTakenAt, logConcerta } = useMedications();

  const takenTime = concertaTakenAt
    ? new Date(concertaTakenAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div>
      <SectionLabel>Concerta Tracker</SectionLabel>
      <Card>
        <div className="flex items-start gap-2 mb-3">
          <Pill size={14} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Concerta 18mg</span>
            <p className="text-sm font-semibold text-zinc-100">Medication tracker</p>
            <p className="text-xs text-zinc-500">Tap when you take it. Updates every hour with what stage you&apos;re in.</p>
          </div>
        </div>

        {!concertaTaken ? (
          <button
            onClick={logConcerta}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold text-white transition-colors"
          >
            <Zap size={14} />
            I just took my Concerta
          </button>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600/20 border border-blue-600/30 rounded-xl">
            <span className="text-sm font-semibold text-blue-400">✓ Taken at {takenTime}</span>
          </div>
        )}

        <p className="text-[10px] text-zinc-600 mt-2 text-center">
          ⚠ Generic pharmacokinetics. Your real timeline may vary. Not medical advice.
        </p>
      </Card>
    </div>
  );
}
