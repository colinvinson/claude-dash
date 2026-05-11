"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const CODE_LENGTH = 4;

export default function LoginPage() {
  const router  = useRouter();
  const [digits,  setDigits]   = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [error,   setError]    = useState<string | null>(null);
  const [loading, setLoading]  = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  function handleChange(idx: number, val: string) {
    const digit = val.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[idx] = digit;
    setDigits(next);
    setError(null);

    if (digit && idx < CODE_LENGTH - 1) {
      refs.current[idx + 1]?.focus();
    }

    if (next.every((d) => d !== "") && next.join("").length === CODE_LENGTH) {
      submit(next.join(""));
    }
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (pasted.length === CODE_LENGTH) {
      e.preventDefault();
      setDigits(pasted.split(""));
      submit(pasted);
    }
  }

  async function submit(code: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      let bodyText = "";
      try { bodyText = await res.text(); } catch { /* ignore */ }

      if (!res.ok) {
        let msg = "Invalid code";
        try {
          const data = JSON.parse(bodyText);
          msg = data.error ?? `HTTP ${res.status}`;
        } catch {
          msg = `HTTP ${res.status}: ${bodyText.slice(0, 80) || "no response body"}`;
        }
        setError(msg);
        setDigits(Array(CODE_LENGTH).fill(""));
        refs.current[0]?.focus();
        setLoading(false);
        return;
      }

      router.push("/home");
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Network error";
      setError(msg);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#09090b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4 select-none">✦</div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Rowan</h1>
          <p className="text-sm text-zinc-500 mt-1">Enter your access code</p>
        </div>

        <div className="flex justify-center gap-3 mb-4">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={1}
              value={d}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={loading}
              className="w-14 h-16 bg-[#111111] border border-[#1f1f1f] rounded-xl text-center text-2xl font-bold text-zinc-100 outline-none focus:border-zinc-600 transition-colors disabled:opacity-50"
            />
          ))}
        </div>

        {error && (
          <p className="text-center text-xs text-red-400">{error}</p>
        )}
        {loading && !error && (
          <p className="text-center text-xs text-zinc-500">Signing in…</p>
        )}
      </div>
    </div>
  );
}
