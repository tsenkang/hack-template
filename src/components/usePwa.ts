"use client";

import { useEffect } from "react";
import { t } from "@/i18n";
import { useToasts } from "@/store/toast-store";

/**
 * Registra o service worker (só no site publicado) e avisa quando há versão nova:
 * "Nova versão disponível — Recarregar".
 */
export function usePwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let reloading = false;
    // Na primeira instalação o service worker assume a página sem recarregar; só recarrega numa atualização.
    const hadController = !!navigator.serviceWorker.controller;
    const offerUpdate = (worker: ServiceWorker) => {
      useToasts.getState().show(t("pwa.update"), "info", {
        label: t("pwa.reload"),
        run: () => worker.postMessage("skip-waiting"),
      });
    };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading || !hadController) return;
      reloading = true;
      window.location.reload();
    });
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) offerUpdate(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed" && navigator.serviceWorker.controller) offerUpdate(w);
          });
        });
      })
      .catch(() => undefined);
  }, []);
}
