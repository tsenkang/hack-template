/**
 * Motor de simulação. Não conhece React nem o navegador: recebe um SimCircuit
 * e avança no tempo com `step()`. Roda dentro do Web Worker, e também direto
 * nos testes (Vitest).
 *
 * Cada passo:
 *  0. rede elétrica: contatos, bobinas, solenoides (usa posições e pressões do passo anterior);
 *  1. peças atualizam o estado interno (êmbolo das válvulas, roletes, temporizadores);
 *  2. mecânica em subpassos: cilindros se movem e o fluido das câmaras é comprimido/expandido;
 *  3. redes de ar e de óleo resolvidas de forma implícita (pressões e vazões).
 */
import { ElectricNetwork } from "../electric/network";
import { createHydraulicElement } from "../hydraulic/elements";
import { createPneumaticElement } from "../pneumatic/elements";
import { FluidNetwork } from "./fluid-network";
import { AIR, OIL } from "./medium";
import type { MechanicalElement } from "./element";
import type { SimCircuit, SimCommand, SimSnapshot } from "./sim-types";
import { portKey } from "./sim-types";

/** Passo de tempo das redes de fluido [s]. */
export const DT = 0.002;

export class Simulation {
  time = 0;
  private readonly air: FluidNetwork;
  private readonly oil: FluidNetwork;
  private readonly electric: ElectricNetwork;
  private readonly shared: { cylinder(label: string): MechanicalElement | undefined; solenoid(label: string): boolean };

  constructor(circuit: SimCircuit) {
    this.air = new FluidNetwork(circuit, { domain: "pneumatic", medium: AIR, create: createPneumaticElement });
    this.oil = new FluidNetwork(circuit, { domain: "hydraulic", medium: OIL, create: createHydraulicElement });
    this.electric = new ElectricNetwork(circuit, (k) => this.air.netOf(k));
    const cylinders = new Map<string, MechanicalElement>([...this.air.mechanical, ...this.oil.mechanical].map((m) => [m.label, m]));
    this.shared = {
      cylinder: (label: string) => cylinders.get(label),
      solenoid: (label: string) => this.electric.solenoid(label),
    };
    this.air.bind(this.shared);
    this.oil.bind(this.shared);
  }

  step(dt = DT) {
    this.electric.update(dt, { p: this.air.p, ...this.shared });
    for (const net of [this.air, this.oil]) net.update(dt);
    for (const net of [this.air, this.oil]) net.mechanics(dt);
    for (const net of [this.air, this.oil]) net.flow(dt);
    this.time += dt;
  }

  /** Avança `seconds` segundos em passos de DT. */
  run(seconds: number) {
    const steps = Math.round(seconds / DT);
    for (let i = 0; i < steps; i++) this.step();
  }

  command(cmd: SimCommand) {
    if (this.electric.has(cmd.id)) {
      if (cmd.type === "actuate") this.electric.actuate(cmd.id, cmd.side, cmd.active);
      else this.electric.setParam(cmd.id, cmd.key, cmd.value);
    }
    for (const net of [this.air, this.oil]) {
      const el = net.get(cmd.id);
      if (!el) continue;
      if (cmd.type === "actuate") el.actuate?.(cmd.side, cmd.active);
      else el.setParam(cmd.key, cmd.value);
    }
  }

  /** Pressão manométrica [bar] num conector (ar ou óleo). */
  pressureAt(componentId: string, portId: string): number {
    const k = portKey(componentId, portId);
    return this.oil.netOf(k) !== undefined ? this.oil.pressureAt(k) : this.air.pressureAt(k);
  }

  snapshot(): SimSnapshot {
    const snap: SimSnapshot = { time: this.time, components: {}, wires: {}, ports: {}, warnings: [] };
    this.air.snapshot(snap);
    this.oil.snapshot(snap);
    Object.assign(snap.components, this.electric.states());
    Object.assign(snap.wires, this.electric.wireStates());
    snap.warnings.unshift(...this.electric.warnings());
    return snap;
  }
}
