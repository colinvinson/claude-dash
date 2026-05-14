"use client";

// One-time push notification opt-in card. Renders ONLY when:
//   - the browser supports Push API
//   - the user hasn't already subscribed on this device
//   - the user hasn't dismissed the prompt this session
//
// Once subscribed, the card vanishes silently. Service worker (public/sw.js)
// handles actual notification rendering.

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import Card from "@/components/ui/Card";

const DISMISS_KEY = "jarvis-push-prompt-dismissed";

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padded = (b64 + "===".slice(0, (4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

type State =
  | "loading"
  | "unsupported"
  | "needs-prompt"
  | "permission-denied"
  | "subscribed"
  | "dismissed";

export default function PushSubscriber() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (typeof window === "undefined") return;
      const dismissed = sessionStorage.getItem(DISMISS_KEY) === "1";
      if (dismissed) { if (!cancelled) setState("dismissed"); return; }

      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        if (!cancelled) setState("unsupported");
        return;
      }

      try {
        // Register the worker (idempotent).
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          if (!cancelled) setState("subscribed");
          return;
        }
        const perm = Notification.permission;
        if (perm === "denied") {
          if (!cancelled) setState("permission-denied");
          return;
        }
        if (!cancelled) setState("needs-prompt");
      } catch {
        if (!cancelled) setState("unsupported");
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState("permission-denied");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        console.error("[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY not set");
        setState("unsupported");
        return;
      }
      const keyBytes = urlBase64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast through ArrayBuffer for the strict BufferSource union.
        applicationServerKey: keyBytes.buffer as ArrayBuffer,
      });
      const subJson = sub.toJSON();
      const res = await fetch("/api/jarvis/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        console.error("[push] subscribe failed:", await res.text());
        setState("unsupported");
        return;
      }
      setState("subscribed");
    } catch (err) {
      console.error("[push] enable error:", err);
      setState("unsupported");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setState("dismissed");
  }

  if (state === "needs-prompt") {
    return (
      <Card>
        <div className="flex items-start gap-3">
          <Bell size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-zinc-100">Let Jarvis reach out.</p>
            <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
              Notifications surface drift signals, routine reminders, and agent completions without you having to open the app. Recommended for ADHD-friendly use.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={enable}
                disabled={busy}
                className="px-3 py-1.5 bg-white text-zinc-900 rounded-lg text-xs font-semibold disabled:opacity-50"
              >
                {busy ? "Enabling…" : "Enable"}
              </button>
              <button
                onClick={dismiss}
                className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs"
              >
                Not now
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-400">
            <X size={14} />
          </button>
        </div>
      </Card>
    );
  }

  if (state === "permission-denied") {
    return (
      <Card>
        <div className="flex items-center gap-2">
          <BellOff size={14} className="text-zinc-500" />
          <p className="text-[11px] text-zinc-500">
            Notifications blocked. Re-enable in browser settings if you want Jarvis to reach out.
          </p>
        </div>
      </Card>
    );
  }

  return null; // unsupported / subscribed / dismissed → render nothing
}
