import { describe, expect, it } from "vitest";
import type { Simulation } from "../core/simulation";
import { runUntil, TestCircuit } from "../test-utils";

const extension = (sim: Simulation, id: string) => sim.snapshot().components[id].extension!;
const press = (sim: Simulation, id: string, active: boolean, side: "left" | "right" = "left") =>
  sim.command({ type: "actuate", id, side, active });

describe("cilindro de simples ação com 3/2 NF por botão (comando direto)", () => {
  const c = new TestCircuit();
  const src = c.add("pneu.source.air");
  const v = c.add("pneu.valve.3-2-nc.button-spring");
  const cyl = c.add("pneu.cylinder.single-acting");
  c.wire(src, "1", v, "1");
  c.wire(v, "2", cyl, "A");
  const sim = c.build();

  it("em repouso a haste fica recuada e a câmara sem pressão", () => {
    sim.run(0.5);
    expect(extension(sim, cyl)).toBe(0);
    expect(sim.pressureAt(cyl, "A")).toBeCloseTo(0, 1);
  });

  it("apertando o botão a haste avança e a pressão chega a ~6 bar", () => {
    press(sim, v, true);
    const t = runUntil(sim, () => extension(sim, cyl) >= 1);
    expect(t).toBeLessThan(1);
    sim.run(0.5);
    expect(sim.pressureAt(cyl, "A")).toBeGreaterThan(5.8);
  });

  it("soltando, a mola recolhe a haste e o ar escapa por 3", () => {
    press(sim, v, false);
    const t = runUntil(sim, () => extension(sim, cyl) <= 0);
    expect(t).toBeLessThan(1.5);
    sim.run(0.5);
    expect(sim.pressureAt(cyl, "A")).toBeLessThan(0.1);
  });
});

/** Cilindro de dupla ação comandado por 5/2 duplo piloto, com dois botões (comando indireto). */
function indirectCircuit(extraParams: Record<string, number> = {}) {
  const c = new TestCircuit();
  const src = c.add("pneu.source.air");
  const start = c.add("pneu.valve.3-2-nc.button-spring");
  const back = c.add("pneu.valve.3-2-nc.button-spring");
  const main = c.add("pneu.valve.5-2.pilot-pilot");
  const cyl = c.add("pneu.cylinder.double-acting", extraParams);
  c.wire(src, "1", start, "1");
  c.wire(src, "1", back, "1");
  c.wire(src, "1", main, "1");
  c.wire(start, "2", main, "14");
  c.wire(back, "2", main, "12");
  c.wire(main, "4", cyl, "A");
  c.wire(main, "2", cyl, "B");
  return { c, src, start, back, main, cyl };
}

describe("cilindro de dupla ação com 5/2 duplo piloto (memória)", () => {
  const { c, start, back, main, cyl } = indirectCircuit();
  const sim = c.build();

  it("em repouso 1→2 alimenta a câmara dianteira (B): haste recuada", () => {
    sim.run(0.5);
    expect(extension(sim, cyl)).toBe(0);
    expect(sim.pressureAt(cyl, "B")).toBeGreaterThan(5.8);
  });

  it("um pulso no piloto 14 avança a haste e a válvula memoriza", () => {
    press(sim, start, true);
    sim.run(0.1);
    press(sim, start, false);
    runUntil(sim, () => extension(sim, cyl) >= 1, 2);
    expect(extension(sim, cyl)).toBe(1);
    expect(sim.snapshot().components[main].spool).toBe(0);
    sim.run(0.5);
    expect(extension(sim, cyl)).toBe(1); // continua avançado sem o botão
    expect(sim.pressureAt(cyl, "B")).toBeLessThan(0.1);
  });

  it("um pulso no piloto 12 faz a haste voltar", () => {
    press(sim, back, true);
    sim.run(0.1);
    press(sim, back, false);
    runUntil(sim, () => extension(sim, cyl) <= 0, 2);
    expect(extension(sim, cyl)).toBe(0);
  });

  it("com os dois pilotos ao mesmo tempo o êmbolo não troca (sinal preso)", () => {
    press(sim, back, true);
    press(sim, start, true);
    sim.run(0.5);
    expect(extension(sim, cyl)).toBe(0);
  });
});

describe("retorno automático por fim de curso (rolete)", () => {
  it("avança, encosta no rolete em 100% e volta sozinho", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const start = c.add("pneu.valve.3-2-nc.button-spring");
    const main = c.add("pneu.valve.5-2.pilot-pilot");
    const cyl = c.add("pneu.cylinder.double-acting");
    const roller = c.add("pneu.valve.3-2-nc.roller-spring", { position: 100 });
    c.project.circuits[0].components.find((k) => k.id === roller)!.params.cylinder = c.label(cyl);
    c.wire(src, "1", start, "1");
    c.wire(src, "1", roller, "1");
    c.wire(src, "1", main, "1");
    c.wire(start, "2", main, "14");
    c.wire(roller, "2", main, "12");
    c.wire(main, "4", cyl, "A");
    c.wire(main, "2", cyl, "B");
    const sim = c.build();
    sim.run(0.3);
    press(sim, start, true);
    sim.run(0.05);
    press(sim, start, false);
    runUntil(sim, () => extension(sim, cyl) >= 1, 2);
    expect(extension(sim, cyl)).toBe(1);
    runUntil(sim, () => extension(sim, cyl) <= 0, 2);
    expect(extension(sim, cyl)).toBe(0);
  });
});

describe("reguladora de vazão unidirecional (controle de velocidade)", () => {
  function extendTime(opening: number) {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.solenoid-spring");
    const cyl = c.add("pneu.cylinder.double-acting");
    const fc = c.add("pneu.flow-control.one-way", { opening });
    c.wire(src, "1", v, "1");
    c.wire(v, "4", cyl, "A");
    // Controle na saída do ar (meter-out): estrangula o escape da câmara B.
    c.wire(cyl, "B", fc, "1");
    c.wire(fc, "2", v, "2");
    const sim = c.build();
    sim.run(0.5);
    press(sim, v, true); // acionamento manual do solenoide
    return runUntil(sim, () => extension(sim, cyl) >= 1, 20);
  }

  it("menos abertura = cilindro mais lento", () => {
    const fast = extendTime(100);
    const slow = extendTime(10);
    expect(fast).toBeLessThan(1);
    expect(slow).toBeGreaterThan(fast * 3);
  });
});

describe("válvula de retenção", () => {
  it("passa de 1 para 2 e bloqueia de 2 para 1", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const chk = c.add("pneu.check-valve");
    const gauge = c.add("pneu.gauge.pressure");
    c.wire(src, "1", chk, "1");
    c.wire(chk, "2", gauge, "1");
    const sim = c.build();
    sim.run(0.5);
    expect(sim.pressureAt(gauge, "1")).toBeGreaterThan(5.5);

    const r = new TestCircuit();
    const s2 = r.add("pneu.source.air");
    const k2 = r.add("pneu.check-valve");
    const g2 = r.add("pneu.gauge.pressure");
    r.wire(s2, "1", k2, "2");
    r.wire(k2, "1", g2, "1");
    const sim2 = r.build();
    sim2.run(0.5);
    expect(sim2.pressureAt(g2, "1")).toBeCloseTo(0, 2);
  });
});

describe("fonte, unidade de conservação e conectores soltos", () => {
  it("a unidade de conservação reduz para a pressão ajustada", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air", { pressure: 8 });
    const frl = c.add("pneu.source.service-unit", { setPressure: 4 });
    const gauge = c.add("pneu.gauge.pressure");
    c.wire(src, "1", frl, "1");
    c.wire(frl, "2", gauge, "1");
    const sim = c.build();
    sim.run(1);
    expect(sim.snapshot().components[gauge].pressure).toBeCloseTo(4, 0);
    // Mudar o ajuste durante a simulação: o excesso é aliviado.
    sim.command({ type: "param", id: frl, key: "setPressure", value: 2 });
    sim.run(2);
    expect(sim.pressureAt(gauge, "1")).toBeCloseTo(2, 0);
  });

  it("um conector solto deixa o ar escapar (a pressão cai)", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.3-2-nc.button-spring");
    c.wire(src, "1", v, "1");
    const sim = c.build();
    sim.run(0.2);
    expect(Math.abs(Object.values(sim.snapshot().wires)[0].q)).toBeLessThan(1);
    sim.command({ type: "actuate", id: v, side: "left", active: true });
    sim.run(0.5);
    // Válvula aberta e via 2 solta: o ar escapa continuamente pela linha da fonte.
    expect(Object.values(sim.snapshot().wires)[0].q).toBeGreaterThan(100);
  });

  it("a linha mostra a vazão no sentido do escoamento", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.3-2-nc.button-spring");
    const cyl = c.add("pneu.cylinder.double-acting", { stroke: 500 });
    c.wire(src, "1", v, "1");
    c.wire(v, "2", cyl, "A");
    const sim = c.build();
    sim.run(0.2);
    press(sim, v, true);
    sim.run(0.05);
    const snap = sim.snapshot();
    const [w1, w2] = Object.values(snap.wires);
    expect(w1.q).toBeGreaterThan(10); // da fonte para a válvula
    expect(w2.q).toBeGreaterThan(10); // da válvula para o cilindro
  });
});
