"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp } from "lucide-react";
import { t, tDynamic, type I18nKey } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { useUi, type BottomTab } from "@/store/ui-store";
import { IconButton } from "./IconButton";

const TABS: { id: BottomTab; label: I18nKey }[] = [
  { id: "charts", label: "bottom.charts" },
  { id: "phases", label: "bottom.phases" },
  { id: "parts", label: "bottom.parts" },
  { id: "warnings", label: "bottom.warnings" },
];

/** Painel de baixo: gráficos, diagrama de fases, lista de peças e avisos. */
export function BottomPanel() {
  const { bottomOpen, bottomTab, setBottomTab, toggleBottom } = useUi();

  return (
    <section className="flex min-h-0 flex-col border-t border-line bg-panel" aria-label={t("bottom.parts")}>
      <div className="flex items-center gap-1 px-2" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={bottomTab === tab.id}
            aria-controls="bottom-panel-content"
            onClick={() => setBottomTab(tab.id)}
            className={clsx(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium",
              bottomTab === tab.id && bottomOpen ? "border-accent text-accent" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t(tab.label)}
          </button>
        ))}
        <span className="flex-1" />
        <IconButton label={bottomOpen ? t("bottom.collapse") : t("bottom.expand")} onClick={toggleBottom}>
          {bottomOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </IconButton>
      </div>
      {bottomOpen && (
        <div
          id="bottom-panel-content"
          role="tabpanel"
          aria-labelledby={`tab-${bottomTab}`}
          className="h-44 overflow-y-auto border-t border-line p-3 text-sm"
        >
          {bottomTab === "parts" ? (
            <PartsList />
          ) : (
            <p className="text-muted">
              {t(bottomTab === "charts" ? "bottom.chartsEmpty" : bottomTab === "phases" ? "bottom.phasesEmpty" : "bottom.warningsEmpty")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

/** Lista de peças do projeto inteiro (todas as abas), agrupada por tipo. */
function PartsList() {
  const project = useEditor((s) => s.project);
  const rows = new Map<string, { qty: number; labels: string[] }>();
  for (const circuit of project.circuits) {
    for (const comp of circuit.components) {
      const row = rows.get(comp.type) ?? { qty: 0, labels: [] };
      row.qty++;
      if (comp.label) row.labels.push(comp.label);
      rows.set(comp.type, row);
    }
  }

  if (rows.size === 0) return <p className="text-muted">{t("bottom.partsEmpty")}</p>;

  return (
    <table className="w-full text-left text-sm" data-testid="parts-list">
      <thead className="text-xs text-muted">
        <tr>
          <th className="w-14 py-1 font-medium">{t("bottom.colQty")}</th>
          <th className="py-1 font-medium">{t("bottom.colPart")}</th>
          <th className="py-1 font-medium">{t("bottom.colLabels")}</th>
        </tr>
      </thead>
      <tbody>
        {[...rows.entries()].map(([type, { qty, labels }]) => (
          <tr key={type} className="border-t border-line">
            <td className="py-1 tabular-nums">{qty}</td>
            <td className="py-1">{tDynamic(`parts.${type}.name`)}</td>
            <td className="py-1 text-muted">{labels.join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
