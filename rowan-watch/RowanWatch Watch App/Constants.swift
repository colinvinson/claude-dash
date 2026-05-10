import Foundation

// Fill these in before building. See rowan-watch/README.md for where to find each value.
enum Constants {
    // Your Next.js app base URL.
    // Local dev: use your Mac's IP on LAN, e.g. "http://192.168.1.42:3000"
    // Production: your Vercel URL, e.g. "https://rowan-dashboard.vercel.app"
    static let apiBase = "https://YOUR_VERCEL_URL.vercel.app"

    // The WORKOUT_API_KEY value you added to .env.local
    static let apiKey  = "YOUR_WORKOUT_API_KEY"

    // Your Supabase user UUID — Supabase Dashboard → Authentication → Users → copy your UUID
    static let userId  = "YOUR_SUPABASE_USER_ID"
}
