/**
 * Cilindro linear (simples ou dupla ação): câmaras de volume variável + movimento da haste.
 *
 *   m·a = (pA − patm)·A_A − (pB − patm)·A_B − carga − mola − atrito − amortecimento
 *
 * O atrito tem uma parte fixa (Coulomb, com "colagem" quando parado) e uma parte viscosa.
 * Com haste dupla, as duas câmaras têm a mesma área (coroa). O amortecimento de fim de
 * curso freia a haste nos últimos milímetros, como o colchão de ar de um cilindro real.
 */
import type { BuildContext, MechanicalElement } from "../core/element";
import { num } from "../core/element";
import type { ComponentSimState } from "../core/sim-types";
import type { ParamValue } from "../core/types";
import { P_ATM } from "../pneumatic/flow";

/** Comprimento morto (folga no fim de curso + furos), em metros. */
const DEAD_LENGTH = 0.006;
/** Volume interno dos furos de conexão [m³]. */
const PORT_VOLUME = 1e-6;
const VISCOUS = 60; // N·s/m
/** Trecho final do curso em que o amortecimento atua [m]. */
const CUSHION_LENGTH = 0.012;
/** Amortecimento máximo (regulagem 100%) [N·s/m]. */
const CUSHION_MAX = 2500;

export class Cylinder implements MechanicalElement {
  readonly id: string;
  readonly label: string;
  private readonly singleActing: boolean;
  private readonly throughRod: boolean;
  private readonly cushioned: boolean;
  private readonly netA: number;
  private readonly netB: number | null;
  private params: Record<string, ParamValue>;
  /** Posição da haste [m] (0 = recuada) e velocidade [m/s]. */
  position = 0;
  velocity = 0;

  /** Pressão de referência para o atrito (6 bar no ar, 100 bar no óleo) e amortecimento viscoso. */
  private readonly refPressure: number;
  private readonly viscous: number;
  private readonly coulombFraction: number;

  constructor(
    ctx: BuildContext,
    opts: { singleActing: boolean; throughRod?: boolean; cushioned?: boolean },
    domain: "pneumatic" | "hydraulic" = "pneumatic",
  ) {
    this.refPressure = domain === "hydraulic" ? 100e5 : 6e5;
    // Óleo: vedações e o próprio óleo amortecem bem mais (evita trepidação em baixa velocidade).
    this.viscous = domain === "hydraulic" ? 10000 : VISCOUS;
    this.coulombFraction = domain === "hydraulic" ? 0.01 : 0.02;
    const { singleActing } = opts;
    this.id = ctx.comp.id;
    this.label = ctx.comp.label;
    this.singleActing = singleActing;
    this.throughRod = Boolean(opts.throughRod);
    this.cushioned = Boolean(opts.cushioned);
    this.params = { ...ctx.comp.params };
    this.netA = ctx.net("A");
    this.netB = singleActing ? null : ctx.net("B");
  }

  private get areaPiston() {
    return (Math.PI / 4) * (num(this.params.pistonDiameter, 32) / 1000) ** 2;
  }
  private get areaA() {
    return this.throughRod ? this.areaB : this.areaPiston;
  }
  private get areaB() {
    return this.areaPiston - (Math.PI / 4) * (num(this.params.rodDiameter, 12) / 1000) ** 2;
  }
  get stroke() {
    return num(this.params.stroke, 100) / 1000;
  }
  private get load() {
    return num(this.params.load, 0);
  }
  /** Massa em movimento: a ajustada, ou êmbolo + haste + a carga se ela for um peso. */
  get mass() {
    return typeof this.params.mass === "number" ? Math.max(0.05, this.params.mass) : 0.3 + Math.max(0, this.load) / 9.81;
  }
  /** Atrito de Coulomb: parte fixa + uma fração (2% no ar, 1% no óleo) da força na pressão de referência. */
  private get coulomb() {
    return 8 + this.coulombFraction * this.areaPiston * this.refPressure;
  }
  /** Freio do amortecimento: só nos últimos milímetros, no sentido em que a haste vai. */
  private cushion(): number {
    if (!this.cushioned) return 0;
    const near = this.velocity > 0 ? this.stroke - this.position : this.position;
    if (near > CUSHION_LENGTH) return 0;
    return (num(this.params.cushioning, 50) / 100) * CUSHION_MAX;
  }
  private springForce(x: number) {
    if (!this.singleActing) return 0;
    const f0 = num(this.params.springForce, 30);
    return f0 * (1 + x / this.stroke);
  }

  chambers() {
    const out = [{ net: this.netA, volume: PORT_VOLUME + this.areaA * (DEAD_LENGTH + this.position), area: this.areaA }];
    if (this.netB !== null) {
      out.push({ net: this.netB, volume: PORT_VOLUME + this.areaB * (DEAD_LENGTH + this.stroke - this.position), area: this.areaB });
    }
    return out;
  }

  integrate(h: number, p: Float64Array) {
    const pA = p[this.netA];
    const pB = this.netB === null ? P_ATM : p[this.netB];
    const drive = (pA - P_ATM) * this.areaA - (pB - P_ATM) * (this.netB === null ? 0 : this.areaB) - this.load - this.springForce(this.position);
    const fc = this.coulomb;
    let force: number;
    if (Math.abs(this.velocity) < 1e-5) {
      if (Math.abs(drive) <= fc) {
        this.velocity = 0;
        return;
      }
      force = drive - Math.sign(drive) * fc;
    } else {
      force = drive - Math.sign(this.velocity) * fc;
    }
    const before = this.velocity;
    // Amortecimento viscoso tratado de forma implícita: estável mesmo com o colchão de ar bem fechado.
    const damping = ((this.viscous + this.cushion()) * h) / this.mass;
    this.velocity = (this.velocity + (force / this.mass) * h) / (1 + damping);
    // O atrito não pode inverter o movimento sozinho: se cruzou o zero, para.
    if (before !== 0 && Math.sign(before) !== Math.sign(this.velocity) && Math.sign(drive) !== Math.sign(this.velocity)) {
      this.velocity = 0;
    }
    this.position += this.velocity * h;
    if (this.position <= 0) {
      this.position = 0;
      if (this.velocity < 0) this.velocity = 0;
    } else if (this.position >= this.stroke) {
      this.position = this.stroke;
      if (this.velocity > 0) this.velocity = 0;
    }
  }

  branches() {}

  setParam(key: string, value: ParamValue) {
    this.params = { ...this.params, [key]: value };
    this.position = Math.min(this.position, this.stroke);
  }

  state(): ComponentSimState {
    return { extension: this.stroke > 0 ? this.position / this.stroke : 0, velocity: this.velocity };
  }
}
