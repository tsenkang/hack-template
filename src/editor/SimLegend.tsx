"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { t } from "@/i18n";
import { useSim } from "@/store/sim-store";

/** Amostra de linha usada na legenda. */
function Sample({ className, flow }: { className: string; flow?: boolean }) {
  return (
    <svg width="28" height="10" aria-hidden className="shrink-0">
      <path d="M2 5 H26" className={className} />
      {flow && <path d="M2 5 H26" className="wire-flow" style={{ animationDuration: "0.9s" }} />}
    </svg>
  );
}

/** Legenda das cores das linhas e relógio da simulação (visível enquanto simula; pode ser recolhida). */
export function SimLegend() {
  const time = useSim((s) => s.snapshot?.time ?? 0);
  const lagging = useSim((s) => s.lagging);
  const status = useSim((s) => s.status);
  const [open, setOpen] = useState(true);
  const seconds = time.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="absolute bottom-2 left-2 rounded-lg border border-line bg-panel/95 p-2 text-xs shadow-sm" data-testid="sim-legend">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 font-medium"
        aria-expanded={open}
        title={t("sim.legend")}
        onClick={() => setOpen(!open)}
      >
        <span>{status === "paused" ? t("sim.paused") : t("sim.running")}</span>
        <span className="flex items-center gap-1 tabular-nums text-muted">
          {t("sim.time", { s: seconds })}
          {open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
      {open && (
        <>
          <ul className="mt-1.5 space-y-1">
            <li className="flex items-center gap-2">
              <Sample className="wire wire-pressurized legend-pressure" />
              {t("sim.legendPressure")}
            </li>
            <li className="flex items-center gap-2">
              <Sample className="wire wire-empty" />
              {t("sim.legendEmpty")}
            </li>
            <li className="flex items-center gap-2">
              <Sample className="wire wire-pilot wire-empty" />
              {t("sim.legendPilot")}
            </li>
            <li className="flex items-center gap-2">
              <Sample className="wire wire-pressurized legend-pressure" flow />
              {t("sim.legendFlow")}
            </li>
          </ul>
          <p className="mt-1.5 max-w-52 text-muted">{t("sim.hint")}</p>
        </>
      )}
      {lagging && <p className="mt-1 max-w-52 text-danger">{t("sim.lagging")}</p>}
    </div>
  );
}
