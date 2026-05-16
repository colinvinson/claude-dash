import Link from "next/link";

// 404 — matches the app's dark aesthetic. Three quiet links back to the
// surfaces Sir actually wants to be on. Designed, not the default Next.js
// blank-page-with-error feel.

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: "#050506" }}>
      <div className="max-w-sm w-full text-center anim-fade-up">
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 mb-2">— 404</div>
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Nothing here.</h1>
        <p className="text-sm text-zinc-500 leading-relaxed mb-8">
          That URL doesn&apos;t map to a surface in the app. Either it moved or Sir wandered off.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/home"
            className="block py-2.5 rounded-xl bg-white text-zinc-900 text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Back to Home
          </Link>
          <Link
            href="/gym"
            className="block py-2.5 rounded-xl border border-zinc-800 text-zinc-300 text-sm font-medium hover:border-zinc-700 transition-colors"
          >
            Open Gym
          </Link>
          <Link
            href="/schedule"
            className="block py-2.5 rounded-xl border border-zinc-800 text-zinc-300 text-sm font-medium hover:border-zinc-700 transition-colors"
          >
            Today&apos;s Schedule
          </Link>
        </div>
      </div>
    </div>
  );
}
