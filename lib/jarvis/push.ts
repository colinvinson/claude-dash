// Web Push helpers. The chat route + insights/briefing routes can call
// `pushToUser(userId, payload)` to send a notification to every subscribed
// device the user has registered.
//
// VAPID keys must be set in env:
//   NEXT_PUBLIC_VAPID_PUBLIC_KEY   (also exposed to the client for subscription)
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT  e.g. "mailto:colin@example.com" (required by web-push spec)

import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/server";

let configured = false;
function configure() {
  if (configured) return;
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subj = process.env.VAPID_SUBJECT;
  if (!pub || !priv || !subj) {
    throw new Error("Push not configured — missing VAPID env vars");
  }
  webpush.setVapidDetails(subj, pub, priv);
  configured = true;
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;       // path to open on click; default /home
  tag?: string;       // dedupe key
  renotify?: boolean; // re-buzz even if a notification with this tag is already shown
  data?: Record<string, unknown>;
};

export async function pushToUser(userId: string, payload: PushPayload): Promise<{ sent: number; failed: number }> {
  configure();
  const service = createServiceClient();
  const { data: subs } = await service
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;
  const body = JSON.stringify(payload);

  for (const s of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        body,
      );
      sent += 1;
      void service.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
    } catch (err) {
      failed += 1;
      const e = err as { statusCode?: number };
      // 404/410 = subscription is dead (user revoked perm / cleared browser data). Prune.
      if (e.statusCode === 404 || e.statusCode === 410) {
        await service.from("push_subscriptions").delete().eq("id", s.id);
      }
    }
  }
  return { sent, failed };
}
