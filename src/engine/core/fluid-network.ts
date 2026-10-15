/**
 * Rede de fluido (ar ou óleo): as peças de um domínio, suas redes, a mecânica dos
 * cilindros e o solver implícito. O `Simulation` monta uma rede para o ar e outra
 * para o óleo; as duas compartilham o mesmo tempo, os cilindros e os solenoides.
 */
import { Cylinder } from "../mechanics/cylinder";
import { OpenPortVent } from "../pneumatic/elements";
import { massToLmin, P_ATM, toBarGauge } from "../pneumatic/flow";
import { createWork, stepNetwork, type Branch, type NetworkWork } from "../solver/network";
import type { BuildContext, Element, MechanicalElement, Runtime } from "./element";
import type { Medium } from "./medium";
import type { FluidDomain, RuntimeWarning, SimCircuit, SimComponent, SimSnapshot } from "./sim-types";
import { portKey } from "./sim-types";

/** Vazão por um conector solto (que não é escape) a partir da qual há aviso de vazamento [l/min]. */
const LEAK_WARNING_LMIN = 5;
/** Subpassos da mecânica: o mínimo, o máximo e a fração de período por subpasso. */
const MIN_SUBSTEPS = 8;
const MAX_SUBSTEPS = 400;
const SUBSTEP_FRACTION = 0.3;

export interface FluidSetup {
  domain: FluidDomain;
  medium: Medium;
  /** Cria o elemento de uma peça deste domínio (null = a peça não tem nada aqui). */
  create(ctx: BuildContext): Element | null;
}

export class FluidNetwork {
  readonly n: number;
  readonly p: Float64Array;
  readonly mechanical: MechanicalElement[] = [];
  private readonly baseVolume: Float64Array;
  private readonly volume: Float64Array;
  private readonly capacity: Float64Array;
  private readonly portNet = new Map<string, number>();
  private readonly elements: Element[] = [];
  private readonly vents: OpenPortVent[] = [];
  private readonly byId = new Map<string, Element>();
  private readonly work: NetworkWork;
  private readonly comps: SimComponent[];
  private branches: Branch[] = [];
  private flows: Float64Array = new Float64Array(0);
  private runtime!: Runtime;

  constructor(
    private readonly circuit: SimCircuit,
    private readonly setup: FluidSetup,
  ) {
    const { domain, medium } = setup;
    const nets = domain === "pneumatic" ? circuit.nets : circuit.hydNets;
    const portsOf = (c: SimComponent) => (domain === "pneumatic" ? c.ports : c.hydPorts);
    this.n = nets.length;
    nets.forEach((net, i) => net.ports.forEach((k) => this.portNet.set(k, i)));
    this.baseVolume = new Float64Array(this.n);
    nets.forEach((net, i) => (this.baseVolume[i] = net.ports.length * medium.portVolume + net.wires.length * medium.wireVolume));
    this.volume = new Float64Array(this.baseVolume);
    this.capacity = new Float64Array(this.n);
    this.comps = circuit.components.filter((c) => portsOf(c).length > 0);

    // Nós fixos: atmosfera/tanque em n, depois os criados pelas peças (fontes).
    const fixed: number[] = [P_ATM];
    const atm = this.n;
    let p: Float64Array | null = null;

    for (const comp of this.comps) {
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
          if (p) p[node] = pressure;
        },
      };
      const el = comp.spec.kind === "cylinder" ? new Cylinder(ctx, comp.spec, domain) : setup.create(ctx);
      if (!el) continue;
      this.elements.push(el);
      this.byId.set(comp.id, el);
      if (el instanceof Cylinder) this.mechanical.push(el);

      // Conectores soltos que deveriam estar ligados: o ar escapa por eles.
      for (const port of portsOf(comp)) {
        const k = portKey(comp.id, port.id);
        const net = this.portNet.get(k)!;
        if (port.ventsWhenOpen && nets[net].ports.length === 1) {
          const vent = new OpenPortVent(net, atm, k, port.exhaust);
          this.elements.push(vent);
          this.vents.push(vent);
        }
      }
    }

    p = new Float64Array(this.n + fixed.length);
    p.fill(P_ATM, 0, this.n);
    fixed.forEach((v, i) => (p![this.n + i] = v));
    this.p = p;
    this.work = createWork(this.n);
    for (const el of this.elements) for (const v of el.staticVolumes?.() ?? []) this.baseVolume[v.net] += v.volume;
    this.updateVolumes();
  }

  bind(runtime: Omit<Runtime, "p">) {
    this.runtime = { ...runtime, p: this.p };
  }

  has(id: string) {
    return this.byId.has(id);
  }

  get(id: string) {
    return this.byId.get(id);
  }

  netOf(key: string) {
    return this.portNet.get(key);
  }

  private updateVolumes() {
    this.volume.set(this.baseVolume);
    for (const m of this.mechanical) for (const c of m.chambers()) this.volume[c.net] += c.volume;
  }

  /** Quantos subpassos a mecânica precisa agora (a "mola" de óleo é muito mais dura que a de ar). */
  private substeps(dt: number) {
    let omega = 0;
    for (const m of this.mechanical) {
      for (const c of m.chambers()) {
        const k = this.setup.medium.stiffness(this.p[c.net], c.area, this.volume[c.net]);
        omega = Math.max(omega, Math.sqrt(k / m.mass));
      }
    }
    return Math.min(MAX_SUBSTEPS, Math.max(MIN_SUBSTEPS, Math.ceil((omega * dt) / SUBSTEP_FRACTION)));
  }

  /** 1. Estado interno das peças (válvulas, temporizadores…). */
  update(dt: number) {
    for (const el of this.elements) el.update?.(dt, this.runtime);
  }

  /** 2. Mecânica: cilindros se movem; o fluido das câmaras é comprimido/expandido (conteúdo constante). */
  mechanics(dt: number) {
    if (!this.mechanical.length) return;
    const { medium } = this.setup;
    const content = new Float64Array(this.n);
    for (let i = 0; i < this.n; i++) content[i] = medium.content(this.p[i], this.volume[i]);
    const steps = this.substeps(dt);
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      for (const m of this.mechanical) m.integrate(h, this.p);
      this.updateVolumes();
      for (let i = 0; i < this.n; i++) this.p[i] = Math.max(medium.minPressure, medium.pressure(content[i], this.volume[i]));
    }
  }

  /** 3. Rede de fluido resolvida de forma implícita. */
  flow(dt: number) {
    const { medium } = this.setup;
    this.branches = [];
    for (const el of this.elements) el.branches(this.branches, this.runtime);
    for (let i = 0; i < this.n; i++) this.capacity[i] = medium.capacity(this.volume[i]);
    this.flows = stepNetwork(this.p, this.capacity, this.n, this.branches, dt, this.work, medium.minPressure, medium.maxDelta);
  }

  pressureAt(key: string): number {
    const i = this.portNet.get(key);
    return i === undefined ? 0 : toBarGauge(this.p[i]);
  }

  /** Vazão em l/min a partir da unidade do solver (kg/s no ar, m³/s no óleo). */
  private toLmin(q: number) {
    return this.setup.domain === "pneumatic" ? massToLmin(q) : q * 60_000;
  }

  /** Estado das peças, das linhas, pressão nos conectores e avisos deste domínio. */
  snapshot(out: SimSnapshot, withPorts = true) {
    const portFlow = new Map<string, number>();
    const add = (k: string | undefined, v: number) => k && portFlow.set(k, (portFlow.get(k) ?? 0) + v);
    this.branches.forEach((br, i) => {
      add(br.portA, -this.flows[i]);
      add(br.portB, this.flows[i]);
    });
    for (const el of this.elements) if (!el.id.startsWith("vent:")) out.components[el.id] = el.state(this.runtime);
    if (withPorts) for (const [k, i] of this.portNet) out.ports[k] = toBarGauge(this.p[i]);
    for (const w of this.circuit.wires) {
      if (w.domain !== this.setup.domain) continue;
      const net = this.portNet.get(w.from)!;
      const q = ((portFlow.get(w.from) ?? 0) - (portFlow.get(w.to) ?? 0)) / 2;
      out.wires[w.id] = { p: toBarGauge(this.p[net]), q: this.toLmin(q) };
    }
    out.warnings.push(...this.warnings(out.ports));
  }

  /** Avisos do instante: sobrepressão, problemas das peças e ar escapando por conector solto. */
  private warnings(ports: Record<string, number>): RuntimeWarning[] {
    const out: RuntimeWarning[] = [];
    for (const el of this.elements) out.push(...(el.warnings?.(this.runtime) ?? []));
    const portsOf = (c: SimComponent) => (this.setup.domain === "pneumatic" ? c.ports : c.hydPorts);
    for (const comp of this.comps) {
      const max = comp.params.maxPressure;
      if (typeof max !== "number") continue;
      for (const port of portsOf(comp)) {
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
