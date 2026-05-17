"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { PALETTE, ICON, TYPE } from "@/lib/design-tokens";

// App-route error boundary. Catches any runtime error in a page or its
// nested components and renders a useful message instead of Next.js's
// generic "this page couldn't load." Includes the digest + message so
// when something breaks Sir can screenshot it and we know exactly
// what's wrong. The Reset button calls the boundary's reset to
// retry the render.

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to console for client-side debugging.
    // eslint-disable-next-line no-console
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={ICON.md} style={{ color: PALETTE.danger }} />
        <h1 className={TYPE.headline}>Something broke on this surface.</h1>
      </div>
      <p className="text-sm text-zinc-400 mb-4 leading-relaxed">
        A runtime error stopped this page from rendering. The reset button retries; if it keeps failing, screenshot the details below.
      </p>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 mb-4">
        <div className={`${TYPE.label} mb-1`}>Error</div>
        <pre className="text-[11px] text-zinc-200 whitespace-pre-wrap break-words font-mono leading-relaxed">
          {error.message || "(no message)"}
        </pre>
        {error.digest && (
          <div className="mt-2 text-[10px] text-zinc-600 tabular-nums">
            digest · {error.digest}
          </div>
        )}
      </div>

      <button
        onClick={reset}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-zinc-900 font-bold text-sm hover:opacity-90"
      >
        <RotateCw size={ICON.sm} /> Try again
      </button>
    </div>
  );
}
