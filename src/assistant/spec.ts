/**
 * O circuito que o assistente descreve (via ferramenta `build_circuit`) e a
 * montagem/conferência dele: peças e conectores existem? o detector de erros
 * acha problemas? o roteiro de teste faz a sequência esperada?
 * Puro (sem React e sem rede), para testar sem chamar a API.
 */
import { createId } from "@/engine/core/ids";
import type { ParamValue, Project, Rotation } from "@/engine/core/types";
import { checkProject, type Diagnostic } from "@/engine/diagnostics/static";
import { parseProgram, serializeProgram } from "@/engine/logic/plc";
import { runScenario, type ScenarioResult } from "@/library/scenario";
import type { Scenario } from "@/library/types";
import { createInstance, createProject } from "@/store/project-model";
import { getDef } from "@/symbols/registry";
import { GRID } from "@/symbols/types";

export interface SpecPart {
  /** Nome curto usado só nas ligações (ex.: "cil", "v1"). */
  ref: string;
  type: string;
  x: number;
  y: number;
  label?: string;
  rotation?: number;
  params?: Record<string, unknown>;
}

export interface SpecWire {
  /** "ref:porta", ex.: "v1:4". */
  from: string;
  to: string;
}

export interface CircuitSpec {
  name?: string;
  tabs: { name?: string; parts: SpecPart[]; wires: SpecWire[] }[];
  test?: Scenario;
  steps?: string[];
}

export interface BuildReport {
  project: Project;
  /** Problemas de montagem (tipo de peça ou conector inexistente, ligação inválida). */
  structural: string[];
  diagnostics: Diagnostic[];
  test?: ScenarioResult & { expect: string };
  ok: boolean;
}

const lookupDiag = (type: string) => {
  const def = getDef(type);
  return def && { domain: def.domain, sim: def.sim, ports: def.ports };
};

const snap = (v: number) => Math.round((Number.isFinite(v) ? v : 0) / GRID) * GRID;
const ROTATIONS: Rotation[] = [0, 90, 180, 270];

/** Converte um valor de parâmetro para o tipo que a peça espera. */
function paramValue(type: string, key: string, raw: unknown): ParamValue | undefined {
  const def = getDef(type)?.params.find((p) => p.key === key);
  if (!def) return undefined;
  if (def.type === "program") {
    const text = typeof raw === "string" ? raw : JSON.stringify(raw ?? {});
    return serializeProgram(parseProgram(text));
  }
  if (def.type === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.min(def.max, Math.max(def.min, n)) : undefined;
  }
  if (def.type === "boolean") return Boolean(raw);
  if (def.type === "select") return def.options.includes(String(raw)) ? String(raw) : undefined;
  return String(raw ?? "");
}

export function buildFromSpec(spec: CircuitSpec): BuildReport {
  const structural: string[] = [];
  const project = createProject(spec.name?.trim() || "Circuito do assistente");
  project.circuits = [];
  const tabs = Array.isArray(spec.tabs) && spec.tabs.length ? spec.tabs : [{ name: "Circuito", parts: [], wires: [] }];
  for (const [ti, tab] of tabs.entries()) {
    const circuit = { id: createId("c"), name: tab.name?.trim() || `Circuito ${ti + 1}`, components: [] as Project["circuits"][number]["components"], connections: [] as Project["circuits"][number]["connections"] };
    project.circuits.push(circuit);
    const byRef = new Map<string, string>();
    for (const part of Array.isArray(tab.parts) ? tab.parts : []) {
      const def = getDef(part.type);
      if (!def) {
        structural.push(`Peça "${part.ref}": tipo "${part.type}" não existe no catálogo.`);
        continue;
      }
      if (byRef.has(part.ref)) structural.push(`Ref "${part.ref}" repetida na aba "${circuit.name}".`);
      const inst = createInstance(project, def.type, snap(part.x), snap(part.y));
      if (typeof part.label === "string" && part.label.trim()) inst.label = part.label.trim();
      const rot = Number(part.rotation);
      if (ROTATIONS.includes(rot as Rotation)) inst.rotation = rot as Rotation;
      for (const [key, raw] of Object.entries(part.params ?? {})) {
        const v = paramValue(def.type, key, raw);
        if (v === undefined) structural.push(`Peça "${part.ref}" (${def.type}): parâmetro "${key}" inválido.`);
        else inst.params[key] = v;
      }
      circuit.components.push(inst);
      byRef.set(part.ref, inst.id);
    }
    const end = (s: string) => {
      const i = typeof s === "string" ? s.lastIndexOf(":") : -1;
      if (i <= 0) {
        structural.push(`Ligação "${s}": use o formato "ref:porta".`);
        return null;
      }
      const ref = s.slice(0, i);
      const port = s.slice(i + 1);
      const id = byRef.get(ref);
      if (!id) {
        structural.push(`Ligação "${s}": não existe peça com ref "${ref}" nesta aba.`);
        return null;
      }
      const type = circuit.components.find((c) => c.id === id)!.type;
      if (!getDef(type)!.ports.some((p) => p.id === port)) {
        const ids = getDef(type)!.ports.map((p) => p.id).join(", ");
        structural.push(`Ligação "${s}": a peça ${type} não tem a porta "${port}" (portas: ${ids}).`);
        return null;
      }
      return { componentId: id, portId: port };
    };
    for (const w of Array.isArray(tab.wires) ? tab.wires : []) {
      const a = end(w.from);
      const b = end(w.to);
      if (a && b) circuit.connections.push({ id: createId("w"), from: a, to: b, waypoints: [] });
    }
  }

  const diagnostics = checkProject(project, lookupDiag).filter((d) => d.severity !== "info");
  let test: BuildReport["test"];
  if (spec.test && Array.isArray(spec.test.actions) && typeof spec.test.expect === "string") {
    const duration = Math.min(30, Math.max(1, Number(spec.test.duration) || 5));
    try {
      test = { ...runScenario(project, { ...spec.test, duration }), expect: spec.test.expect };
    } catch (err) {
      structural.push(`O teste não pôde rodar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const ok = structural.length === 0 && !diagnostics.some((d) => d.severity === "error") && (test ? test.ok : true);
  return { project, structural, diagnostics, test, ok };
}

/** Texto curto para devolver ao modelo como resultado da ferramenta. */
export function reportText(r: BuildReport, describe: (d: Diagnostic, project: Project) => string): string {
  const lines: string[] = [];
  lines.push(r.ok ? "RESULTADO: OK, o circuito monta e passa nas conferências." : "RESULTADO: há problemas para corrigir.");
  for (const s of r.structural) lines.push(`- Montagem: ${s}`);
  for (const d of r.diagnostics) lines.push(`- ${d.severity === "error" ? "Erro" : "Atenção"}: ${describe(d, r.project)}`);
  if (r.test) {
    lines.push(`- Teste: esperado "${r.test.expect}", simulado "${r.test.sequence.join(" ") || "nenhum movimento"}"${r.test.ok ? " (OK)" : ""}.`);
    if (r.test.missing.length) lines.push(`- Teste: rótulos usados no roteiro que não existem: ${r.test.missing.join(", ")}.`);
  } else {
    lines.push("- Sem teste automático (inclua `test` quando houver cilindros e botões).");
  }
  return lines.join("\n");
}

/** O contrário de `buildFromSpec`: descreve um projeto no formato da ferramenta (exemplos e testes). */
export function projectToSpec(project: Project, extra: Pick<CircuitSpec, "test" | "steps"> = {}): CircuitSpec {
  return {
    name: project.name,
    tabs: project.circuits.map((c) => {
      const ref = new Map(c.components.map((k, i) => [k.id, `${k.label || "p"}${k.label ? "" : i}`.replace(/[^\w-]/g, "_")] as const));
      // refs únicas mesmo com rótulos repetidos (ex.: contatos K1)
      const seen = new Map<string, number>();
      for (const [id, r] of ref) {
        const n = seen.get(r) ?? 0;
        seen.set(r, n + 1);
        if (n > 0) ref.set(id, `${r}_${n + 1}`);
      }
      return {
        name: c.name,
        parts: c.components.map((k) => {
          const def = getDef(k.type);
          const params: Record<string, unknown> = {};
          for (const p of def?.params ?? []) {
            const v = k.params[p.key];
            if (v === undefined || v === p.default) continue;
            params[p.key] = p.type === "program" ? parseProgram(v) : v;
          }
          return {
            ref: ref.get(k.id)!,
            type: k.type,
            x: k.x,
            y: k.y,
            ...(k.label ? { label: k.label } : {}),
            ...(k.rotation ? { rotation: k.rotation } : {}),
            ...(Object.keys(params).length ? { params } : {}),
          };
        }),
        wires: c.connections.map((w) => ({ from: `${ref.get(w.from.componentId)}:${w.from.portId}`, to: `${ref.get(w.to.componentId)}:${w.to.portId}` })),
      };
    }),
    ...extra,
  };
}
