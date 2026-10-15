import { describe, expect, it } from "vitest";
import { getDef } from "@/symbols/registry";
import { TestCircuit } from "@/engine/test-utils";
import { planInsertOnWire, wireNets } from "./wires";

describe("inserir peça sobre uma linha", () => {
  it("retenção numa linha vertical: gira 90° e liga a entrada do lado da origem", () => {
    const def = getDef("pneu.check-valve")!;
    const plan = planInsertOnWire(def, { point: { x: 100, y: 200 }, vertical: true }, { x: 100, y: 50 }, "pneumatic")!;
    expect(plan.rotation).toBe(90);
    expect(plan.ports).toEqual(["1", "2"]);
    // o meio entre os conectores fica sobre a linha
    expect(plan.x + def.height / 2).toBe(100);
  });

  it("numa linha horizontal vinda da direita, inverte a ordem dos conectores", () => {
    const def = getDef("pneu.flow-control.two-way")!;
    const plan = planInsertOnWire(def, { point: { x: 100, y: 200 }, vertical: false }, { x: 400, y: 200 }, "pneumatic")!;
    expect(plan.rotation).toBe(0);
    expect(plan.ports).toEqual(["2", "1"]);
  });

  it("peça sem dois conectores de linha não encaixa", () => {
    expect(planInsertOnWire(getDef("pneu.silencer")!, { point: { x: 0, y: 0 }, vertical: true }, { x: 0, y: -50 }, "pneumatic")).toBeNull();
  });
});

describe("rastro do sinal", () => {
  it("linhas ligadas por um ponto de ligação ficam na mesma rede", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const t = c.add("pneu.junction");
    const g1 = c.add("pneu.gauge.pressure");
    const g2 = c.add("pneu.gauge.pressure");
    const s2 = c.add("pneu.silencer");
    c.wire(src, "1", t, "1");
    c.wire(t, "3", g1, "1");
    c.wire(g2, "1", s2, "1");
    const nets = wireNets(c.project.circuits[0]);
    const [w1, w2, w3] = c.project.circuits[0].connections.map((w) => nets.get(w.id));
    expect(w1).toBe(w2);
    expect(w3).not.toBe(w1);
  });
});
