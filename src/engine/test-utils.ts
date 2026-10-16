/**
 * Montador de circuitos para os testes do motor:
 *   const c = new TestCircuit();
 *   const fonte = c.add("pneu.source.air");
 *   c.wire(fonte, "1", valvula, "1");
 *   const sim = c.build();
 */
import { createId } from "@/engine/core/ids";
import { compileProject } from "@/engine/core/compile";
import { Simulation } from "@/engine/core/simulation";
import type { ParamValue, Project } from "@/engine/core/types";
import { createInstance, createProject } from "@/store/project-model";
import { getDef } from "@/symbols/registry";

export const lookupPart = (type: string) => {
  const def = getDef(type);
  return def && { sim: def.sim, ports: def.ports };
};

export class TestCircuit {
  readonly project: Project = createProject("teste");

  add(type: string, params: Record<string, ParamValue> = {}, label?: string): string {
    const inst = createInstance(this.project, type, 0, 0);
    inst.params = { ...inst.params, ...params };
    if (label) inst.label = label;
    this.project.circuits[0].components.push(inst);
    return inst.id;
  }

  label(id: string) {
    return this.project.circuits[0].components.find((c) => c.id === id)!.label;
  }

  wire(a: string, portA: string, b: string, portB: string) {
    this.project.circuits[0].connections.push({
      id: createId("w"),
      from: { componentId: a, portId: portA },
      to: { componentId: b, portId: portB },
      waypoints: [],
    });
  }

  build() {
    return new Simulation(compileProject(this.project, lookupPart));
  }
}

/** Avança até `cond` ficar verdadeira (ou estourar `maxSeconds`). Devolve o tempo gasto. */
export function runUntil(sim: Simulation, cond: () => boolean, maxSeconds = 5): number {
  const start = sim.time;
  while (!cond() && sim.time - start < maxSeconds) sim.step();
  return sim.time - start;
}
