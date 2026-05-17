import { createBrowserClient } from "@supabase/ssr";

// Singleton browser client. Supabase's realtime layer keeps an internal
// channel registry keyed by channel name + client identity — if every
// hook call constructs a fresh client, the cleanup from the previous
// render uses a different client than the one that created the channel,
// `removeChannel` no-ops, and the next render's `.channel(name)` returns
// the still-subscribed channel. Then `.on()` on an already-JOINED
// channel throws synchronously and kills the page render.
//
// Memoizing module-side ensures every hook in the app shares one client
// + one realtime registry. Standard pattern for Next.js + Supabase SSR
// browser clients.

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!_client) {
    _client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _client;
}
