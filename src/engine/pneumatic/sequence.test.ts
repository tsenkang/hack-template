import { describe, expect, it } from "vitest";
import { TestCircuit } from "../test-utils";

/**
 * Sequência A+ B+ B− A− (método direto). Os sinais a1 e b0 seriam "sinais presos",
 * então usam rolete escamoteável (gatilho), que só aciona num sentido.
 */
function buildSequence(oneWay: boolean) {
  const c = new TestCircuit();
  const src = c.add("pneu.source.air");
  const A = c.add("pneu.cylinder.double-acting", { stroke: 100 }, "A");
  const B = c.add("pneu.cylinder.double-acting", { stroke: 100 }, "B");
  const VA = c.add("pneu.valve.5-2.pilot-pilot");
  const VB = c.add("pneu.valve.5-2.pilot-pilot");
  const start = c.add("pneu.valve.3-2-nc.button-spring");
  const a0 = c.add("pneu.valve.3-2-nc.roller-spring", { cylinder: "A", position: 0 });
  const b1 = c.add("pneu.valve.3-2-nc.roller-spring", { cylinder: "B", position: 100 });
  const a1 = oneWay
    ? c.add("pneu.valve.3-2-nc.roller-oneway-spring", { cylinder: "A", position: 95, direction: "advance" })
    : c.add("pneu.valve.3-2-nc.roller-spring", { cylinder: "A", position: 100 });
  const b0 = oneWay
    ? c.add("pneu.valve.3-2-nc.roller-oneway-spring", { cylinder: "B", position: 5, direction: "return" })
    : c.add("pneu.valve.3-2-nc.roller-spring", { cylinder: "B", position: 0 });
  // velocidade controlada na saída do ar dos dois cilindros
  const fc = (cyl: string, port: string, valve: string, vport: string) => {
    const f = c.add("pneu.flow-control.one-way", { opening: 30 });
    c.wire(cyl, port, f, "1");
    c.wire(f, "2", valve, vport);
  };
  for (const v of [VA, VB, a0, a1, b0, b1]) c.wire(src, "1", v, "1");
  fc(A, "A", VA, "4");
  fc(A, "B", VA, "2");
  fc(B, "A", VB, "4");
  fc(B, "B", VB, "2");
  // partida: botão em série com a0 (A recuado)
  c.wire(a0, "2", start, "1");
  c.wire(start, "2", VA, "14");
  c.wire(a1, "2", VB, "14");
  c.wire(b1, "2", VB, "12");
  c.wire(b0, "2", VA, "12");
  return { sim: c.build(), A, B, VA, start };
}

describe("sequência A+ B+ B− A−", () => {
  it("com roletes escamoteáveis: executa os quatro passos na ordem", () => {
    const { sim, A, B, start } = buildSequence(true);
    sim.run(0.5); // câmaras cheias antes da partida
    const ext = (id: string) => sim.snapshot().components[id].extension!;
    const events: string[] = [];
    let lastA = 0;
    let lastB = 0;
    sim.command({ type: "actuate", id: start, side: "left", active: true });
    sim.run(0.15);
    sim.command({ type: "actuate", id: start, side: "left", active: false });
    for (let i = 0; i < 4000 && events.length < 4; i++) {
      sim.step();
      const a = ext(A);
      const b = ext(B);
      if (a >= 1 && lastA < 1) events.push("A+");
      if (a <= 0 && lastA > 0) events.push("A-");
      if (b >= 1 && lastB < 1) events.push("B+");
      if (b <= 0 && lastB > 0) events.push("B-");
      lastA = a;
      lastB = b;
    }
    expect(events).toEqual(["A+", "B+", "B-", "A-"]);
  });

  it("com roletes comuns: o sinal preso trava a sequência e gera aviso", () => {
    const { sim, A, VA, start } = buildSequence(false);
    sim.run(0.5);
    sim.command({ type: "actuate", id: start, side: "left", active: true });
    sim.run(1.5);
    // b0 (B recuado) segura o piloto 12 de VA: A não consegue avançar
    expect(sim.snapshot().components[A].extension).toBe(0);
    expect(sim.snapshot().warnings.some((w) => w.componentId === VA && w.code === "stuck-signal")).toBe(true);
  });
});
