import { describe, expect, it } from "vitest";
import { compileProject } from "./compile";
import { lookupPart, TestCircuit } from "../test-utils";

describe("montagem das redes", () => {
  it("conectores ligados (inclusive por ponto de ligação) viram uma só rede", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const t = c.add("pneu.junction");
    const g1 = c.add("pneu.gauge.pressure");
    const g2 = c.add("pneu.gauge.pressure");
    c.wire(src, "1", t, "4");
    c.wire(t, "1", g1, "1");
    c.wire(t, "2", g2, "1");
    const sim = compileProject(c.project, lookupPart);
    const netOf = (k: string) => sim.nets.findIndex((n) => n.ports.includes(k));
    expect(netOf(`${src}:1`)).toBe(netOf(`${g1}:1`));
    expect(netOf(`${g1}:1`)).toBe(netOf(`${g2}:1`));
    expect(netOf(`${t}:3`)).toBe(netOf(`${g2}:1`)); // conector solto do T também é o mesmo ponto
  });

  it("ignora peças que ainda não têm simulação (hidráulicas)", () => {
    const c = new TestCircuit();
    c.add("elec.lamp");
    c.add("hyd.tank");
    c.add("pneu.silencer");
    expect(compileProject(c.project, lookupPart).components).toHaveLength(2);
  });

  it("fios formam redes elétricas separadas das redes de ar", () => {
    const c = new TestCircuit();
    const plus = c.add("elec.supply.24v");
    const lamp = c.add("elec.lamp");
    c.wire(plus, "+", lamp, "X1");
    const sim = compileProject(c.project, lookupPart);
    expect(sim.elecNets.some((n) => n.ports.includes(`${plus}:+`) && n.ports.includes(`${lamp}:X1`))).toBe(true);
    expect(sim.wires[0].electric).toBe(true);
    expect(sim.nets).toHaveLength(0);
  });
});
