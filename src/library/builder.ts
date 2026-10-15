/**
 * Montador dos circuitos prontos: coloca peças em posições fixas (em unidades
 * do desenho, múltiplos de 10) e liga conectores. As linhas são roteadas sozinhas.
 *
 *   const b = new Builder("Comando direto");
 *   const a = b.add("pneu.cylinder.single-acting", 200, 0, { label: "A1" });
 *   b.wire(a, "A", v, "2");
 */
import { createId } from "@/engine/core/ids";
import type { Circuit, ParamValue, Project, Rotation } from "@/engine/core/types";
import { createInstance, createProject } from "@/store/project-model";

interface AddOptions {
  label?: string;
  params?: Record<string, ParamValue>;
  rotation?: Rotation;
  mirrored?: boolean;
}

export class Builder {
  readonly project: Project;
  private circuit: Circuit;

  constructor(name: string, firstTab = "Circuito") {
    this.project = createProject(name);
    this.circuit = this.project.circuits[0];
    this.circuit.name = firstTab;
  }

  /** Começa outra aba (ex.: "Comando elétrico"). */
  tab(name: string) {
    this.circuit = { id: createId("c"), name, components: [], connections: [] };
    this.project.circuits.push(this.circuit);
    return this;
  }

  add(type: string, x: number, y: number, o: AddOptions = {}): string {
    const inst = createInstance(this.project, type, x, y);
    inst.params = { ...inst.params, ...o.params };
    if (o.label !== undefined) inst.label = o.label;
    if (o.rotation) inst.rotation = o.rotation;
    if (o.mirrored) inst.mirrored = true;
    this.circuit.components.push(inst);
    return inst.id;
  }

  wire(a: string, pa: string, b: string, pb: string) {
    this.circuit.connections.push({ id: createId("w"), from: { componentId: a, portId: pa }, to: { componentId: b, portId: pb }, waypoints: [] });
    return this;
  }

  /** Liga vários conectores ao mesmo ponto `a:pa` (ex.: a fonte a todas as válvulas). */
  fan(a: string, pa: string, targets: [string, string][]) {
    for (const [b, pb] of targets) this.wire(a, pa, b, pb);
    return this;
  }

  build(): Project {
    return this.project;
  }
}
