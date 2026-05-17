"use client";

import { useEffect, useId, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// One shared helper for every realtime subscription in the app. Fixes
// the "cannot add postgres_changes callbacks after subscribe()" footgun
// that bit /businesses and /finances: multiple components on the same
// page calling the same data hook would each subscribe to the same
// channel name; Supabase returns the existing (already-JOINED) channel,
// the second .on() throws and kills the page.
//
// Each call to this helper gets a useId()-stable unique channel suffix,
// so collisions are impossible even if N components mount the same
// hook simultaneously. onChange is captured by ref so changing its
// reference between renders does NOT re-subscribe — that prevented
// stale-closure bugs in the old pattern but at the cost of constant
// subscribe/unsubscribe cycles.

type Opts = {
  // The base channel name (e.g. `businesses:${userId}`). The unique
  // suffix is appended automatically.
  channelBase: string;
  // The table to subscribe to (postgres_changes).
  table:       string;
  // Optional Realtime filter (e.g. `user_id=eq.${userId}`).
  filter?:     string;
  // Optional — defaults true. Pass false to skip the subscription
  // (e.g. while waiting for a dependent value like userId to resolve).
  enabled?:    boolean;
  // Callback fired on every matching change. Re-binds via ref each
  // render so closure stays current without re-subscribing.
  onChange:    () => void;
};

export function useRealtimeSubscription({
  channelBase,
  table,
  filter,
  enabled = true,
  onChange,
}: Opts) {
  const instanceId  = useId();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!enabled || !channelBase) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`${channelBase}:${instanceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table, ...(filter ? { filter } : {}) },
        () => onChangeRef.current(),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelBase, table, filter, enabled, instanceId]);
}
