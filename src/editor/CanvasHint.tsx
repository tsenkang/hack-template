"use client";

import { Lightbulb, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t, type I18nKey } from "@/i18n";
import { selectActiveCircuit, useEditor } from "@/store/editor-store";

const KEY = "fluxolab:hints";

export function hintsEnabled() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHintsEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // só nesta sessão
  }
  window.dispatchEvent(new Event("fluxolab:hints"));
}

/**
 * Dica do próximo passo, numa faixa entre o desenho e o painel de baixo (não cobre o circuito): muda conforme o que a pessoa está fazendo
 * (reconhecer em vez de lembrar). Dá para fechar; a paleta Ctrl+K liga de novo.
 */
const subscribe = (cb: () => void) => {
  window.addEventListener("fluxolab:hints", cb);
  return () => window.removeEventListener("fluxolab:hints", cb);
};

export function CanvasHint({ simulating }: { simulating: boolean }) {
  const on = useSyncExternalStore(subscribe, hintsEnabled, () => true);
  const circuit = useEditor(selectActiveCircuit);
  const selected = useEditor((s) => s.selection.length);
  if (!on) return null;

  let key: I18nKey | null;
  if (simulating) key = "hints.simulating";
  else if (circuit.components.length === 0) key = null;
  else if (selected > 0) key = "hints.selected";
  else if (circuit.connections.length === 0) key = "hints.connect";
  else key = "hints.ready";
  if (!key) return null;

  return (
    <p className="flex items-start gap-2 border-t border-line bg-panel px-3 py-1.5 text-xs text-fg" role="status" data-testid="canvas-hint">
      <Lightbulb size={14} className="mt-px shrink-0 text-accent" aria-hidden />
      <span className="flex-1">{t(key)}</span>
      <button
        type="button"
        className="-my-1 rounded p-1 text-muted hover:bg-hover hover:text-fg"
        aria-label={t("hints.hide")}
        title={t("hints.hide")}
        onClick={() => setHintsEnabled(false)}
      >
        <X size={12} />
      </button>
    </p>
  );
}
