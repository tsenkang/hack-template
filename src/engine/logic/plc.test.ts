import { describe, expect, it } from "vitest";
import { TestCircuit, runUntil } from "../test-utils";
import { evaluate, formatExpression, parseExpression, type Memory } from "./expression";
import { checkProgram, PlcRuntime, serializeProgram, type PlcProgram } from "./plc";

const mem = (on: string[], steps: Record<number, number> = {}): Memory => ({
  get: (k, i) => on.includes(`${k}${i}`),
  stepTime: (s) => steps[s] ?? -1,
});

describe("expressões", () => {
  it("E, OU, NÃO e parênteses", () => {
    const r = parseExpression("(I0 | Q0) & !I1");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(evaluate(r.expr, mem(["I0"]))).toBe(true);
    expect(evaluate(r.expr, mem(["Q0"]))).toBe(true);
    expect(evaluate(r.expr, mem(["Q0", "I1"]))).toBe(false);
    expect(evaluate(r.expr, mem([]))).toBe(false);
    expect(formatExpression(r.expr)).toBe("(I0 | Q0) & !I1");
  });

  it("NÃO de um grupo vira contatos (De Morgan)", () => {
    const r = parseExpression("!(I0 & I1)");
    expect(r.ok && formatExpression(r.expr)).toBe("!I0 | !I1");
  });

  it("temporização do GRAFCET: 3s/X2", () => {
    const r = parseExpression("3s/X2");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(evaluate(r.expr, mem([], { 2: 2.9 }))).toBe(false);
    expect(evaluate(r.expr, mem([], { 2: 3 }))).toBe(true);
  });

  it("acusa erro de sintaxe", () => {
    expect(parseExpression("I0 &").ok).toBe(false);
    expect(parseExpression("(I0").ok).toBe(false);
    expect(parseExpression("").ok).toBe(false);
    expect(parseExpression("Z3").ok).toBe(false);
  });
});

const run = (plc: PlcRuntime, inputs: boolean[], seconds: number, dt = 0.01) => {
  let out: boolean[] = [];
  for (let t = 0; t < seconds - 1e-9; t += dt) out = plc.scan(inputs, dt);
  return out;
};

describe("ladder", () => {
  it("selo (partida e parada)", () => {
    const plc = new PlcRuntime({ rungs: [{ condition: "(I0 | Q0) & !I1", coil: "out", target: "Q0" }], steps: [], transitions: [] });
    expect(run(plc, [], 0.05)[0]).toBe(false);
    expect(run(plc, [true], 0.02)[0]).toBe(true);
    expect(run(plc, [], 0.05)[0]).toBe(true); // selo segura
    expect(run(plc, [false, true], 0.02)[0]).toBe(false);
    expect(run(plc, [], 0.05)[0]).toBe(false);
  });

  it("SET/RESET, temporizador TON e contador CTU", () => {
    const p: PlcProgram = {
      rungs: [
        { condition: "I0", coil: "set", target: "M0" },
        { condition: "I1", coil: "reset", target: "M0" },
        { condition: "M0", coil: "ton", target: "T0", preset: 1 },
        { condition: "T0", coil: "out", target: "Q0" },
        { condition: "I2", coil: "ctu", target: "C0", preset: 3 },
        { condition: "C0", coil: "out", target: "Q1" },
        { condition: "I3", coil: "ctr", target: "C0" },
      ],
      steps: [],
      transitions: [],
    };
    expect(checkProgram(p)).toEqual([]);
    const plc = new PlcRuntime(p);
    run(plc, [true], 0.02);
    expect(run(plc, [], 0.9)[0]).toBe(false);
    expect(run(plc, [], 0.2)[0]).toBe(true);
    expect(run(plc, [false, true], 0.02)[0]).toBe(false);
    for (let i = 0; i < 2; i++) {
      run(plc, [false, false, true], 0.02);
      run(plc, [], 0.02);
    }
    expect(run(plc, [], 0.02)[1]).toBe(false);
    run(plc, [false, false, true], 0.02);
    expect(run(plc, [], 0.02)[1]).toBe(true);
    expect(run(plc, [false, false, false, true], 0.02)[1]).toBe(false);
  });
});

describe("GRAFCET", () => {
  /** A+ B+ B− A− com sensores a0 (I1), a1 (I2), b0 (I3), b1 (I4) e partida I0. */
  const program: PlcProgram = {
    rungs: [],
    steps: [
      { n: 0, initial: true, actions: "" },
      { n: 1, actions: "Q0" },
      { n: 2, actions: "Q0 Q1" },
      { n: 3, actions: "Q0" },
      { n: 4, actions: "" },
    ],
    transitions: [
      { from: [0], to: [1], condition: "I0 & I1 & I3" },
      { from: [1], to: [2], condition: "I2" },
      { from: [2], to: [3], condition: "I4" },
      { from: [3], to: [4], condition: "I3" },
      { from: [4], to: [0], condition: "I1" },
    ],
  };

  it("evolui etapa por etapa e liga as ações", () => {
    expect(checkProgram(program)).toEqual([]);
    const plc = new PlcRuntime(program);
    run(plc, [false, true, false, true], 0.02);
    expect(plc.state().steps).toEqual([0]);
    expect(run(plc, [true, true, false, true], 0.02)[0]).toBe(true);
    expect(plc.state().steps).toEqual([1]);
    const q = run(plc, [false, false, true, true], 0.02);
    expect(plc.state().steps).toEqual([2]);
    expect(q.slice(0, 2)).toEqual([true, true]);
    run(plc, [false, false, true, false, true], 0.02);
    expect(plc.state().steps).toEqual([3]);
    run(plc, [false, false, true, true], 0.02);
    expect(plc.state().steps).toEqual([4]);
    run(plc, [false, true, false, true], 0.02);
    expect(plc.state().steps).toEqual([0]);
  });

  it("divergência em E e temporização", () => {
    const plc = new PlcRuntime({
      rungs: [],
      steps: [
        { n: 0, initial: true, actions: "" },
        { n: 1, actions: "Q0" },
        { n: 2, actions: "Q1" },
      ],
      transitions: [
        { from: [0], to: [1, 2], condition: "I0" },
        { from: [1, 2], to: [0], condition: "2s/X1" },
      ],
    });
    run(plc, [true], 0.02);
    expect(plc.state().steps).toEqual([1, 2]);
    run(plc, [], 1.9);
    expect(plc.state().steps).toEqual([1, 2]);
    run(plc, [], 0.2);
    expect(plc.state().steps).toEqual([0]);
  });

  it("aponta problemas do programa", () => {
    const issues = checkProgram({
      rungs: [{ condition: "I0 &", coil: "out", target: "T0" }],
      steps: [{ n: 1, actions: "" }],
      transitions: [{ from: [1], to: [7], condition: "1" }],
    });
    expect(issues.map((i) => `${i.where}:${i.message}`)).toEqual(["rung:syntax", "rung:target", "transition:from", "step:noInitial"]);
  });
});

describe("CLP na rede elétrica", () => {
  it("botão na entrada I0 liga a bobina na saída Q0 (com selo no programa)", () => {
    const c = new TestCircuit();
    const v24 = c.add("elec.supply.24v");
    const v0 = c.add("elec.supply.0v");
    const start = c.add("elec.pushbutton.no");
    const stop = c.add("elec.pushbutton.nc");
    const lamp = c.add("elec.lamp");
    const program = serializeProgram({ rungs: [{ condition: "(I0 | Q0) & I1", coil: "out", target: "Q0" }], steps: [], transitions: [] });
    const plc = c.add("elec.plc", { program });
    c.wire(v24, "+", plc, "L+");
    c.wire(v0, "0", plc, "M");
    c.wire(v24, "+", start, "1");
    c.wire(start, "2", plc, "I0");
    c.wire(v24, "+", stop, "1");
    c.wire(stop, "2", plc, "I1");
    c.wire(plc, "Q0", lamp, "X1");
    c.wire(lamp, "X2", v0, "0");
    const sim = c.build();
    const lit = () => sim.snapshot().components[lamp].energized === true;
    sim.run(0.05);
    expect(lit()).toBe(false);
    sim.command({ type: "actuate", id: start, side: "left", active: true });
    expect(runUntil(sim, lit, 0.2)).toBeLessThan(0.05);
    sim.command({ type: "actuate", id: start, side: "left", active: false });
    sim.run(0.1);
    expect(lit()).toBe(true);
    expect(sim.snapshot().components[plc].plc?.outputs[0]).toBe(true);
    sim.command({ type: "actuate", id: stop, side: "left", active: true });
    sim.run(0.05);
    expect(lit()).toBe(false);
  });
});
