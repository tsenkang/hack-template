"use client";

import { BookOpen, GraduationCap, Shapes } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { useLesson } from "@/store/lesson-store";
import { useUi, type SideTab } from "@/store/ui-store";

/** Abre a aba do painel da esquerda (nas telas estreitas, abre a gaveta também). */
function openSide(tab: SideTab) {
  const ui = useUi.getState();
  ui.setSideTab(tab);
  if (window.matchMedia("(max-width: 1023px)").matches) ui.setDrawer("left", true);
  if (tab === "parts") setTimeout(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(), 50);
}

/**
 * Tela inicial (desenho vazio): três caminhos claros, do mais guiado ao mais livre,
 * e os três passos para montar um circuito. Some quando a primeira peça entra.
 */
/** Peça sendo arrastada da biblioteca: a tela inicial sai da frente para a peça poder cair no desenho. */
let dragging = false;
const subscribeDrag = (cb: () => void) => {
  const start = () => ((dragging = true), cb());
  const end = () => ((dragging = false), cb());
  window.addEventListener("dragstart", start);
  window.addEventListener("dragend", end);
  window.addEventListener("drop", end);
  return () => {
    window.removeEventListener("dragstart", start);
    window.removeEventListener("dragend", end);
    window.removeEventListener("drop", end);
  };
};

export function StartPanel() {
  const isDragging = useSyncExternalStore(subscribeDrag, () => dragging, () => false);
  const choices = [
    {
      icon: BookOpen,
      title: t("start.exampleTitle"),
      text: t("start.exampleText"),
      run: () => {
        openSide("circuits");
        useLesson.getState().openCircuit("p-direct-sa");
      },
      testId: "start-example",
      primary: true,
    },
    { icon: GraduationCap, title: t("start.exerciseTitle"), text: t("start.exerciseText"), run: () => openSide("exercises"), testId: "start-exercise" },
    { icon: Shapes, title: t("start.blankTitle"), text: t("start.blankText"), run: () => openSide("parts"), testId: "start-blank" },
  ];
  if (isDragging) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-y-auto p-4">
      <div className="pointer-events-auto w-full max-w-xl rounded-xl border border-line bg-panel p-5 shadow-sm" data-testid="start-panel">
        <h2 className="text-lg font-semibold text-fg">{t("start.title")}</h2>
        <p className="mt-1 text-sm text-muted">{t("start.subtitle")}</p>
        <ul className="mt-4 grid gap-2">
          {choices.map(({ icon: Icon, title, text, run, testId, primary }) => (
            <li key={testId}>
              <button
                type="button"
                onClick={run}
                data-testid={testId}
                className={
                  primary
                    ? "flex w-full items-start gap-3 rounded-lg border border-accent bg-accent-soft p-3 text-left hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent"
                    : "flex w-full items-start gap-3 rounded-lg border border-line p-3 text-left hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent"
                }
              >
                <Icon size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-fg">{title}</span>
                  <span className="block text-xs text-muted">{text}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <h3 className="mt-5 text-xs font-semibold tracking-wide text-muted uppercase">{t("start.howTitle")}</h3>
        <ol className="mt-2 grid gap-1.5 text-sm text-fg sm:grid-cols-3">
          {[t("start.step1"), t("start.step2"), t("start.step3")].map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-panel">{i + 1}</span>
              <span className="text-xs leading-snug">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
