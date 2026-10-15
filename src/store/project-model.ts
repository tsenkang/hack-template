/** Funções puras para criar e alterar projetos (sem estado global). */
import { createId } from "@/engine/core/ids";
import type { Circuit, ComponentInstance, Project } from "@/engine/core/types";
import { t } from "@/i18n";
import { defaultParams, getDef } from "@/symbols/registry";

export function createCircuit(index: number): Circuit {
  return { id: createId("c"), name: t("tabs.defaultName", { n: index }), components: [], connections: [] };
}

export function createProject(name = "Projeto sem nome"): Project {
  const now = new Date().toISOString();
  return { id: createId("p"), name, circuits: [createCircuit(1)], createdAt: now, updatedAt: now };
}

/**
 * Próximo rótulo livre para um prefixo, olhando o projeto inteiro: V1, V2…
 * Peças sem prefixo (ex.: fontes) ficam sem rótulo.
 */
export function nextLabel(project: Project, prefix: string, reserved: Set<string> = new Set()): string {
  if (!prefix) return "";
  const used = new Set(reserved);
  for (const c of project.circuits) for (const comp of c.components) used.add(comp.label);
  let n = 1;
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Rótulos já usados em parâmetros com numeração automática (ex.: solenoides Y1, Y2 das válvulas). */
function usedParamLabels(project: Project): Set<string> {
  const used = new Set<string>();
  for (const c of project.circuits) {
    for (const comp of c.components) {
      for (const p of getDef(comp.type)?.params ?? []) {
        if (p.type === "text" && p.autoLabel && typeof comp.params[p.key] === "string") used.add(comp.params[p.key] as string);
      }
    }
  }
  return used;
}

export function createInstance(project: Project, type: string, x: number, y: number): ComponentInstance {
  const def = getDef(type);
  if (!def) throw new Error(`Peça desconhecida: ${type}`);
  const params = defaultParams(def);
  const reserved = usedParamLabels(project);
  for (const p of def.params) {
    if (p.type === "text" && p.autoLabel) {
      // Só olha os outros parâmetros (ex.: Y das válvulas), não os rótulos das bobinas que vão ligar neles.
      let n = 1;
      while (reserved.has(`${p.autoLabel}${n}`)) n++;
      params[p.key] = `${p.autoLabel}${n}`;
      reserved.add(params[p.key] as string);
    }
  }
  return {
    id: createId("k"),
    type,
    x,
    y,
    rotation: 0,
    mirrored: false,
    // Contatos apontam para a bobina: começam em K1 em vez de ganhar número novo.
    label: def.referenceLabel ? `${def.labelPrefix}1` : nextLabel(project, def.labelPrefix),
    params,
  };
}

/** Aplica `fn` ao circuito `circuitId` e devolve um projeto novo (imutável). */
export function updateCircuit(project: Project, circuitId: string, fn: (c: Circuit) => Circuit): Project {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    circuits: project.circuits.map((c) => (c.id === circuitId ? fn(c) : c)),
  };
}

/** Aplica `fn` às peças com id em `ids` dentro do circuito. */
export function updateComponents(
  project: Project,
  circuitId: string,
  ids: ReadonlySet<string>,
  fn: (comp: ComponentInstance) => ComponentInstance,
): Project {
  return updateCircuit(project, circuitId, (c) => ({
    ...c,
    components: c.components.map((comp) => (ids.has(comp.id) ? fn(comp) : comp)),
  }));
}
