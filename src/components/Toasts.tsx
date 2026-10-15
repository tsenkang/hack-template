"use client";

import clsx from "clsx";
import { useToasts } from "@/store/toast-store";

/** Avisos rápidos no canto inferior esquerdo. Lidos por leitores de tela (aria-live). */
export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-50 flex flex-col gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className={clsx(
            "pointer-events-auto max-w-sm rounded-md border px-3 py-2 text-sm shadow-lg",
            toast.tone === "error" ? "border-danger bg-panel text-danger" : "border-line bg-panel text-fg",
          )}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
