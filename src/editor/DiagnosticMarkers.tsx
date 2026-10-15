"use client";

import { diagnosticMessage, SEVERITY_ORDER, useDiagnostics } from "@/components/diagnostics";
import type { Diagnostic } from "@/engine/diagnostics/static";
import { selectActiveCircuit, useEditor } from "@/store/editor-store";
import { getDef } from "@/symbols/registry";
import { componentBounds } from "./geometry";

/** Selo "!" no canto da peça que tem algum aviso (a cor indica a gravidade; a dica mostra o texto). */
export function DiagnosticMarkers() {
  const diagnostics = useDiagnostics();
  const circuit = useEditor(selectActiveCircuit);
  const project = useEditor((s) => s.project);

  const worst = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    if (d.circuitId !== circuit.id || !d.componentId || d.severity === "info") continue;
    worst.set(d.componentId, [...(worst.get(d.componentId) ?? []), d]);
  }

  return (
    <g data-export-ignore>
      {[...worst.entries()].map(([id, list]) => {
        const comp = circuit.components.find((c) => c.id === id);
        const def = comp && getDef(comp.type);
        if (!comp || !def) return null;
        const b = componentBounds(comp, def);
        const top = [...list].sort((a, z) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[z.severity])[0];
        return (
          <g key={id} className="diag-marker" data-testid="diag-marker" transform={`translate(${b.x - 5} ${b.y - 5})`}>
            <title>{list.map((d) => diagnosticMessage(d, project)).join("\n")}</title>
            <circle r={6} className={`diag-badge-${top.severity}`} />
            <text className="diag-badge-text" y={3.5} fontSize={9} textAnchor="middle">
              !
            </text>
          </g>
        );
      })}
    </g>
  );
}
