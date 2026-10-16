"use client";

import { useMemo } from "react";
import { t } from "@/i18n";
import { selectActiveCircuit, useEditor } from "@/store/editor-store";
import { computeLadder } from "./ladder";

/** Números das colunas de corrente e tabelas de contatos embaixo das bobinas. */
export function LadderAnnotations() {
  const circuit = useEditor(selectActiveCircuit);
  const ladder = useMemo(() => computeLadder(circuit), [circuit]);
  if (!ladder) return null;
  return (
    <g className="ladder" data-testid="ladder">
      {ladder.columns.map((c) => (
        <text key={c.number} className="ladder-number" x={c.x} y={ladder.numberY} textAnchor="middle">
          {c.number}
        </text>
      ))}
      {ladder.crossRefs.map((r) => {
        // tabela ao lado da bobina (o fio continua embaixo dela)
        const x = r.bounds.x + r.bounds.w + 12;
        const y = r.bounds.y + 24;
        const rows = Math.max(r.no.length, r.nc.length, 1);
        return (
          <g key={r.componentId} className="ladder-xref">
            <line className="ladder-rule" x1={x - 16} x2={x + 16} y1={y + 4} y2={y + 4} />
            <line className="ladder-rule" x1={x} x2={x} y1={y - 2} y2={y + 6 + rows * 9} />
            <text className="ladder-head" x={x - 8} y={y + 2} textAnchor="middle">
              {t("ladder.no")}
            </text>
            <text className="ladder-head" x={x + 8} y={y + 2} textAnchor="middle">
              {t("ladder.nc")}
            </text>
            {r.no.map((n, i) => (
              <text key={`no${n}`} className="ladder-ref" x={x - 8} y={y + 12 + i * 9} textAnchor="middle">
                {n}
              </text>
            ))}
            {r.nc.map((n, i) => (
              <text key={`nc${n}`} className="ladder-ref" x={x + 8} y={y + 12 + i * 9} textAnchor="middle">
                {n}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
}
