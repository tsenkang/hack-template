import { describe, expect, it } from "vitest";
import type { Simulation } from "../core/simulation";
import { runUntil, TestCircuit } from "../test-utils";

const comp = (sim: Simulation, id: string) => sim.snapshot().components[id];
const ext = (sim: Simulation, id: string) => comp(sim, id).extension!;
const act = (sim: Simulation, id: string, active: boolean, side: "left" | "right" = "left") =>
  sim.command({ type: "actuate", id, side, active });

/** Duas válvulas de botão alimentando as entradas 1a e 1b de uma válvula lógica. */
function logicCircuit(type: "pneu.valve.and" | "pneu.valve.or") {
  const c = new TestCircuit();
  const src = c.add("pneu.source.air");
  const a = c.add("pneu.valve.3-2-nc.button-spring");
  const b = c.add("pneu.valve.3-2-nc.button-spring");
  const logic = c.add(type);
  const gauge = c.add("pneu.gauge.pressure");
  c.wire(src, "1", a, "1");
  c.wire(src, "1", b, "1");
  c.wire(a, "2", logic, "1a");
  c.wire(b, "2", logic, "1b");
  c.wire(logic, "2", gauge, "1");
  const sim = c.build();
  const out = () => sim.pressureAt(gauge, "1");
  return { sim, a, b, out };
}

describe("válvulas lógicas", () => {
  it("E (simultaneidade): só tem saída com as duas entradas", () => {
    const { sim, a, b, out } = logicCircuit("pneu.valve.and");
    act(sim, a, true);
    sim.run(0.5);
    expect(out()).toBeLessThan(0.3);
    act(sim, b, true);
    sim.run(0.5);
    expect(out()).toBeGreaterThan(5.5);
    act(sim, a, false);
    sim.run(0.5);
    expect(out()).toBeLessThan(0.3);
  });

  it("OU (alternadora): qualquer entrada dá saída, sem vazar pela outra", () => {
    const { sim, a, b, out } = logicCircuit("pneu.valve.or");
    sim.run(0.2);
    expect(out()).toBeLessThan(0.1);
    act(sim, b, true);
    sim.run(0.5);
    expect(out()).toBeGreaterThan(5.5);
    act(sim, b, false);
    act(sim, a, true);
    sim.run(0.5);
    expect(out()).toBeGreaterThan(5.5);
  });
});

describe("escape rápido", () => {
  function retractTime(withQuickExhaust: boolean) {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.solenoid-spring", { nominalFlow: 150 });
    const cyl = c.add("pneu.cylinder.double-acting", { pistonDiameter: 50, stroke: 200 });
    c.wire(src, "1", v, "1");
    c.wire(v, "2", cyl, "B");
    if (withQuickExhaust) {
      const qe = c.add("pneu.valve.quick-exhaust");
      c.wire(v, "4", qe, "1");
      c.wire(qe, "2", cyl, "A");
    } else c.wire(v, "4", cyl, "A");
    const sim = c.build();
    act(sim, v, true);
    runUntil(sim, () => ext(sim, cyl) >= 1, 5);
    sim.run(0.3);
    act(sim, v, false);
    return runUntil(sim, () => ext(sim, cyl) <= 0, 5);
  }

  it("o retorno fica mais rápido", () => {
    const normal = retractTime(false);
    const quick = retractTime(true);
    expect(quick).toBeLessThan(normal * 0.85);
  });
});

/** Botão → temporizador → manômetro na saída 2. */
function timerCircuit(type: "pneu.timer.on-delay" | "pneu.timer.off-delay", delay: number) {
  const c = new TestCircuit();
  const src = c.add("pneu.source.air");
  const btn = c.add("pneu.valve.3-2-nc.button-spring");
  const timer = c.add(type, { delay });
  const gauge = c.add("pneu.gauge.pressure");
  c.wire(src, "1", btn, "1");
  c.wire(src, "1", timer, "1");
  c.wire(btn, "2", timer, "12");
  c.wire(timer, "2", gauge, "1");
  const sim = c.build();
  return { sim, btn, out: () => sim.pressureAt(gauge, "1") };
}

describe("temporizadores", () => {
  it("retardo na ligação: a saída liga perto do tempo ajustado e desliga na hora", () => {
    const { sim, btn, out } = timerCircuit("pneu.timer.on-delay", 2);
    sim.run(0.2);
    act(sim, btn, true);
    const t = runUntil(sim, () => out() > 3, 6);
    expect(t).toBeGreaterThan(2 * 0.8);
    expect(t).toBeLessThan(2 * 1.2);
    act(sim, btn, false);
    const off = runUntil(sim, () => out() < 0.5, 2);
    expect(off).toBeLessThan(0.3);
  });

  it("retardo no desligamento: liga na hora e desliga depois do tempo", () => {
    const { sim, btn, out } = timerCircuit("pneu.timer.off-delay", 2);
    sim.run(0.2);
    act(sim, btn, true);
    expect(runUntil(sim, () => out() > 3, 2)).toBeLessThan(0.3);
    sim.run(0.5);
    act(sim, btn, false);
    const t = runUntil(sim, () => out() < 0.5, 8);
    expect(t).toBeGreaterThan(2 * 0.7);
    expect(t).toBeLessThan(2 * 1.4);
  });
});

describe("contador", () => {
  it("libera a saída no 3º pulso e zera com o sinal em 10", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const pulse = c.add("pneu.valve.3-2-nc.button-spring");
    const reset = c.add("pneu.valve.3-2-nc.button-spring");
    const counter = c.add("pneu.counter", { preset: 3 });
    const gauge = c.add("pneu.gauge.pressure");
    c.wire(src, "1", pulse, "1");
    c.wire(src, "1", reset, "1");
    c.wire(src, "1", counter, "1");
    c.wire(pulse, "2", counter, "12");
    c.wire(reset, "2", counter, "10");
    c.wire(counter, "2", gauge, "1");
    const sim = c.build();
    for (let k = 1; k <= 3; k++) {
      act(sim, pulse, true);
      sim.run(0.2);
      act(sim, pulse, false);
      sim.run(0.2);
      expect(comp(sim, counter).count).toBe(k);
      if (k < 3) expect(sim.pressureAt(gauge, "1")).toBeLessThan(0.3);
    }
    expect(sim.pressureAt(gauge, "1")).toBeGreaterThan(5);
    act(sim, reset, true);
    sim.run(0.3);
    expect(comp(sim, counter).count).toBe(0);
    expect(sim.pressureAt(gauge, "1")).toBeLessThan(0.3);
  });
});

describe("válvulas direcionais novas", () => {
  it("5/3 centro fechado para o cilindro no meio do curso", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-3-closed.solenoid");
    const fc = c.add("pneu.flow-control.one-way", { opening: 15 });
    const cyl = c.add("pneu.cylinder.double-acting", { stroke: 200 });
    c.wire(src, "1", v, "1");
    c.wire(v, "4", cyl, "A");
    c.wire(v, "2", fc, "2");
    c.wire(fc, "1", cyl, "B");
    const sim = c.build();
    sim.run(0.5);
    act(sim, v, true, "left");
    runUntil(sim, () => ext(sim, cyl) > 0.4, 5);
    act(sim, v, false, "left");
    sim.run(0.5);
    const stopped = ext(sim, cyl);
    expect(stopped).toBeGreaterThan(0.3);
    expect(stopped).toBeLessThan(0.9);
    expect(comp(sim, v).spool).toBe(1); // voltou ao centro pelas molas
    sim.run(1);
    expect(Math.abs(ext(sim, cyl) - stopped)).toBeLessThan(0.02);
  });

  it("alavanca com trava: um clique liga e fica; outro clique desliga", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.lever-detent");
    const cyl = c.add("pneu.cylinder.double-acting");
    c.wire(src, "1", v, "1");
    c.wire(v, "4", cyl, "A");
    c.wire(v, "2", cyl, "B");
    const sim = c.build();
    act(sim, v, true);
    act(sim, v, false);
    sim.run(1);
    expect(ext(sim, cyl)).toBe(1);
    act(sim, v, true);
    act(sim, v, false);
    sim.run(1);
    expect(ext(sim, cyl)).toBe(0);
  });

  it("válvula de sequência só comuta acima da pressão ajustada", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const reg = c.add("pneu.valve.pressure-regulator", { setPressure: 3 });
    const seq = c.add("pneu.valve.sequence", { switchPressure: 4 });
    const gauge = c.add("pneu.gauge.pressure");
    c.wire(src, "1", reg, "1");
    c.wire(reg, "2", seq, "12");
    c.wire(src, "1", seq, "1");
    c.wire(seq, "2", gauge, "1");
    const sim = c.build();
    sim.run(0.5);
    expect(sim.pressureAt(gauge, "1")).toBeLessThan(0.3);
    sim.command({ type: "param", id: reg, key: "setPressure", value: 5 });
    sim.run(0.5);
    expect(sim.pressureAt(gauge, "1")).toBeGreaterThan(5.5);
  });

  it("rolete escamoteável aciona só no sentido ajustado", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.solenoid-spring");
    const cyl = c.add("pneu.cylinder.double-acting", { stroke: 200 });
    const fc = c.add("pneu.flow-control.one-way", { opening: 15 });
    const trig = c.add("pneu.valve.3-2-nc.roller-oneway-spring", { position: 50, direction: "advance" });
    c.project.circuits[0].components.find((k) => k.id === trig)!.params.cylinder = c.label(cyl);
    c.wire(src, "1", v, "1");
    c.wire(src, "1", trig, "1");
    c.wire(v, "4", cyl, "A");
    c.wire(v, "2", fc, "2");
    c.wire(fc, "1", cyl, "B");
    const sim = c.build();
    // spool 1 = repouso; quanto menor, mais acionada a válvula ficou ao passar
    let minAdvance = 1;
    let minReturn = 1;
    sim.run(0.5); // câmara B cheia antes de partir (senão a haste dá um "tranco")
    act(sim, v, true);
    runUntil(sim, () => {
      minAdvance = Math.min(minAdvance, comp(sim, trig).spool!);
      return ext(sim, cyl) >= 1;
    }, 10);
    act(sim, v, false);
    runUntil(sim, () => {
      minReturn = Math.min(minReturn, comp(sim, trig).spool!);
      return ext(sim, cyl) <= 0;
    }, 10);
    expect(minAdvance).toBeLessThan(0.2);
    expect(minReturn).toBe(1);
  });
});

describe("atuadores novos", () => {
  it("haste dupla: avanço e retorno com a mesma velocidade", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.solenoid-spring");
    const cyl = c.add("pneu.cylinder.through-rod", { stroke: 300 });
    c.wire(src, "1", v, "1");
    c.wire(v, "4", cyl, "A");
    c.wire(v, "2", cyl, "B");
    const sim = c.build();
    sim.run(0.5);
    act(sim, v, true);
    const out = runUntil(sim, () => ext(sim, cyl) >= 1);
    sim.run(0.5);
    act(sim, v, false);
    const back = runUntil(sim, () => ext(sim, cyl) <= 0);
    expect(Math.abs(out - back) / out).toBeLessThan(0.15);
  });

  it("amortecimento deixa o fim do curso mais lento", () => {
    function time(cushioning: number) {
      const c = new TestCircuit();
      const src = c.add("pneu.source.air");
      const v = c.add("pneu.valve.5-2.solenoid-spring");
      const cyl = c.add("pneu.cylinder.cushioned", { cushioning, stroke: 100 });
      c.wire(src, "1", v, "1");
      c.wire(v, "4", cyl, "A");
      c.wire(v, "2", cyl, "B");
      const sim = c.build();
      sim.run(0.3);
      act(sim, v, true);
      return runUntil(sim, () => ext(sim, cyl) >= 1);
    }
    expect(time(100)).toBeGreaterThan(time(0) * 1.2);
  });

  it("motor pneumático gira com ar em 1", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.3-2-nc.button-spring");
    const m = c.add("pneu.motor");
    c.wire(src, "1", v, "1");
    c.wire(v, "2", m, "1");
    const sim = c.build();
    sim.run(0.2);
    expect(Math.abs(comp(sim, m).rpm!)).toBeLessThan(1);
    act(sim, v, true);
    sim.run(0.5);
    expect(comp(sim, m).rpm!).toBeGreaterThan(100);
  });

  it("gerador de vácuo faz a ventosa segurar a peça", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.3-2-nc.button-spring");
    const ej = c.add("pneu.vacuum.generator");
    const cup = c.add("pneu.vacuum.cup");
    c.wire(src, "1", v, "1");
    c.wire(v, "2", ej, "1");
    c.wire(ej, "2", cup, "1");
    const sim = c.build();
    sim.run(0.3);
    expect(comp(sim, cup).holding).toBe(false);
    act(sim, v, true);
    sim.run(1);
    expect(comp(sim, cup).holding).toBe(true);
    expect(comp(sim, cup).pressure!).toBeLessThan(-0.5);
  });
});

describe("avisos durante a simulação", () => {
  it("sobrepressão, sinal preso e vazamento", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air", { pressure: 8 });
    const a = c.add("pneu.valve.3-2-nc.button-spring");
    const b = c.add("pneu.valve.3-2-nc.button-spring");
    const main = c.add("pneu.valve.5-2.pilot-pilot");
    const cyl = c.add("pneu.cylinder.double-acting", { maxPressure: 6 });
    const leaky = c.add("pneu.valve.3-2-nc.button-spring");
    c.wire(src, "1", a, "1");
    c.wire(src, "1", b, "1");
    c.wire(src, "1", main, "1");
    c.wire(src, "1", leaky, "1");
    c.wire(a, "2", main, "14");
    c.wire(b, "2", main, "12");
    c.wire(main, "4", cyl, "A");
    c.wire(main, "2", cyl, "B");
    const sim = c.build();
    act(sim, a, true);
    act(sim, b, true);
    act(sim, leaky, true); // via 2 da válvula solta: ar escapando
    sim.run(0.5);
    const codes = sim.snapshot().warnings.map((w) => `${w.componentId}:${w.code}`);
    expect(codes).toContain(`${cyl}:overpressure`);
    expect(codes).toContain(`${main}:stuck-signal`);
    expect(codes).toContain(`${leaky}:leak`);
    // escapes (3, 5) soltos não são vazamento
    expect(codes.filter((k) => k.endsWith(":leak"))).toHaveLength(1);
  });
});
