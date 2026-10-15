"use client";

import clsx from "clsx";
import { t } from "@/i18n";
import { useUi, type SideTab } from "@/store/ui-store";
import { CircuitsPanel } from "./lessons/CircuitsPanel";
import { ExercisesPanel } from "./lessons/ExercisesPanel";
import { Library } from "./Library";

const TABS: { id: SideTab; label: "library.title" | "lessons.circuits" | "lessons.exercises" }[] = [
  { id: "parts", label: "library.title" },
  { id: "circuits", label: "lessons.circuits" },
  { id: "exercises", label: "lessons.exercises" },
];

/** Painel da esquerda: peças, circuitos prontos e exercícios. */
export function SidePanel() {
  const tab = useUi((s) => s.sideTab);
  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-panel" aria-label={t("lessons.panel")}>
      <div className="flex border-b border-line px-1" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            id={`side-${x.id}`}
            aria-selected={tab === x.id}
            onClick={() => useUi.getState().setSideTab(x.id)}
            className={clsx(
              "-mb-px flex-1 border-b-2 px-1 py-2 text-xs font-semibold",
              tab === x.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t(x.label)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1" role="tabpanel" aria-labelledby={`side-${tab}`}>
        {tab === "parts" && <Library />}
        {tab === "circuits" && <CircuitsPanel />}
        {tab === "exercises" && <ExercisesPanel />}
      </div>
    </aside>
  );
}
