// Service worker for the Rowan dashboard PWA.
// Currently handles two things:
//   1. Web Push receipt → notification display
//   2. Notification click → focus existing tab or open /home
//
// Kept intentionally minimal. No offline caching, no background sync.
// Add those when there's a specific reason — every line here runs on every
// push receipt and notification click.

self.addEventListener("install", () => {
  // Activate immediately on first install so push works right away.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // Take over any open tabs as soon as we activate.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Jarvis", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Jarvis";
  const opts = {
    body:    payload.body  || "",
    icon:    "/icon-192.png",
    badge:   "/icon-192.png",
    tag:     payload.tag   || "jarvis",   // dedupe consecutive notifications with same tag
    data:    { url: payload.url || "/home", ...(payload.data || {}) },
    vibrate: [120, 60, 120],
    // Auto-replace previous notification with the same tag (no clutter).
    renotify: !!payload.renotify,
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      // Reuse an existing tab if there's one open.
      for (const w of wins) {
        if (w.url.includes(self.location.origin)) {
          w.focus();
          if ("navigate" in w) {
            try { w.navigate(targetUrl); } catch {}
          }
          return;
        }
      }
      // Otherwise open a new tab.
      return self.clients.openWindow(targetUrl);
    }),
  );
});
