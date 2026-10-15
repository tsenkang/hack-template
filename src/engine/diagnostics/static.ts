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
  | "leak"
  | "short-circuit"
  | "overvoltage"
  | "fuse-blown"
  | "no-elec-supply"
  | "unknown-coil"
  | "unknown-solenoid"
  | "unused-solenoid"
  | "no-hyd-supply"
  | "open-port-oil"
  | "pump-no-tank";

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
  const has = { pneumatic: false, hydraulic: false, airSupply: false, pump: false };

  for (const circuit of project.circuits) {
    for (const comp of circuit.components) {
      const info = lookup(comp.type);
      const spec = info?.sim;
      if (!info || !spec) continue;
      if (info.domain === "pneumatic") has.pneumatic = true;
      if (info.domain === "hydraulic") has.hydraulic = true;
      if (spec.kind === "air-source") has.airSupply = true;
      if (spec.kind === "hyd-pump") has.pump = true;
      if (spec.kind === "cylinder") cylinders.add(comp.label);
    }
  }
  if (has.pneumatic && !has.airSupply) {
    out.push({ severity: "error", code: "no-supply", circuitId: project.circuits[0].id });
  }
  if (has.hydraulic && !has.pump) {
    out.push({ severity: "error", code: "no-hyd-supply", circuitId: project.circuits[0].id });
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

      const ports = info.ports.filter((p) => p.kind !== "electric");
      const anyConnected = ports.some((p) => connected.has(`${comp.id}:${p.id}`));
      for (const port of ports) {
        if (connected.has(`${comp.id}:${port.id}`) || port.exhaust) continue;
        if (SHARED_POINT.includes(spec.kind) && anyConnected) continue;
        const at = { circuitId: circuit.id, componentId: comp.id, port: port.id };
        if (port.kind === "pilot" || port.kind === "hydraulic-pilot") out.push({ severity: "info", code: "open-pilot", ...at });
        else if (spec.kind === "hyd-pump" && port.id === "S") out.push({ severity: "error", code: "pump-no-tank", ...at });
        else if (spec.kind === "gauge" || spec.kind.startsWith("elec-")) continue;
        else if (port.kind === "hydraulic") out.push({ severity: "warning", code: "open-port-oil", ...at });
        else out.push({ severity: "warning", code: "open-port", ...at });
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
  out.push(...checkElectric(project, lookup));
  return out;
}

/** Cargas que comandam contatos pelo rótulo. */
const RELAY_LOADS: readonly string[] = ["relay-coil", "timer-on", "timer-off", "counter"];

/** Verificações da parte elétrica: fonte, rótulos de bobinas, contatos e solenoides. */
function checkElectric(project: Project, lookup: (type: string) => DiagnosticPartInfo | undefined): Diagnostic[] {
  const out: Diagnostic[] = [];
  const all = project.circuits.flatMap((circuit) =>
    circuit.components.map((comp) => ({ circuit, comp, spec: lookup(comp.type)?.sim })),
  );
  const electric = all.filter((x) => x.spec?.kind.startsWith("elec-"));
  if (electric.length === 0) return out;

  if (!electric.some((x) => x.spec?.kind === "elec-supply" && x.spec.potential === "positive")) {
    out.push({ severity: "error", code: "no-elec-supply", circuitId: electric[0].circuit.id });
  }

  const relayCoils = new Map<string, typeof all>();
  const solenoidCoils = new Map<string, typeof all>();
  for (const x of electric) {
    if (x.spec?.kind !== "elec-load" || !x.comp.label) continue;
    const target = x.spec.load === "solenoid-coil" ? solenoidCoils : RELAY_LOADS.includes(x.spec.load) ? relayCoils : null;
    target?.set(x.comp.label, [...(target.get(x.comp.label) ?? []), x]);
  }
  for (const group of [relayCoils, solenoidCoils]) {
    for (const [label, uses] of group) {
      if (uses.length < 2) continue;
      for (const u of uses) out.push({ severity: "warning", code: "duplicate-label", circuitId: u.circuit.id, componentId: u.comp.id, vars: { label } });
    }
  }

  for (const x of electric) {
    if (x.spec?.kind === "elec-switch" && x.spec.drive === "relay" && !relayCoils.has(x.comp.label)) {
      out.push({ severity: "warning", code: "unknown-coil", circuitId: x.circuit.id, componentId: x.comp.id, vars: { label: x.comp.label || "—" } });
    }
  }

  // Solenoides: bobina elétrica Y… ↔ parâmetro solenoidLeft/Right das válvulas.
  const valveSolenoids = new Map<string, (typeof all)[number]>();
  for (const x of all) {
    if (x.spec?.kind !== "valve") continue;
    for (const key of ["solenoidLeft", "solenoidRight"]) {
      const label = x.comp.params[key];
      if (typeof label === "string" && label) valveSolenoids.set(label, x);
    }
  }
  for (const [label, uses] of solenoidCoils) {
    if (!valveSolenoids.has(label)) {
      out.push({ severity: "warning", code: "unknown-solenoid", circuitId: uses[0].circuit.id, componentId: uses[0].comp.id, vars: { label } });
    }
  }
  for (const [label, x] of valveSolenoids) {
    if (!solenoidCoils.has(label)) {
      out.push({ severity: "info", code: "unused-solenoid", circuitId: x.circuit.id, componentId: x.comp.id, vars: { label } });
    }
  }
  return out;
}
