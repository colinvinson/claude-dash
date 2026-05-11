"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Check, AlertCircle, Sparkles } from "lucide-react";

type ToastKind = "success" | "error" | "info" | "celebration";

type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

type Ctx = {
  toast: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<Ctx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Allow calls without a provider — silently no-op
    return { toast: () => {} } as Ctx;
  }
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, kind === "celebration" ? 3500 : 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4"
        style={{ top: "calc(env(safe-area-inset-top) + 60px)" }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const config = {
    success:     { icon: Check,        color: "#34d399", bg: "rgba(16,185,129,0.14)", border: "rgba(16,185,129,0.30)" },
    error:       { icon: AlertCircle,  color: "#fca5a5", bg: "rgba(239,68,68,0.14)",  border: "rgba(239,68,68,0.30)"  },
    info:        { icon: Check,        color: "#a1a1aa", bg: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.10)" },
    celebration: { icon: Sparkles,     color: "#fbbf24", bg: "rgba(251,191,36,0.16)", border: "rgba(251,191,36,0.35)" },
  }[toast.kind];

  const Icon = config.icon;

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-full pointer-events-auto max-w-full"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
        backdropFilter: "blur(28px) saturate(180%)",
        WebkitBackdropFilter: "blur(28px) saturate(180%)",
        boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
        transform: shown ? "translateY(0) scale(1)" : "translateY(-12px) scale(0.94)",
        opacity: shown ? 1 : 0,
        transition: "transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease",
      }}
    >
      <Icon size={14} strokeWidth={2.5} className="flex-shrink-0" />
      <span className="text-sm font-semibold whitespace-nowrap overflow-hidden text-ellipsis">{toast.message}</span>
    </div>
  );
}
