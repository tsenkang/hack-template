import { describe, expect, it } from "vitest";
import type { Simulation } from "../core/simulation";
import { runUntil, TestCircuit } from "../test-utils";

const st = (sim: Simulation, id: string) => sim.snapshot().components[id];
const act = (sim: Simulation, id: string, active: boolean, side: "left" | "right" = "left") =>
  sim.command({ type: "actuate", id, side, active });

/** Unidade hidráulica: tanque → bomba → alívio (de volta ao tanque). Devolve os ids. */
function powerUnit(c: TestCircuit, opts: { relief?: number; displacement?: number } = {}) {
  const tank = c.add("hyd.tank");
  const pump = c.add("hyd.pump.fixed", { displacement: opts.displacement ?? 8 });
  const relief = c.add("hyd.valve.relief", { setPressure: opts.relief ?? 100 });
  const tankReturn = c.add("hyd.tank");
  c.wire(tank, "T", pump, "S");
  c.wire(pump, "P", relief, "P");
  c.wire(relief, "T", tankReturn, "T");
  return { pump, tankReturn };
}

describe("hidráulica", () => {
  it("bomba bloqueada: a válvula de alívio limita a pressão no valor ajustado", () => {
    const c = new TestCircuit();
    const { pump } = powerUnit(c, { relief: 100 });
    const gauge = c.add("hyd.gauge.pressure");
    c.wire(pump, "P", gauge, "1");
    const sim = c.build();
    sim.run(1);
    const p = st(sim, gauge).pressure!;
    expect(p).toBeGreaterThan(98);
    expect(p).toBeLessThan(108);
  });

  /** Unidade + 4/3 (centro escolhido) + cilindro de dupla ação. */
  function cylinderCircuit(center: "closed" | "tandem", load = 0) {
    const c = new TestCircuit();
    const { pump, tankReturn } = powerUnit(c, { relief: 120 });
    const v = c.add(`hyd.valve.4-3-${center}.solenoid`);
    const cyl = c.add("hyd.cylinder.double-acting", { pistonDiameter: 40, rodDiameter: 22, stroke: 200, load });
    const gauge = c.add("hyd.gauge.pressure");
    c.wire(pump, "P", v, "P");
    c.wire(v, "T", tankReturn, "T");
    c.wire(v, "A", cyl, "A");
    c.wire(v, "B", cyl, "B");
    c.wire(pump, "P", gauge, "1");
    return { sim: c.build(), v, cyl, gauge };
  }

  it("cilindro avança com velocidade ≈ vazão da bomba ÷ área do êmbolo", () => {
    const { sim, v, cyl } = cylinderCircuit("tandem");
    sim.run(0.3);
    act(sim, v, true, "left");
    const t = runUntil(sim, () => st(sim, cyl).extension! >= 1, 5);
    // 8 cm³ × 1450 rpm = 11,6 l/min; área 40 mm = 12,57 cm² → 0,154 m/s → 200 mm em ~1,3 s
    expect(t).toBeGreaterThan(1.3 * 0.8);
    expect(t).toBeLessThan(1.3 * 1.25);
    // no fim do curso a pressão sobe até o alívio
    sim.run(0.5);
    expect(sim.pressureAt(cyl, "A")).toBeGreaterThan(110);
  });

  it("centro tandem descarrega a bomba; centro fechado segura o cilindro parado", () => {
    const tandem = cylinderCircuit("tandem");
    tandem.sim.run(0.5);
    expect(st(tandem.sim, tandem.gauge).pressure!).toBeLessThan(10);

    const closed = cylinderCircuit("closed", 2000);
    closed.sim.run(0.3);
    act(closed.sim, closed.v, true, "left");
    runUntil(closed.sim, () => st(closed.sim, closed.cyl).extension! > 0.5, 5);
    act(closed.sim, closed.v, false, "left");
    closed.sim.run(0.3);
    const stopped = st(closed.sim, closed.cyl).extension!;
    closed.sim.run(1);
    expect(Math.abs(st(closed.sim, closed.cyl).extension! - stopped)).toBeLessThan(0.01);
    // centro fechado: a bomba vai para o alívio
    expect(st(closed.sim, closed.gauge).pressure!).toBeGreaterThan(110);
  });

  it("reguladora compensada mantém a velocidade com cargas diferentes", () => {
    function time(load: number) {
      const c = new TestCircuit();
      const { pump, tankReturn } = powerUnit(c, { relief: 150 });
      const v = c.add("hyd.valve.4-2.solenoid-spring");
      const fc = c.add("hyd.flow.compensated", { flowSetting: 4 });
      const cyl = c.add("hyd.cylinder.double-acting", { stroke: 100, load });
      c.wire(pump, "P", fc, "1");
      c.wire(fc, "2", v, "P");
      c.wire(v, "T", tankReturn, "T");
      c.wire(v, "A", cyl, "A");
      c.wire(v, "B", cyl, "B");
      const sim = c.build();
      sim.run(0.3);
      act(sim, v, true);
      return runUntil(sim, () => st(sim, cyl).extension! >= 1, 10);
    }
    const light = time(0);
    const heavy = time(6000);
    expect(Math.abs(light - heavy) / light).toBeLessThan(0.1);
    // 4 l/min ÷ 12,57 cm² = 0,053 m/s → 100 mm em ~1,9 s
    expect(light).toBeGreaterThan(1.9 * 0.85);
    expect(light).toBeLessThan(1.9 * 1.15);
  });

  it("acumulador carrega com a pressão e devolve óleo quando ela cai", () => {
    const c = new TestCircuit();
    const { pump } = powerUnit(c, { relief: 100 });
    const acc = c.add("hyd.accumulator", { volume: 1, precharge: 50 });
    c.wire(pump, "P", acc, "1");
    const sim = c.build();
    sim.run(3);
    const charge = st(sim, acc).charge!;
    // p·V constante: a 100 bar, com pré-carga de 50 bar, metade do volume tem óleo (≈ 0,5)
    expect(charge).toBeGreaterThan(0.4);
    expect(charge).toBeLessThan(0.55);
  });

  it("motor hidráulico gira com rotação ≈ vazão ÷ deslocamento", () => {
    const c = new TestCircuit();
    const { pump, tankReturn } = powerUnit(c, { relief: 150 });
    const m = c.add("hyd.motor", { displacement: 10, torque: 2 });
    c.wire(pump, "P", m, "1");
    c.wire(m, "2", tankReturn, "T");
    const sim = c.build();
    sim.run(1);
    // 11,6 l/min ÷ 10 cm³ = 1160 rpm
    expect(st(sim, m).rpm!).toBeGreaterThan(1000);
    expect(st(sim, m).rpm!).toBeLessThan(1250);
  });

  it("retenção pilotada segura a carga até haver pressão no piloto", () => {
    const c = new TestCircuit();
    const { pump, tankReturn } = powerUnit(c, { relief: 100 });
    const v = c.add("hyd.valve.3-2.solenoid-spring");
    const pc = c.add("hyd.check.pilot");
    const cyl = c.add("hyd.cylinder.single-acting", { stroke: 100, load: 3000, springForce: 0 });
    const pilot = c.add("hyd.valve.2-2.button-spring");
    c.wire(pump, "P", v, "P");
    c.wire(v, "T", tankReturn, "T");
    c.wire(v, "A", pc, "A");
    c.wire(pc, "B", cyl, "A");
    c.wire(pump, "P", pilot, "P");
    c.wire(pilot, "A", pc, "X");
    const sim = c.build();
    act(sim, v, true);
    runUntil(sim, () => st(sim, cyl).extension! >= 1, 5);
    act(sim, v, false); // a válvula liga o cilindro ao tanque…
    sim.run(1);
    expect(st(sim, cyl).extension!).toBeGreaterThan(0.98); // …mas a retenção segura a carga
    act(sim, pilot, true); // pressão no piloto: libera a descida
    runUntil(sim, () => st(sim, cyl).extension! <= 0.02, 5);
    expect(st(sim, cyl).extension!).toBeLessThan(0.05);
  });

  it("eletro-hidráulica: o solenoide Y1 comanda a 4/2", () => {
    const c = new TestCircuit();
    const { pump, tankReturn } = powerUnit(c);
    const v = c.add("hyd.valve.4-2.solenoid-spring");
    const cyl = c.add("hyd.cylinder.double-acting", { stroke: 100 });
    c.wire(pump, "P", v, "P");
    c.wire(v, "T", tankReturn, "T");
    c.wire(v, "A", cyl, "A");
    c.wire(v, "B", cyl, "B");
    const plus = c.add("elec.supply.24v");
    const zero = c.add("elec.supply.0v");
    const s1 = c.add("elec.pushbutton.latching");
    const y1 = c.add("elec.solenoid.coil", {}, "Y1");
    c.wire(plus, "+", s1, "1");
    c.wire(s1, "2", y1, "A1");
    c.wire(y1, "A2", zero, "0");
    const sim = c.build();
    sim.run(0.3);
    expect(st(sim, cyl).extension).toBe(0);
    act(sim, s1, true);
    act(sim, s1, false);
    runUntil(sim, () => st(sim, cyl).extension! >= 1, 5);
    expect(st(sim, cyl).extension).toBe(1);
  });
});
