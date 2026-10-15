/**
 * Motor de simulação. Não conhece React nem o navegador: recebe um SimCircuit
 * e avança no tempo com `step()`. Roda dentro do Web Worker, e também direto
 * nos testes (Vitest).
 *
 * Cada passo:
 *  1. peças atualizam o estado interno (êmbolo das válvulas, roletes);
 *  2. mecânica em subpassos: cilindros se movem e o ar das câmaras é comprimido/expandido;
 *  3. rede de ar resolvida de forma implícita (pressões e vazões).
 */
import { Cylinder } from "../mechanics/cylinder";
import { createPneumaticElement, OpenPortVent } from "../pneumatic/elements";
import { massToLmin, P_ATM, RT, toBarGauge } from "../pneumatic/flow";
import { createWork, stepNetwork, type Branch, type NetworkWork } from "../solver/network";
import type { BuildContext, Element, MechanicalElement, Runtime } from "./element";
import type { RuntimeWarning, SimCircuit, SimCommand, SimSnapshot } from "./sim-types";
import { portKey } from "./sim-types";

/** Passo de tempo da rede de ar [s]. */
export const DT = 0.002;
/** Subpassos da mecânica por passo (o ar nas câmaras é uma mola rígida). */
const MECH_SUBSTEPS = 8;
/** Vazão por um conector solto (que não é escape) a partir da qual há aviso de vazamento [l/min]. */
const LEAK_WARNING_LMIN = 5;
/** Volume de cada conector [m³] e de cada tubo (≈ 0,4 m de mangueira de 4 mm) [m³]. */
const PORT_VOLUME = 0.5e-6;
const WIRE_VOLUME = 5e-6;

export class Simulation {
  time = 0;
  private readonly n: number;
  private p: Float64Array;
  private readonly baseVolume: Float64Array;
  private readonly volume: Float64Array;
  private readonly portNet = new Map<string, number>();
  private readonly elements: Element[] = [];
  private readonly mechanical: MechanicalElement[] = [];
  private readonly vents: OpenPortVent[] = [];
  private readonly byId = new Map<string, Element>();
  private readonly work: NetworkWork;
  private readonly runtime: Runtime;
  private branches: Branch[] = [];
  private flows: Float64Array = new Float64Array(0);

  constructor(private readonly circuit: SimCircuit) {
    this.n = circuit.nets.length;
    circuit.nets.forEach((net, i) => net.ports.forEach((k) => this.portNet.set(k, i)));
    this.baseVolume = new Float64Array(this.n);
    circuit.nets.forEach((net, i) => (this.baseVolume[i] = net.ports.length * PORT_VOLUME + net.wires.length * WIRE_VOLUME));
    this.volume = new Float64Array(this.baseVolume);

    // Nós fixos: atmosfera em n, depois os criados pelas peças (fontes).
    const fixed: number[] = [P_ATM];
    const atm = this.n;

    for (const comp of circuit.components) {
      const ctx: BuildContext = {
        comp,
        atm,
        net: (portId) => {
          const i = this.portNet.get(portKey(comp.id, portId));
          if (i === undefined) throw new Error(`Conector ${comp.id}:${portId} sem rede`);
          return i;
        },
        addFixedNode: (pressure) => {
          fixed.push(pressure);
          return this.n + fixed.length - 1;
        },
        setFixedPressure: (node, pressure) => {
          this.p[node] = pressure;
        },
      };
      const el = comp.spec.kind === "cylinder" ? new Cylinder(ctx, comp.spec) : createPneumaticElement(ctx);
      if (!el) continue;
      this.elements.push(el);
      this.byId.set(comp.id, el);
      if (el instanceof Cylinder) this.mechanical.push(el);

      // Conectores soltos que deveriam estar ligados: o ar escapa por eles.
      for (const port of comp.ports) {
        const k = portKey(comp.id, port.id);
        const net = circuit.nets[this.portNet.get(k)!];
        if (port.ventsWhenOpen && net.ports.length === 1) {
          const vent = new OpenPortVent(this.portNet.get(k)!, atm, k, port.exhaust);
          this.elements.push(vent);
          this.vents.push(vent);
        }
      }
    }

    this.p = new Float64Array(this.n + fixed.length);
    this.p.fill(P_ATM, 0, this.n);
    fixed.forEach((v, i) => (this.p[this.n + i] = v));
    this.work = createWork(this.n);
    for (const el of this.elements) for (const v of el.staticVolumes?.() ?? []) this.baseVolume[v.net] += v.volume;

    const cylinders = new Map(this.mechanical.map((m) => [m.label, m]));
    this.runtime = {
      p: this.p,
      cylinder: (label) => cylinders.get(label),
    };
    this.updateVolumes();
  }

  private updateVolumes() {
    this.volume.set(this.baseVolume);
    for (const m of this.mechanical) for (const c of m.chambers()) this.volume[c.net] += c.volume;
  }

  step(dt = DT) {
    const rt = this.runtime;
    for (const el of this.elements) el.update?.(dt, rt);

    if (this.mechanical.length) {
      // Massa de ar de cada rede fica constante durante a mecânica; a pressão segue o volume (isotérmico).
      const mass = new Float64Array(this.n);
      for (let i = 0; i < this.n; i++) mass[i] = (this.p[i] * this.volume[i]) / RT;
      const h = dt / MECH_SUBSTEPS;
      for (let s = 0; s < MECH_SUBSTEPS; s++) {
        for (const m of this.mechanical) m.integrate(h, this.p);
        this.updateVolumes();
        for (let i = 0; i < this.n; i++) this.p[i] = (mass[i] * RT) / this.volume[i];
      }
    }

    this.branches = [];
    for (const el of this.elements) el.branches(this.branches, rt);
    this.flows = stepNetwork(this.p, this.volume, this.n, this.branches, dt, this.work);
    this.time += dt;
  }

  /** Avança `seconds` segundos em passos de DT. */
  run(seconds: number) {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) this.step();
  }

  command(cmd: SimCommand) {
    const el = this.byId.get(cmd.id);
    if (!el) return;
    if (cmd.type === "actuate") el.actuate?.(cmd.side, cmd.active);
    else el.setParam(cmd.key, cmd.value);
  }

  /** Pressão manométrica [bar] num conector. */
  pressureAt(componentId: string, portId: string): number {
    const i = this.portNet.get(portKey(componentId, portId));
    return i === undefined ? 0 : toBarGauge(this.p[i]);
  }

  snapshot(): SimSnapshot {
    // Vazão que sai de cada conector para a rede [kg/s].
    const portFlow = new Map<string, number>();
    const add = (k: string | undefined, v: number) => k && portFlow.set(k, (portFlow.get(k) ?? 0) + v);
    this.branches.forEach((br, i) => {
      add(br.portA, -this.flows[i]);
      add(br.portB, this.flows[i]);
    });

    const components: SimSnapshot["components"] = {};
    for (const el of this.elements) if (!el.id.startsWith("vent:")) components[el.id] = el.state(this.runtime);

    const ports: SimSnapshot["ports"] = {};
    for (const [k, i] of this.portNet) ports[k] = toBarGauge(this.p[i]);

    const wires: SimSnapshot["wires"] = {};
    for (const w of this.circuit.wires) {
      const net = this.portNet.get(w.from)!;
      const q = ((portFlow.get(w.from) ?? 0) - (portFlow.get(w.to) ?? 0)) / 2;
      wires[w.id] = { p: toBarGauge(this.p[net]), q: massToLmin(q) };
    }
    return { time: this.time, components, wires, ports, warnings: this.collectWarnings(ports) };
  }

  /** Avisos do instante atual: sobrepressão, sinal preso e ar escapando por conector solto. */
  private collectWarnings(ports: Record<string, number>): RuntimeWarning[] {
    const out: RuntimeWarning[] = [];
    for (const el of this.elements) out.push(...(el.warnings?.(this.runtime) ?? []));
    for (const comp of this.circuit.components) {
      const max = comp.params.maxPressure;
      if (typeof max !== "number") continue;
      for (const port of comp.ports) {
        const p = ports[portKey(comp.id, port.id)];
        if (p > max) {
          out.push({ componentId: comp.id, code: "overpressure", port: port.id, value: p });
          break;
        }
      }
    }
    for (const vent of this.vents) {
      if (vent.exhaust) continue;
      const q = Math.abs(massToLmin(vent.leak(this.p)));
      if (q > LEAK_WARNING_LMIN) {
        const [componentId, port] = vent.port.split(":");
        out.push({ componentId, code: "leak", port, value: q });
      }
    }
    return out;
  }
}
