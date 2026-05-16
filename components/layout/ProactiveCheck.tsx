"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Background side-effect hook that USED to render a top-of-screen insight
// banner. The banner was a duplicate surface — WhatMattersCard already
// shows the latest jarvis_insight inline, with consistent styling. This
// component now only fires the analyze endpoint (which generates fresh
// proactive insights + TodaysCall) and seeds the user on first load.
//
// Renders nothing. Kept as a top-level mount so the side effects fire
// once per app session.

export default function ProactiveCheck() {
  const supabase = createClient();

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
      void fetch("/api/jarvis/analyze", { method: "POST" }).catch(() => {});
    }
    check();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetch("/api/seed", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
