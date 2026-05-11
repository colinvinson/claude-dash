"use client";

import { useEffect, useRef } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useToast } from "@/components/ui/Toast";
import { haptic } from "@/lib/haptic";

const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];
const STORAGE_KEY = "rowan-celebrated-streaks";

function loadCelebrated(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveCelebrated(s: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  } catch { /* localStorage can fail in private mode */ }
}

function messageFor(n: number): string {
  if (n >= 365) return `${n} day streak. A YEAR of consistency.`;
  if (n >= 100) return `${n} day streak — triple digits.`;
  if (n >= 50)  return `${n} day streak. Half a hundred.`;
  if (n >= 30)  return `${n} day streak — a full month locked in.`;
  if (n >= 14)  return `${n} day streak. Two weeks straight.`;
  if (n >= 7)   return `${n} day streak — first week clean.`;
  return `${n} day streak.`;
}

export default function StreakCelebration() {
  const { streak } = useGoals();
  const { toast } = useToast();
  const lastChecked = useRef<number>(-1);

  useEffect(() => {
    if (streak <= 0 || streak === lastChecked.current) return;
    lastChecked.current = streak;

    const milestone = MILESTONES.find((m) => m === streak);
    if (!milestone) return;

    const celebrated = loadCelebrated();
    if (celebrated.has(milestone)) return;

    // Fire celebration
    haptic("success");
    toast(messageFor(milestone), "celebration");
    celebrated.add(milestone);
    saveCelebrated(celebrated);
  }, [streak, toast]);

  return null;
}
