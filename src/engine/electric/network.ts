/**
 * Rede elétrica (comando em 24 V CC ou 220 V CA tratado como "tensão eficaz").
 *
 * A cada passo:
 *  1. lê o estado de cada contato (botões, relés, sensores…), usando o estado dos
 *     relés do passo anterior — como um relé real, que leva um instante para atracar;
 *  2. resolve tensões e correntes por análise nodal (contato fechado = 0,01 Ω,
 *     bobina/lâmpada = resistência pela potência nominal), com diodos e fusíveis
 *     ajustados por iteração;
 *  3. detecta curto-circuito (corrente enorme por um caminho sem carga): o fusível
 *     no caminho queima; sem fusível, a fonte desliga e aparece o aviso;
 *  4. atualiza relés, temporizadores, contadores e solenoides pelo rótulo.
 */
import type { Runtime } from "../core/element";
import { num } from "../core/element";
import type { ComponentSimState, ElectricSpec, RuntimeWarning, SimCircuit, SimComponent } from "../core/sim-types";
import { isElectric, portKey } from "../core/sim-types";
import type { ParamValue } from "../core/types";
import { BAR, P_ATM } from "../pneumatic/flow";
import { solveDense } from "../solver/dense";

/** Resistência de um contato fechado [Ω] e de um diodo conduzindo. */
const R_CLOSED = 0.01;
const R_DIODE = 0.1;
/** Fuga para o terra que evita nós "flutuando" (matriz singular) [S]. */
const LEAK = 1e-9;
/** Corrente que caracteriza curto-circuito [A]. */
const SHORT_CURRENT = 20;
/** Faixa de funcionamento das cargas: abaixo de 70% da tensão nominal não liga; acima de 130% é sobretensão. */
const PICKUP = 0.7;
const OVERVOLTAGE = 1.3;
/** Histerese do pressostato [Pa]. */
const PRESSURE_HYSTERESIS = 0.2 * BAR;

/** Potência nominal [W] de cada tipo de carga (para calcular a resistência). */
const LOAD_POWER: Record<string, number> = {
  "relay-coil": 1.2,
  "solenoid-coil": 4,
  "timer-on": 1.2,
  "timer-off": 1.2,
  counter: 1.2,
  "counter-reset": 1.2,
  lamp: 2,
  buzzer: 1,
};

type SwitchSpec = Extract<ElectricSpec, { kind: "elec-switch" }>;
type LoadSpec = Extract<ElectricSpec, { kind: "elec-load" }>;

interface Part {
  comp: SimComponent;
  spec: ElectricSpec;
  params: Record<string, ParamValue>;
  /** Estado manual: botão apertado, trava, posição da seletora, fusível queimado… */
  pressed: boolean;
  /** Soltou o botão antes de um passo rodar: solta depois do próximo passo (um clique nunca se perde). */
  releasePending: boolean;
  latched: boolean;
  position: number;
  blown: boolean;
  /** Breaker ligado (true) ou desligado à mão. */
  on: boolean;
  /** Para o pressostato: último estado (histerese). */
  pressureOn: boolean;
  energized: boolean;
  voltage: number;
}

/** Bobina com rótulo: relé, contator, temporizador ou contador. */
interface Coil {
  /** Algum contato com este rótulo deve comutar agora? */
  actuated: boolean;
  energizedNow: boolean;
  wasEnergized: boolean;
  onTime: number;
  offTime: number;
  count: number;
}

interface Conductor {
  a: number;
  b: number;
  partIndex: number;
  /** Para chaves de dois contatos (reversora, seletora) e fusíveis. */
  ports: [string, string];
  kind: "contact" | "fuse" | "diode";
}

interface Load {
  a: number;
  b: number;
  partIndex: number;
  r: number;
  nominal: number;
  ports: [string, string];
}

export class ElectricNetwork {
  private readonly parts: Part[] = [];
  private readonly byId = new Map<string, number>();
  private readonly netOf = new Map<string, number>();
  private readonly n: number;
  /** Tensão fixa de cada rede de fonte (NaN = livre). */
  private readonly fixed: Float64Array;
  private readonly coils = new Map<string, Coil>();
  private v: Float64Array;
  private conductors: Conductor[] = [];
  private loads: Load[] = [];
  private closed: boolean[] = [];
  private diodeOn: boolean[] = [];
  private current: number[] = [];
  private short = false;
  private supplyConflict = false;
  private newlyBlown: string[] = [];
  private signature: string | null = null;
  /** Corrente que sai de cada conector para a rede [A] (para desenhar a corrente nos fios). */
  private portCurrent = new Map<string, number>();

  constructor(
    private readonly circuit: SimCircuit,
    /** Rede pneumática de um conector (para o pressostato). */
    private readonly pneumaticNet: (key: string) => number | undefined,
  ) {
    this.n = circuit.elecNets.length;
    circuit.elecNets.forEach((net, i) => net.ports.forEach((k) => this.netOf.set(k, i)));
    this.fixed = new Float64Array(this.n).fill(NaN);
    this.v = new Float64Array(this.n);

    for (const comp of circuit.components) {
      if (!isElectric(comp.spec)) continue;
      this.byId.set(comp.id, this.parts.length);
      this.parts.push({
        comp,
        spec: comp.spec,
        params: { ...comp.params },
        pressed: false,
        releasePending: false,
        latched: false,
        position: 0,
        blown: false,
        on: true,
        pressureOn: false,
        energized: false,
        voltage: 0,
      });
      if (comp.spec.kind === "elec-load" && comp.label) this.coil(comp.label);
    }
    this.applySupplies();
    this.buildElements();
  }

  get isEmpty() {
    return this.parts.length === 0;
  }

  private coil(label: string): Coil {
    let c = this.coils.get(label);
    if (!c) {
      c = { actuated: false, energizedNow: false, wasEnergized: false, onTime: 0, offTime: 0, count: 0 };
      this.coils.set(label, c);
    }
    return c;
  }

  private net(comp: SimComponent, portId: string) {
    return this.netOf.get(portKey(comp.id, portId)) ?? -1;
  }

  private applySupplies() {
    this.fixed.fill(NaN);
    this.supplyConflict = false;
    for (const p of this.parts) {
      if (p.spec.kind !== "elec-supply") continue;
      const net = this.net(p.comp, p.comp.elecPorts[0]);
      if (net < 0) continue;
      const value = p.spec.potential === "positive" ? num(p.params.voltage, 24) : 0;
      if (!Number.isNaN(this.fixed[net]) && this.fixed[net] !== value) this.supplyConflict = true;
      this.fixed[net] = Math.max(Number.isNaN(this.fixed[net]) ? -Infinity : this.fixed[net], value);
    }
  }

  private buildElements() {
    this.conductors = [];
    this.loads = [];
    this.parts.forEach((p, i) => {
      const { spec, comp } = p;
      const pair = (a: string, b: string): [string, string] => [portKey(comp.id, a), portKey(comp.id, b)];
      if (spec.kind === "elec-switch") {
        for (const c of spec.contacts) {
          this.conductors.push({ a: this.net(comp, c.a), b: this.net(comp, c.b), partIndex: i, ports: pair(c.a, c.b), kind: "contact" });
        }
      } else if (spec.kind === "elec-selector3") {
        this.conductors.push({ a: this.net(comp, "1"), b: this.net(comp, "2"), partIndex: i, ports: pair("1", "2"), kind: "contact" });
        this.conductors.push({ a: this.net(comp, "1"), b: this.net(comp, "4"), partIndex: i, ports: pair("1", "4"), kind: "contact" });
      } else if (spec.kind === "elec-fuse") {
        this.conductors.push({ a: this.net(comp, "1"), b: this.net(comp, "2"), partIndex: i, ports: pair("1", "2"), kind: "fuse" });
      } else if (spec.kind === "elec-diode") {
        this.conductors.push({ a: this.net(comp, "A"), b: this.net(comp, "K"), partIndex: i, ports: pair("A", "K"), kind: "diode" });
      } else if (spec.kind === "elec-load") {
        const [x, y] = comp.elecPorts;
        const nominal = num(p.params.voltage, 24);
        const r = spec.load === "resistor" ? Math.max(0.1, num(p.params.resistance, 1000)) : (nominal * nominal) / LOAD_POWER[spec.load];
        this.loads.push({ a: this.net(comp, x), b: this.net(comp, y), partIndex: i, r, nominal, ports: pair(x, y) });
      }
    });
    this.diodeOn = this.conductors.map(() => false);
  }

  // ---------------------------------------------------------------- contatos

  /** O acionamento desta chave está ativo agora? */
  private actuated(p: Part, rt: Runtime): boolean {
    const spec = p.spec as SwitchSpec;
    switch (spec.drive) {
      case "push":
        return p.pressed;
      case "toggle":
      case "emergency":
        return p.latched;
      case "relay":
        return this.coils.get(p.comp.label)?.actuated ?? false;
      case "position": {
        if (p.pressed) return true;
        const cyl = rt.cylinder(String(p.params.cylinder ?? ""));
        if (!cyl) return false;
        const target = (Math.min(100, Math.max(0, num(p.params.position, 100))) / 100) * cyl.stroke;
        return Math.abs(cyl.position - target) <= (spec.tolerance ?? 2) / 1000;
      }
      case "pressure": {
        const net = this.pneumaticNet(portKey(p.comp.id, "P"));
        if (net === undefined) return false;
        const gauge = rt.p[net] - P_ATM;
        const set = num(p.params.setPressure, 4) * BAR;
        p.pressureOn = p.pressureOn ? gauge > set - PRESSURE_HYSTERESIS : gauge >= set;
        return p.pressureOn;
      }
    }
  }

  /** Quais condutores estão fechados neste passo. */
  private contactStates(rt: Runtime): boolean[] {
    const actuatedByPart = new Map<number, boolean>();
    return this.conductors.map((c, k) => {
      const p = this.parts[c.partIndex];
      if (c.kind === "fuse") return !p.blown && p.on;
      if (c.kind === "diode") return this.diodeOn[k];
      if (p.spec.kind === "elec-selector3") {
        return c.ports[1].endsWith(":2") ? p.position === -1 : p.position === 1;
      }
      const spec = p.spec as SwitchSpec;
      if (!actuatedByPart.has(c.partIndex)) actuatedByPart.set(c.partIndex, this.actuated(p, rt));
      const act = actuatedByPart.get(c.partIndex)!;
      const contact = spec.contacts.find((x) => c.ports[0].endsWith(`:${x.a}`) && c.ports[1].endsWith(`:${x.b}`))!;
      return contact.normally === "open" ? act : !act;
    });
  }

  // ---------------------------------------------------------------- solver

  /** Resolve as tensões dos nós livres com os condutores e cargas atuais. */
  private solve() {
    const free: number[] = [];
    const index = new Int32Array(this.n).fill(-1);
    for (let i = 0; i < this.n; i++) {
      if (Number.isNaN(this.fixed[i])) {
        index[i] = free.length;
        free.push(i);
      }
    }
    const m = free.length;
    const G = new Float64Array(m * m);
    const I = new Float64Array(m);
    for (let k = 0; k < m; k++) G[k * m + k] = LEAK;
    const stamp = (a: number, b: number, g: number) => {
      if (a < 0 || b < 0) return;
      const ia = index[a];
      const ib = index[b];
      if (ia >= 0) G[ia * m + ia] += g;
      if (ib >= 0) G[ib * m + ib] += g;
      if (ia >= 0 && ib >= 0) {
        G[ia * m + ib] -= g;
        G[ib * m + ia] -= g;
      } else if (ia >= 0) I[ia] += g * this.fixed[b];
      else if (ib >= 0) I[ib] += g * this.fixed[a];
    };
    this.conductors.forEach((c, k) => {
      if (this.closed[k]) stamp(c.a, c.b, 1 / (c.kind === "diode" ? R_DIODE : R_CLOSED));
    });
    for (const l of this.loads) stamp(l.a, l.b, 1 / l.r);
    if (m > 0) solveDense(G, I, m);
    const v = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) v[i] = Number.isNaN(this.fixed[i]) ? I[index[i]] : this.fixed[i];
    this.v = v;
  }

  private voltage(net: number) {
    return net < 0 ? 0 : this.v[net];
  }

  // ---------------------------------------------------------------- passo

  update(dt: number, rt: Runtime) {
    if (this.isEmpty) return;
    this.newlyBlown = [];
    this.closed = this.contactStates(rt);

    for (let iter = 0; iter < 8; iter++) {
      const sig = this.closed.map((c) => (c ? 1 : 0)).join("");
      if (sig !== this.signature || iter > 0) this.solve();
      this.signature = sig;
      this.current = this.conductors.map((c, k) => (this.closed[k] ? (this.voltage(c.a) - this.voltage(c.b)) / (c.kind === "diode" ? R_DIODE : R_CLOSED) : 0));

      let changed = false;
      // Fusíveis e disjuntores: acima da corrente nominal, abrem.
      this.conductors.forEach((c, k) => {
        if (c.kind !== "fuse" || !this.closed[k]) return;
        const p = this.parts[c.partIndex];
        if (Math.abs(this.current[k]) > num(p.params.current, 2)) {
          p.blown = true;
          this.closed[k] = false;
          this.newlyBlown.push(p.comp.id);
          changed = true;
        }
      });
      // Diodos: conduzem só no sentido ânodo → cátodo.
      this.conductors.forEach((c, k) => {
        if (c.kind !== "diode") return;
        const forward = this.voltage(c.a) - this.voltage(c.b) > 0.3 || (this.closed[k] && this.current[k] > 0);
        if (forward !== this.closed[k]) {
          this.closed[k] = forward;
          this.diodeOn[k] = forward;
          changed = true;
        }
      });
      if (!changed) break;
    }

    this.short = this.supplyConflict || this.current.some((i) => Math.abs(i) > SHORT_CURRENT);

    // Cargas: ligam com tensão suficiente (se a fonte não desligou por curto).
    for (const coil of this.coils.values()) {
      coil.wasEnergized = coil.energizedNow;
      coil.energizedNow = false;
    }
    const resetLabels = new Set<string>();
    for (const l of this.loads) {
      const p = this.parts[l.partIndex];
      p.voltage = this.voltage(l.a) - this.voltage(l.b);
      p.energized = !this.short && Math.abs(p.voltage) >= PICKUP * l.nominal;
      const load = (p.spec as LoadSpec).load;
      if (!p.energized || !p.comp.label) continue;
      if (load === "counter-reset") resetLabels.add(p.comp.label);
      else if (load !== "lamp" && load !== "buzzer" && load !== "resistor") this.coil(p.comp.label).energizedNow = true;
    }

    // Relés, temporizadores e contadores (o efeito nos contatos vale a partir do próximo passo).
    for (const p of this.parts) {
      if (p.spec.kind !== "elec-load" || !p.comp.label) continue;
      const coil = this.coils.get(p.comp.label);
      if (!coil) continue;
      const delay = num(p.params.delay, 3);
      switch (p.spec.load) {
        case "relay-coil":
        case "solenoid-coil":
          coil.actuated = coil.energizedNow;
          break;
        case "timer-on":
          coil.onTime = coil.energizedNow ? coil.onTime + dt : 0;
          coil.actuated = coil.energizedNow && coil.onTime >= delay;
          break;
        case "timer-off":
          if (coil.energizedNow) {
            coil.offTime = 0;
            coil.actuated = true;
          } else if (coil.actuated) {
            coil.offTime += dt;
            if (coil.offTime >= delay) coil.actuated = false;
          }
          break;
        case "counter":
          if (resetLabels.has(p.comp.label)) coil.count = 0;
          else if (coil.energizedNow && !coil.wasEnergized) coil.count++;
          coil.actuated = coil.count >= Math.max(1, num(p.params.preset, 5));
          break;
      }
    }
    this.computePortCurrents();
    for (const p of this.parts) {
      if (p.releasePending) {
        p.pressed = false;
        p.releasePending = false;
      }
    }
  }

  private computePortCurrents() {
    const out = new Map<string, number>();
    const add = (k: string, i: number) => out.set(k, (out.get(k) ?? 0) + i);
    this.conductors.forEach((c, k) => {
      add(c.ports[0], -this.current[k]);
      add(c.ports[1], this.current[k]);
    });
    for (const l of this.loads) {
      const i = (this.voltage(l.a) - this.voltage(l.b)) / l.r;
      add(l.ports[0], -i);
      add(l.ports[1], i);
    }
    // Fonte: entrega o que a rede consome.
    for (const p of this.parts) {
      if (p.spec.kind !== "elec-supply") continue;
      const k = portKey(p.comp.id, p.comp.elecPorts[0]);
      const net = this.netOf.get(k);
      if (net === undefined) continue;
      const others = this.circuit.elecNets[net].ports.filter((x) => x !== k).reduce((s, x) => s + (out.get(x) ?? 0), 0);
      out.set(k, -others);
    }
    this.portCurrent = out;
  }

  // ---------------------------------------------------------------- interface com o motor

  /** Algum solenoide de válvula com este rótulo está energizado? */
  solenoid(label: string): boolean {
    return label !== "" && (this.coils.get(label)?.energizedNow ?? false);
  }

  has(id: string) {
    return this.byId.has(id);
  }

  actuate(id: string, side: "left" | "right", active: boolean) {
    const i = this.byId.get(id);
    if (i === undefined) return;
    const p = this.parts[i];
    const spec = p.spec;
    if (spec.kind === "elec-fuse") {
      if (!active) return;
      if (p.blown) p.blown = false;
      else if (spec.breaker) p.on = !p.on;
      return;
    }
    if (spec.kind === "elec-selector3") {
      if (active) p.position = Math.max(-1, Math.min(1, p.position + (side === "left" ? -1 : 1)));
      return;
    }
    if (spec.kind !== "elec-switch") return;
    if (spec.drive === "toggle" || spec.drive === "emergency") {
      if (active) p.latched = !p.latched;
    } else if (spec.drive === "push" || spec.drive === "position") {
      if (active) {
        p.pressed = true;
        p.releasePending = false;
      } else if (p.pressed) p.releasePending = true;
    }
  }

  setParam(id: string, key: string, value: ParamValue) {
    const i = this.byId.get(id);
    if (i === undefined) return;
    const p = this.parts[i];
    p.params = { ...p.params, [key]: value };
    if (p.spec.kind === "elec-supply") this.applySupplies();
    if (p.spec.kind === "elec-load") this.buildElements();
    this.signature = null; // força recalcular a rede no próximo passo
  }

  states(): Record<string, ComponentSimState> {
    const out: Record<string, ComponentSimState> = {};
    for (const p of this.parts) {
      const { spec, comp } = p;
      if (spec.kind === "elec-switch") {
        const first = this.conductors.findIndex((c) => this.parts[c.partIndex] === p);
        out[comp.id] = { closed: this.closed[first] ?? false, pressed: { left: p.pressed || p.latched, right: false } };
      } else if (spec.kind === "elec-selector3") out[comp.id] = { position: p.position };
      else if (spec.kind === "elec-fuse") out[comp.id] = { blown: p.blown || !p.on, closed: !p.blown && p.on };
      else if (spec.kind === "elec-load") {
        const coil = comp.label ? this.coils.get(comp.label) : undefined;
        const state: ComponentSimState = { energized: p.energized, pressure: p.voltage };
        if (spec.load === "counter") state.count = coil?.count ?? 0;
        if (spec.load === "timer-on" && coil) state.charge = Math.min(1, coil.onTime / Math.max(0.001, num(p.params.delay, 3)));
        if (spec.load === "timer-off" && coil) state.charge = coil.actuated ? 1 - coil.offTime / Math.max(0.001, num(p.params.delay, 3)) : 0;
        out[comp.id] = state;
      }
    }
    return out;
  }

  /** Tensão [V] e corrente [mA] de cada fio. */
  wireStates(): Record<string, { p: number; q: number }> {
    const out: Record<string, { p: number; q: number }> = {};
    for (const w of this.circuit.wires) {
      if (!w.electric) continue;
      const net = this.netOf.get(w.from);
      const q = ((this.portCurrent.get(w.from) ?? 0) - (this.portCurrent.get(w.to) ?? 0)) / 2;
      out[w.id] = { p: net === undefined ? 0 : this.v[net], q: q * 1000 };
    }
    return out;
  }

  warnings(): RuntimeWarning[] {
    const out: RuntimeWarning[] = [];
    if (this.short) {
      const supply = this.parts.find((p) => p.spec.kind === "elec-supply");
      if (supply) out.push({ componentId: supply.comp.id, code: "short-circuit" });
    }
    for (const id of this.newlyBlown) out.push({ componentId: id, code: "fuse-blown" });
    for (const p of this.parts) {
      if (p.spec.kind === "elec-fuse" && p.blown && !this.newlyBlown.includes(p.comp.id)) out.push({ componentId: p.comp.id, code: "fuse-blown" });
    }
    for (const l of this.loads) {
      const p = this.parts[l.partIndex];
      if ((p.spec as LoadSpec).load !== "resistor" && Math.abs(p.voltage) > OVERVOLTAGE * l.nominal) {
        out.push({ componentId: p.comp.id, code: "overvoltage", value: Math.abs(p.voltage) });
      }
    }
    return out;
  }
}
