"use client";

import { t } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { useSim } from "@/store/sim-store";

/** Amostra de linha usada na legenda. */
function Sample({ className, flow }: { className: string; flow?: boolean }) {
  return (
    <svg width="24" height="10" aria-hidden className="shrink-0">
      <path d="M2 5 H22" className={className} />
      {flow && <path d="M2 5 H22" className="wire-flow" style={{ animationDuration: "0.9s" }} />}
    </svg>
  );
}

function Item({ sample, label }: { sample: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {sample}
      {label}
    </span>
  );
}

/**
 * Faixa da simulação (entre as abas e o desenho, sem cobrir o circuito):
 * estado, relógio e legenda das cores das linhas, sempre visível.
 */
export function SimLegend() {
  const time = useSim((s) => s.snapshot?.time ?? 0);
  const lagging = useSim((s) => s.lagging);
  const status = useSim((s) => s.status);
  const hasElectric = useEditor((s) => s.project.circuits.some((c) => c.components.some((k) => k.type.startsWith("elec."))));
  const seconds = time.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-panel px-3 py-1.5 text-xs text-muted"
      data-testid="sim-legend"
      title={t("sim.hint")}
    >
      <span className="font-medium text-fg">
        {status === "paused" ? t("sim.paused") : t("sim.running")} · <span className="tabular-nums">{t("sim.time", { s: seconds })}</span>
      </span>
      <Item sample={<Sample className="wire wire-pressurized legend-pressure" flow />} label={t("sim.legendPressure")} />
      <Item sample={<Sample className="wire wire-empty" />} label={t("sim.legendEmpty")} />
      <Item sample={<Sample className="wire wire-pilot wire-empty" />} label={t("sim.legendPilot")} />
      {hasElectric && (
        <>
          <Item sample={<Sample className="wire wire-current" flow />} label={t("sim.legendCurrent")} />
          <Item sample={<Sample className="wire wire-live" />} label={t("sim.legendVoltage")} />
        </>
      )}
      {lagging && <span className="text-danger">{t("sim.lagging")}</span>}
    </div>
  );
}
