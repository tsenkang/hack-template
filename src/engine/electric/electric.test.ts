import { describe, expect, it } from "vitest";
import type { Simulation } from "../core/simulation";
import { runUntil, TestCircuit } from "../test-utils";

const st = (sim: Simulation, id: string) => sim.snapshot().components[id];
const press = (sim: Simulation, id: string, active: boolean, side: "left" | "right" = "left") =>
  sim.command({ type: "actuate", id, side, active });
/** Clique rápido (aperta e solta). */
const click = (sim: Simulation, id: string) => {
  press(sim, id, true);
  sim.run(0.02);
  press(sim, id, false);
};

/** Fonte de 24 V com os polos já criados. */
function supply(c: TestCircuit) {
  return { plus: c.add("elec.supply.24v"), zero: c.add("elec.supply.0v") };
}

describe("comando elétrico", () => {
  it("botão NA acende a lâmpada", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const s1 = c.add("elec.pushbutton.no");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", s1, "1");
    c.wire(s1, "2", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    const sim = c.build();
    sim.run(0.05);
    expect(st(sim, h1).energized).toBe(false);
    press(sim, s1, true);
    sim.run(0.02);
    expect(st(sim, h1).energized).toBe(true);
    expect(st(sim, s1).closed).toBe(true);
    // corrente da lâmpada (24 V, 2 W ≈ 83 mA) aparece nos fios
    expect(Math.abs(Object.values(sim.snapshot().wires)[0].q)).toBeGreaterThan(50);
  });

  it("selo: o relé continua ligado depois de soltar o botão, até apertar o desliga", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const stop = c.add("elec.pushbutton.nc");
    const start = c.add("elec.pushbutton.no");
    const seal = c.add("elec.relay.contact-no", {}, "K1");
    const k1 = c.add("elec.relay.coil", {}, "K1");
    c.wire(plus, "+", stop, "1");
    c.wire(stop, "2", start, "1");
    c.wire(stop, "2", seal, "1");
    c.wire(start, "2", k1, "A1");
    c.wire(seal, "2", k1, "A1");
    c.wire(k1, "A2", zero, "0");
    const sim = c.build();
    click(sim, start);
    sim.run(0.2);
    expect(st(sim, k1).energized).toBe(true);
    click(sim, stop);
    sim.run(0.2);
    expect(st(sim, k1).energized).toBe(false);
  });

  it("intertravamento: K1 e K2 nunca ligam juntos", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const s1 = c.add("elec.pushbutton.no");
    const s2 = c.add("elec.pushbutton.no");
    const nc2 = c.add("elec.relay.contact-nc", {}, "K2");
    const nc1 = c.add("elec.relay.contact-nc", {}, "K1");
    const k1 = c.add("elec.relay.coil", {}, "K1");
    const k2 = c.add("elec.relay.coil", {}, "K2");
    c.wire(plus, "+", s1, "1");
    c.wire(plus, "+", s2, "1");
    c.wire(s1, "2", nc2, "1");
    c.wire(nc2, "2", k1, "A1");
    c.wire(s2, "2", nc1, "1");
    c.wire(nc1, "2", k2, "A1");
    c.wire(k1, "A2", zero, "0");
    c.wire(k2, "A2", zero, "0");
    const sim = c.build();
    press(sim, s1, true);
    sim.run(0.1);
    press(sim, s2, true);
    sim.run(0.1);
    expect(st(sim, k1).energized).toBe(true);
    expect(st(sim, k2).energized).toBe(false);
  });

  it("relé temporizado com retardo na ligação", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const s1 = c.add("elec.pushbutton.latching");
    const kt = c.add("elec.timer.on-delay", { delay: 1 }, "K1");
    const contact = c.add("elec.relay.contact-no", {}, "K1");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", s1, "1");
    c.wire(s1, "2", kt, "A1");
    c.wire(kt, "A2", zero, "0");
    c.wire(plus, "+", contact, "1");
    c.wire(contact, "2", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    const sim = c.build();
    click(sim, s1); // trava ligado
    const t = runUntil(sim, () => st(sim, h1).energized === true, 3);
    expect(t).toBeGreaterThan(0.95);
    expect(t).toBeLessThan(1.05);
  });

  it("contador: a lâmpada acende no 3º pulso e o reset zera", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const s1 = c.add("elec.pushbutton.no");
    const s2 = c.add("elec.pushbutton.no");
    const cnt = c.add("elec.counter.coil", { preset: 3 }, "C1");
    const rst = c.add("elec.counter.reset", {}, "C1");
    const contact = c.add("elec.relay.contact-no", {}, "C1");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", s1, "1");
    c.wire(s1, "2", cnt, "A1");
    c.wire(cnt, "A2", zero, "0");
    c.wire(plus, "+", s2, "1");
    c.wire(s2, "2", rst, "A1");
    c.wire(rst, "A2", zero, "0");
    c.wire(plus, "+", contact, "1");
    c.wire(contact, "2", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    const sim = c.build();
    for (let k = 0; k < 3; k++) {
      click(sim, s1);
      sim.run(0.05);
    }
    expect(st(sim, cnt).count).toBe(3);
    expect(st(sim, h1).energized).toBe(true);
    click(sim, s2);
    sim.run(0.05);
    expect(st(sim, cnt).count).toBe(0);
    expect(st(sim, h1).energized).toBe(false);
  });

  it("curto-circuito sem fusível: a fonte desliga e aparece o aviso", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const s1 = c.add("elec.pushbutton.no");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    c.wire(plus, "+", s1, "1");
    c.wire(s1, "2", zero, "0"); // botão liga + direto no 0 V
    const sim = c.build();
    sim.run(0.05);
    expect(st(sim, h1).energized).toBe(true);
    press(sim, s1, true);
    sim.run(0.05);
    expect(sim.snapshot().warnings.map((w) => w.code)).toContain("short-circuit");
    expect(st(sim, h1).energized).toBe(false);
  });

  it("curto-circuito com fusível: o fusível queima e o resto continua sem tensão até trocar", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const f1 = c.add("elec.fuse", { current: 2 });
    const s1 = c.add("elec.pushbutton.no");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", f1, "1");
    c.wire(f1, "2", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    c.wire(f1, "2", s1, "1");
    c.wire(s1, "2", zero, "0");
    const sim = c.build();
    press(sim, s1, true);
    sim.run(0.05);
    expect(st(sim, f1).blown).toBe(true);
    expect(st(sim, h1).energized).toBe(false);
    expect(sim.snapshot().warnings.map((w) => w.code)).toContain("fuse-blown");
    press(sim, s1, false);
    sim.run(0.02);
    click(sim, f1); // troca o fusível
    sim.run(0.05);
    expect(st(sim, h1).energized).toBe(true);
  });

  it("botão de emergência trava aberto até destravar", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const em = c.add("elec.pushbutton.emergency");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", em, "1");
    c.wire(em, "2", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    const sim = c.build();
    sim.run(0.02);
    expect(st(sim, h1).energized).toBe(true);
    click(sim, em);
    sim.run(0.5);
    expect(st(sim, h1).energized).toBe(false);
    click(sim, em);
    sim.run(0.02);
    expect(st(sim, h1).energized).toBe(true);
  });

  it("diodo bloqueia no sentido inverso", () => {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const d = c.add("elec.diode");
    const h1 = c.add("elec.lamp");
    c.wire(plus, "+", d, "K"); // ao contrário
    c.wire(d, "A", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    const sim = c.build();
    sim.run(0.02);
    expect(st(sim, h1).energized).toBe(false);
  });

  it("lâmpada de 24 V em 220 V: aviso de sobretensão", () => {
    const c = new TestCircuit();
    const l = c.add("elec.supply.line");
    const n = c.add("elec.supply.neutral");
    const h1 = c.add("elec.lamp");
    c.wire(l, "L", h1, "X1");
    c.wire(h1, "X2", n, "N");
    const sim = c.build();
    sim.run(0.02);
    expect(sim.snapshot().warnings.map((w) => w.code)).toContain("overvoltage");
  });
});

describe("eletropneumática", () => {
  /** Botão → solenoide Y1 → válvula 5/2 → cilindro; sensor reed no fim do curso acende H1. */
  function build() {
    const c = new TestCircuit();
    const { plus, zero } = supply(c);
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.solenoid-spring");
    const cyl = c.add("pneu.cylinder.double-acting", {}, "A1");
    const s1 = c.add("elec.pushbutton.latching");
    const y1 = c.add("elec.solenoid.coil", {}, "Y1");
    const b1 = c.add("elec.sensor.reed", { cylinder: "A1", position: 100 });
    const h1 = c.add("elec.lamp");
    const ps = c.add("elec.pressure-switch", { setPressure: 4 });
    const h2 = c.add("elec.lamp");
    c.wire(src, "1", v, "1");
    c.wire(v, "4", cyl, "A");
    c.wire(v, "2", cyl, "B");
    c.wire(plus, "+", s1, "1");
    c.wire(s1, "2", y1, "A1");
    c.wire(y1, "A2", zero, "0");
    c.wire(plus, "+", b1, "1");
    c.wire(b1, "2", h1, "X1");
    c.wire(h1, "X2", zero, "0");
    // pressostato na câmara traseira: acende H2 quando o cilindro está empurrando
    c.wire(cyl, "A", ps, "P");
    c.wire(plus, "+", ps, "1");
    c.wire(ps, "2", h2, "X1");
    c.wire(h2, "X2", zero, "0");
    return { sim: c.build(), v, cyl, s1, h1, h2 };
  }

  it("o solenoide Y1 comanda a válvula; o sensor e o pressostato acendem as lâmpadas", () => {
    const { sim, cyl, s1, h1, h2, v } = build();
    expect(st(sim, v)).toBeDefined();
    sim.run(0.3);
    expect(st(sim, h1).energized).toBe(false);
    click(sim, s1);
    runUntil(sim, () => st(sim, cyl).extension! >= 1, 2);
    sim.run(0.3);
    expect(st(sim, h1).energized).toBe(true);
    expect(st(sim, h2).energized).toBe(true);
    click(sim, s1); // destrava: Y1 desliga, a mola volta a válvula
    runUntil(sim, () => st(sim, cyl).extension! <= 0, 2);
    sim.run(0.2);
    expect(st(sim, h1).energized).toBe(false);
    expect(st(sim, h2).energized).toBe(false);
  });
});
