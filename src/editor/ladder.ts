/**
 * Esquema em escada (elétrico): numera as colunas de corrente da esquerda para a
 * direita e monta a referência cruzada de cada bobina de relé — em quais colunas
 * estão os contatos NA e NF com o mesmo rótulo, como nos esquemas industriais.
 */
import type { Circuit } from "@/engine/core/types";
import { getDef } from "@/symbols/registry";
import { componentBounds, type Rect } from "./geometry";

/** Distância máxima [unidades] entre centros para estar na mesma coluna. */
const COLUMN_TOLERANCE = 20;
/** Bobinas que comandam contatos pelo rótulo. */
const RELAY_LOADS = new Set(["relay-coil", "timer-on", "timer-off", "counter"]);

export interface LadderInfo {
  /** Centro x e número de cada coluna, e onde escrever o número (acima de tudo). */
  columns: { x: number; number: number }[];
  numberY: number;
  /** Referência cruzada desenhada embaixo de cada bobina. */
  crossRefs: { componentId: string; bounds: Rect; no: number[]; nc: number[] }[];
}

export function computeLadder(circuit: Circuit): LadderInfo | null {
  const electric = circuit.components.flatMap((comp) => {
    const def = getDef(comp.type);
    if (!def || def.domain !== "electric") return [];
    const bounds = componentBounds(comp, def);
    return [{ comp, def, bounds, cx: bounds.x + bounds.w / 2 }];
  });
  // As fontes (+24 V / 0 V) não formam coluna própria, mas o número fica acima delas.
  const parts = electric.filter((p) => p.def.sim?.kind !== "elec-supply");
  if (parts.length === 0) return null;

  // Agrupa em colunas pelo centro horizontal.
  const sorted = [...parts].sort((a, b) => a.cx - b.cx);
  const groups: { x: number; members: typeof parts }[] = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(p.cx - last.x) <= COLUMN_TOLERANCE) {
      last.members.push(p);
      last.x = last.members.reduce((s, m) => s + m.cx, 0) / last.members.length;
    } else groups.push({ x: p.cx, members: [p] });
  }
  const columnOf = new Map<string, number>();
  groups.forEach((g, i) => g.members.forEach((m) => columnOf.set(m.comp.id, i + 1)));

  const crossRefs: LadderInfo["crossRefs"] = [];
  for (const p of parts) {
    const sim = p.def.sim;
    if (sim?.kind !== "elec-load" || !RELAY_LOADS.has(sim.load) || !p.comp.label) continue;
    const no = new Set<number>();
    const nc = new Set<number>();
    for (const q of parts) {
      const qs = q.def.sim;
      if (qs?.kind !== "elec-switch" || qs.drive !== "relay" || q.comp.label !== p.comp.label) continue;
      for (const c of qs.contacts) (c.normally === "open" ? no : nc).add(columnOf.get(q.comp.id)!);
    }
    crossRefs.push({ componentId: p.comp.id, bounds: p.bounds, no: [...no].sort((a, b) => a - b), nc: [...nc].sort((a, b) => a - b) });
  }

  return {
    columns: groups.map((g, i) => ({ x: g.x, number: i + 1 })),
    numberY: Math.min(...electric.map((p) => p.bounds.y)) - 8,
    crossRefs,
  };
}
