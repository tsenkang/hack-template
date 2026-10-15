"use client";

import clsx from "clsx";
import { t } from "@/i18n";
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
          {toast.action && (
            <span className="ml-3 inline-flex gap-2">
              <button
                type="button"
                className="font-semibold text-accent hover:underline"
                onClick={() => {
                  toast.action!.run();
                  useToasts.getState().dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
              <button type="button" className="text-muted hover:text-fg" aria-label={t("dialogs.close")} onClick={() => useToasts.getState().dismiss(toast.id)}>
                ×
              </button>
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
