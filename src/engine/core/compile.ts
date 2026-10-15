/**
 * Monta o circuito de simulação a partir do projeto: escolhe as peças que
 * têm comportamento, agrupa os conectores ligados em redes e lista as linhas.
 * Todas as abas do projeto são simuladas juntas.
 */
import type { SimCircuit, SimComponent, SimSpec } from "./sim-types";
import { internalPorts, portKey } from "./sim-types";
import type { Project } from "./types";

/** O que o compilador precisa saber de cada tipo de peça. */
export interface PartInfo {
  sim?: SimSpec;
  ports: readonly { id: string; kind: string; exhaust?: boolean }[];
}

class UnionFind {
  private parent = new Map<string, string>();
  find(k: string): string {
    let p = this.parent.get(k) ?? k;
    if (p !== k) {
      p = this.find(p);
      this.parent.set(k, p);
    }
    return p;
  }
  union(a: string, b: string) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function compileProject(project: Project, lookup: (type: string) => PartInfo | undefined): SimCircuit {
  const components: SimComponent[] = [];
  const known = new Set<string>();
  const uf = new UnionFind();

  for (const circuit of project.circuits) {
    for (const comp of circuit.components) {
      const info = lookup(comp.type);
      if (!info?.sim) continue;
      const spec = info.sim;
      const closedWhenOpen = spec.kind === "gauge" || spec.kind === "suction-cup";
      const ports = [
        ...info.ports
          .filter((p) => p.kind === "pneumatic" || p.kind === "pilot")
          .map((p) => ({ id: p.id, ventsWhenOpen: p.kind === "pneumatic" && !closedWhenOpen, exhaust: Boolean(p.exhaust) })),
        ...internalPorts(spec).map((id) => ({ id, ventsWhenOpen: false, exhaust: false })),
      ];
      for (const p of ports) known.add(portKey(comp.id, p.id));
      // Ponto de ligação e reservatório: todos os conectores são o mesmo ponto.
      if (spec.kind === "junction" || spec.kind === "reservoir") {
        for (const p of ports.slice(1)) uf.union(portKey(comp.id, ports[0].id), portKey(comp.id, p.id));
      }
      components.push({ id: comp.id, label: comp.label, spec, params: { ...comp.params }, ports });
    }
  }

  const wires: SimCircuit["wires"] = [];
  for (const circuit of project.circuits) {
    for (const w of circuit.connections) {
      const from = portKey(w.from.componentId, w.from.portId);
      const to = portKey(w.to.componentId, w.to.portId);
      if (!known.has(from) || !known.has(to)) continue;
      uf.union(from, to);
      wires.push({ id: w.id, from, to });
    }
  }

  const netIndex = new Map<string, number>();
  const nets: SimCircuit["nets"] = [];
  for (const k of known) {
    const root = uf.find(k);
    let i = netIndex.get(root);
    if (i === undefined) {
      i = nets.length;
      netIndex.set(root, i);
      nets.push({ ports: [], wires: [] });
    }
    nets[i].ports.push(k);
  }
  for (const w of wires) nets[netIndex.get(uf.find(w.from))!].wires.push(w.id);

  return { components, nets, wires };
}
