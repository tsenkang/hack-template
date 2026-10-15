/**
 * Detector de erros "parado" (antes de simular): olha o desenho e aponta problemas
 * comuns de montagem. Não depende de React; recebe as informações das peças por `lookup`.
 */
import { POSITION_ACTUATORS, type SimSpec } from "../core/sim-types";
import type { Project } from "../core/types";

export type Severity = "error" | "warning" | "info";

export type DiagnosticCode =
  | "no-supply"
  | "open-port"
  | "open-pilot"
  | "unknown-cylinder"
  | "duplicate-label"
  | "overpressure"
  | "stuck-signal"
  | "leak";

export interface Diagnostic {
  severity: Severity;
  code: DiagnosticCode;
  circuitId: string;
  componentId?: string;
  port?: string;
  vars?: Record<string, string | number>;
}

export interface DiagnosticPartInfo {
  domain: string;
  sim?: SimSpec;
  ports: readonly { id: string; kind: string; exhaust?: boolean }[];
}

/** Peças em que conectores sobrando são normais (todos são o mesmo ponto). */
const SHARED_POINT: readonly string[] = ["junction", "reservoir"];

export function checkProject(project: Project, lookup: (type: string) => DiagnosticPartInfo | undefined): Diagnostic[] {
  const out: Diagnostic[] = [];
  const cylinders = new Set<string>();
  let hasPneumatic = false;
  let hasSupply = false;

  for (const circuit of project.circuits) {
    for (const comp of circuit.components) {
      const spec = lookup(comp.type)?.sim;
      if (!spec) continue;
      hasPneumatic = true;
      if (spec.kind === "air-source") hasSupply = true;
      if (spec.kind === "cylinder") cylinders.add(comp.label);
    }
  }
  if (hasPneumatic && !hasSupply) {
    out.push({ severity: "error", code: "no-supply", circuitId: project.circuits[0].id });
  }

  const labels = new Map<string, { circuitId: string; componentId: string }[]>();
  for (const circuit of project.circuits) {
    const connected = new Set(circuit.connections.flatMap((w) => [`${w.from.componentId}:${w.from.portId}`, `${w.to.componentId}:${w.to.portId}`]));
    for (const comp of circuit.components) {
      const info = lookup(comp.type);
      if (!info) continue;
      const spec = info.sim;

      if (comp.label && info.domain !== "electric") {
        labels.set(comp.label, [...(labels.get(comp.label) ?? []), { circuitId: circuit.id, componentId: comp.id }]);
      }
      if (!spec) continue;

      const ports = info.ports.filter((p) => p.kind === "pneumatic" || p.kind === "pilot");
      const anyConnected = ports.some((p) => connected.has(`${comp.id}:${p.id}`));
      for (const port of ports) {
        if (connected.has(`${comp.id}:${port.id}`) || port.exhaust) continue;
        if (SHARED_POINT.includes(spec.kind) && anyConnected) continue;
        if (port.kind === "pilot") {
          out.push({ severity: "info", code: "open-pilot", circuitId: circuit.id, componentId: comp.id, port: port.id });
        } else if (spec.kind !== "gauge") {
          out.push({ severity: "warning", code: "open-port", circuitId: circuit.id, componentId: comp.id, port: port.id });
        }
      }

      if (spec.kind === "valve" && [spec.left, spec.right].some((a) => POSITION_ACTUATORS.includes(a))) {
        const target = String(comp.params.cylinder ?? "");
        if (!cylinders.has(target)) {
          out.push({
            severity: "error",
            code: "unknown-cylinder",
            circuitId: circuit.id,
            componentId: comp.id,
            vars: { cylinder: target || "—" },
          });
        }
      }
    }
  }

  for (const [label, uses] of labels) {
    if (uses.length < 2) continue;
    for (const u of uses) out.push({ severity: "warning", code: "duplicate-label", ...u, vars: { label } });
  }
  return out;
}
