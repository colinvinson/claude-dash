"use client";

import { useState } from "react";
import { Bot, X } from "lucide-react";
import OverseerChat from "@/components/overseer/OverseerChat";

export default function FloatingChat() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Bubble button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-40 flex items-center justify-center w-12 h-12 rounded-full transition-transform active:scale-95"
          style={{
            right: 18,
            bottom: "calc(env(safe-area-inset-bottom) + 88px)",  // clear the floating nav
            background: "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%), rgba(20,20,24,0.75)",
            backdropFilter: "blur(28px) saturate(180%)",
            WebkitBackdropFilter: "blur(28px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.14)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
            color: "#fafafa",
          }}
          aria-label="Open Overseer"
        >
          <Bot size={18} />
        </button>
      )}

      {/* Full-screen chat overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[80] flex flex-col anim-fade"
          style={{
            background: "rgba(5,5,6,0.97)",
            backdropFilter: "blur(28px) saturate(160%)",
            WebkitBackdropFilter: "blur(28px) saturate(160%)",
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "calc(env(safe-area-inset-bottom) + 96px)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Bot size={16} className="text-zinc-300" />
              <span className="text-sm font-semibold text-zinc-100">Overseer</span>
            </div>
            <button onClick={() => setOpen(false)} className="text-zinc-400 hover:text-white">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <OverseerChat />
          </div>
        </div>
      )}
    </>
  );
}
