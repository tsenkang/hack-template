/**
 * Monta o circuito de simulação a partir do projeto: escolhe as peças que
 * têm comportamento, agrupa os conectores ligados em redes e lista as linhas.
 * Todas as abas do projeto são simuladas juntas.
 */
import type { SimCircuit, SimComponent, SimSpec } from "./sim-types";
import { internalPorts, isElectric, portKey } from "./sim-types";
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

/** Agrupa conectores em redes, a partir dos grupos já unidos. */
function buildNets(keys: Iterable<string>, uf: UnionFind) {
  const index = new Map<string, number>();
  const nets: SimCircuit["nets"] = [];
  for (const k of keys) {
    const root = uf.find(k);
    let i = index.get(root);
    if (i === undefined) {
      i = nets.length;
      index.set(root, i);
      nets.push({ ports: [], wires: [] });
    }
    nets[i].ports.push(k);
  }
  return { nets, netOf: (k: string) => index.get(uf.find(k))! };
}

export function compileProject(project: Project, lookup: (type: string) => PartInfo | undefined): SimCircuit {
  const components: SimComponent[] = [];
  const known = new Set<string>();
  const knownElec = new Set<string>();
  const uf = new UnionFind();

  for (const circuit of project.circuits) {
    for (const comp of circuit.components) {
      const info = lookup(comp.type);
      if (!info?.sim) continue;
      const spec = info.sim;
      // Manômetro, ventosa e pressostato só "sentem" a pressão: conector solto fica fechado.
      const closedWhenOpen = spec.kind === "gauge" || spec.kind === "suction-cup" || isElectric(spec);
      const ports = [
        ...info.ports
          .filter((p) => p.kind === "pneumatic" || p.kind === "pilot")
          .map((p) => ({ id: p.id, ventsWhenOpen: p.kind === "pneumatic" && !closedWhenOpen, exhaust: Boolean(p.exhaust) })),
        ...internalPorts(spec).map((id) => ({ id, ventsWhenOpen: false, exhaust: false })),
      ];
      for (const p of ports) known.add(portKey(comp.id, p.id));
      const elecPorts = info.ports.filter((p) => p.kind === "electric").map((p) => p.id);
      for (const id of elecPorts) knownElec.add(portKey(comp.id, id));
      // Ponto de ligação e reservatório: todos os conectores são o mesmo ponto.
      if (spec.kind === "junction" || spec.kind === "reservoir") {
        for (const p of ports.slice(1)) uf.union(portKey(comp.id, ports[0].id), portKey(comp.id, p.id));
      }
      components.push({ id: comp.id, label: comp.label, spec, params: { ...comp.params }, ports, elecPorts });
    }
  }

  const wires: SimCircuit["wires"] = [];
  for (const circuit of project.circuits) {
    for (const w of circuit.connections) {
      const from = portKey(w.from.componentId, w.from.portId);
      const to = portKey(w.to.componentId, w.to.portId);
      const electric = knownElec.has(from) && knownElec.has(to);
      if (!electric && (!known.has(from) || !known.has(to))) continue;
      uf.union(from, to);
      wires.push({ id: w.id, from, to, electric });
    }
  }

  const fluid = buildNets(known, uf);
  const elec = buildNets(knownElec, uf);
  for (const w of wires) {
    const target = w.electric ? elec : fluid;
    target.nets[target.netOf(w.from)].wires.push(w.id);
  }

  return { components, nets: fluid.nets, elecNets: elec.nets, wires };
}
