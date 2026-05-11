"use client";

import { useState, useRef } from "react";
import { Camera, Barcode, Type, Loader2 } from "lucide-react";
import { useProtein, type ProteinSource } from "@/hooks/useProtein";
import { useToast } from "@/components/ui/Toast";
import ProteinScanner from "./ProteinScanner";
import ProteinConfirm from "./ProteinConfirm";

type Mode = "manual" | "photo" | "barcode";

type AnalysisResult = {
  food_name: string;
  protein_g: number;
  score: number;
  reasoning: string;
  source: ProteinSource;
  barcode?: string | null;
};

type TileProps = {
  expanded: boolean;
  onToggle: () => void;
};

export default function ProteinTile({ expanded, onToggle }: TileProps) {
  const { totalToday, target, pctOfTarget, logProtein } = useProtein();
  const { toast } = useToast();
  const [mode, setMode]               = useState<Mode>("manual");
  const [proteinInput, setProteinInput] = useState("");
  const [foodNameInput, setFoodNameInput] = useState("");
  const [submitting, setSubmitting]   = useState(false);
  const [saved, setSaved]             = useState(false);
  const [scanning, setScanning]       = useState(false);
  const [analyzing, setAnalyzing]     = useState(false);
  const [analysis, setAnalysis]       = useState<AnalysisResult | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const fileRef                       = useRef<HTMLInputElement>(null);

  async function handleManualSubmit() {
    const grams = Number(proteinInput);
    if (!grams || grams <= 0) return;
    setSubmitting(true);

    let ai_score: number | null = null;
    let ai_reasoning: string | null = null;
    if (foodNameInput.trim().length > 0) {
      try {
        const res = await fetch("/api/protein/score-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ food_name: foodNameInput.trim(), protein_g: grams }),
        });
        if (res.ok) {
          const data = await res.json() as { score: number; reasoning: string };
          ai_score = data.score;
          ai_reasoning = data.reasoning;
        }
      } catch { /* score failure is non-fatal */ }
    }

    await logProtein({
      protein_g:    grams,
      food_name:    foodNameInput.trim() || null,
      source:       "manual",
      ai_score,
      ai_reasoning,
    });

    toast(`Logged ${grams}g protein`);
    setProteinInput("");
    setFoodNameInput("");
    setSubmitting(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handlePhotoSelected(file: File) {
    setAnalyzing(true);
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/protein/analyze-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64, media_type: file.type }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Analysis failed");
      const data = await res.json() as Omit<AnalysisResult, "source" | "barcode">;
      setAnalysis({ ...data, source: "photo" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleBarcodeDetected(barcode: string) {
    setScanning(false);
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch("/api/protein/analyze-barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Product not found");
      const data = await res.json() as Omit<AnalysisResult, "source"> & { barcode?: string };
      setAnalysis({ ...data, source: "barcode", barcode });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleConfirmLog(final: {
    protein_g: number; food_name: string; ai_score: number; ai_reasoning: string;
    source: ProteinSource; barcode?: string | null;
  }) {
    await logProtein(final);
    toast(`Logged ${final.protein_g}g — ${final.food_name}`);
    setAnalysis(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  const barColor =
    pctOfTarget >= 80 ? "#10b981" :
    pctOfTarget >= 50 ? "#f59e0b" :
                        "#a1a1aa";

  return (
    <>
      <div
        onClick={onToggle}
        className="flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">🥩</span>
          <span className="text-sm font-medium text-zinc-100">Protein</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tabular-nums" style={{ color: barColor }}>
            {Math.round(totalToday)}g <span className="text-zinc-600">/ {target}g</span>
          </span>
        </div>
      </div>

      {expanded && (
        <div className="px-3 pb-3 -mt-1 space-y-3" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderTop: "none", borderRadius: "0 0 12px 12px" }}>
          {/* Mode tabs */}
          <div className="flex gap-1 pt-3">
            {(["manual", "photo", "barcode"] as Mode[]).map((m) => {
              const active = mode === m;
              const Icon = m === "manual" ? Type : m === "photo" ? Camera : Barcode;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="flex-1 py-2 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  style={{
                    background: active ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                    color:      active ? "#fca5a5"            : "#a1a1aa",
                    border: `1px solid ${active ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  <Icon size={12} />
                  {m === "manual" ? "Type" : m === "photo" ? "Photo" : "Barcode"}
                </button>
              );
            })}
          </div>

          {mode === "manual" && (
            <div className="space-y-2">
              <input
                type="number"
                inputMode="decimal"
                placeholder="grams"
                value={proteinInput}
                onChange={(e) => setProteinInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white border border-zinc-800 focus:border-zinc-700 outline-none"
              />
              <input
                type="text"
                placeholder="food name (optional, gets scored)"
                value={foodNameInput}
                onChange={(e) => setFoodNameInput(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-transparent text-white border border-zinc-800 focus:border-zinc-700 outline-none"
              />
              <button
                onClick={handleManualSubmit}
                disabled={submitting || !proteinInput}
                className="w-full py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {submitting ? "Logging…" : saved ? "✓ Logged" : "Log protein"}
              </button>
            </div>
          )}

          {mode === "photo" && (
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhotoSelected(f);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={analyzing}
                className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {analyzing ? <><Loader2 size={14} className="animate-spin" /> Analyzing…</> : <><Camera size={14} /> Take photo</>}
              </button>
              {saved && <p className="text-[11px] text-emerald-400 text-center">✓ Logged</p>}
              {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
            </div>
          )}

          {mode === "barcode" && (
            <div className="space-y-2">
              <button
                onClick={() => setScanning(true)}
                disabled={analyzing}
                className="w-full py-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                {analyzing ? <><Loader2 size={14} className="animate-spin" /> Looking up…</> : <><Barcode size={14} /> Scan barcode</>}
              </button>
              {saved && <p className="text-[11px] text-emerald-400 text-center">✓ Logged</p>}
              {error && <p className="text-[11px] text-red-400 text-center">{error}</p>}
            </div>
          )}
        </div>
      )}

      {scanning && (
        <ProteinScanner
          onDetect={handleBarcodeDetected}
          onClose={() => setScanning(false)}
        />
      )}

      {analysis && (
        <ProteinConfirm
          initial={analysis}
          onLog={handleConfirmLog}
          onCancel={() => setAnalysis(null)}
        />
      )}
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the "data:image/...;base64," prefix
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
