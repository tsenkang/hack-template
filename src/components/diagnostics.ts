/** Junta os avisos do detector estático e os da simulação, e monta as mensagens. */
import { useMemo } from "react";
import { checkProject, type Diagnostic, type DiagnosticCode } from "@/engine/diagnostics/static";
import type { Project } from "@/engine/core/types";
import { getLocale, tDynamic } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { useSim } from "@/store/sim-store";
import { getDef } from "@/symbols/registry";

const lookup = (type: string) => {
  const def = getDef(type);
  return def && { domain: def.domain, sim: def.sim, ports: def.ports };
};

export const staticDiagnostics = (project: Project) => checkProject(project, lookup);

const RUNTIME_SEVERITY: Partial<Record<DiagnosticCode, Diagnostic["severity"]>> = {
  overpressure: "error",
  "stuck-signal": "warning",
  leak: "warning",
};

/** Todos os avisos atuais: primeiro os da simulação (se estiver rodando), depois os do desenho. */
export function useDiagnostics(): Diagnostic[] {
  const project = useEditor((s) => s.project);
  const warnings = useSim((s) => s.snapshot?.warnings);
  const statics = useMemo(() => staticDiagnostics(project), [project]);
  const runtime = useMemo(() => {
    if (!warnings?.length) return [];
    const circuitOf = new Map(project.circuits.flatMap((c) => c.components.map((k) => [k.id, c.id] as const)));
    return warnings.map<Diagnostic>((w) => ({
      severity: RUNTIME_SEVERITY[w.code] ?? "warning",
      code: w.code,
      circuitId: circuitOf.get(w.componentId) ?? project.circuits[0].id,
      componentId: w.componentId,
      port: w.port,
      vars: w.value !== undefined ? { value: w.value.toLocaleString(getLocale(), { maximumFractionDigits: 1 }) } : undefined,
    }));
  }, [warnings, project]);
  return useMemo(() => [...runtime, ...statics], [runtime, statics]);
}

/** Texto do aviso, com o rótulo da peça e o conector. */
export function diagnosticMessage(d: Diagnostic, project: Project): string {
  const comp = project.circuits.flatMap((c) => c.components).find((k) => k.id === d.componentId);
  const part = comp ? comp.label || tDynamic(`parts.${comp.type}.name`) : "";
  return tDynamic(`diagnostics.${d.code}`, { part, port: d.port ?? "", ...d.vars });
}

export const SEVERITY_ORDER: Record<Diagnostic["severity"], number> = { error: 0, warning: 1, info: 2 };
