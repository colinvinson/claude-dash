"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail]   = useState("");
  const [sent,  setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function sendLink() {
    if (!email.trim()) return;
    setLoading(true);
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4 select-none">✦</div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Rowan</h1>
          <p className="text-sm text-zinc-500 mt-1">Personal performance dashboard</p>
        </div>

        {!sent ? (
          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendLink()}
              placeholder="your@email.com"
              autoFocus
              className="w-full bg-[#111111] border border-[#1f1f1f] rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-700 text-sm transition-colors"
            />
            <button
              onClick={sendLink}
              disabled={loading || !email.trim()}
              className="w-full py-3 bg-white text-zinc-900 rounded-xl text-sm font-semibold hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Sending…" : "Send magic link"}
            </button>
          </div>
        ) : (
          <div className="text-center bg-[#111111] border border-[#1f1f1f] rounded-2xl p-8">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-sm font-semibold text-zinc-100">Check your email</p>
            <p className="text-xs text-zinc-500 mt-1">
              We sent a link to <span className="text-zinc-300">{email}</span>
            </p>
            <button
              onClick={() => setSent(false)}
              className="mt-4 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Wrong email? Go back
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
