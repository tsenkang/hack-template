/**
 * Peças pneumáticas com comportamento próprio: temporizador, contador,
 * motor pneumático, gerador de vácuo e ventosa.
 */
import type { BuildContext, Runtime } from "../core/element";
import { num } from "../core/element";
import type { ComponentSimState } from "../core/sim-types";
import type { Branch } from "../solver/network";
import { Base, CHECK_RAMP, clamp01, PILOT_MIN } from "./base";
import { BAR, conductanceFromNominal, massToLmin, orificeFlow, P_ATM, RHO_ANR, RT } from "./flow";

const C_OUTPUT = conductanceFromNominal(300);
const C_FAST = conductanceFromNominal(300);
/** Velocidade de comutação da válvula de saída do temporizador e do contador [posições/s]. */
const OUTPUT_RATE = 1 / 0.015;

/** Válvula 3/2 NF interna (1→2 quando ligada, 2→3 quando desligada), com troca suave. */
class OutputValve {
  position = 0;
  update(dt: number, on: boolean) {
    const target = on ? 1 : 0;
    const step = dt * OUTPUT_RATE;
    this.position += Math.max(-step, Math.min(step, target - this.position));
  }
  branches(owner: Base & { link(a: string, b: string, w: number): Branch }, out: Branch[]) {
    const w = this.position;
    if (w > 0) out.push(owner.link("1", "2", w));
    if (w < 1) out.push(owner.link("2", "3", 1 - w));
  }
}

/** Volume do reservatório interno do temporizador [m³] e pressão em que ele comuta [Pa acima da atm]. */
const TIMER_VOLUME = 20e-6;
const TIMER_SWITCH = 3 * BAR;
/** Fator de forma da curva de carga (ajustado para o tempo real bater com o tempo ajustado). */
const TIMER_SHAPE = 0.88;

/**
 * Temporizador pneumático: uma reguladora de vazão enche (ou esvazia) um pequeno
 * reservatório pelo sinal 12; quando a pressão dele passa de 3 bar, a válvula 3/2
 * interna comuta.
 *  - Retardo na ligação: enche devagar pela agulha, esvazia rápido pela retenção.
 *  - Retardo no desligamento: enche rápido pela retenção, esvazia devagar pela agulha.
 */
export class Timer extends Base {
  private readonly output = new OutputValve();
  constructor(
    ctx: BuildContext,
    private readonly mode: "on-delay" | "off-delay",
  ) {
    super(ctx);
  }

  /** Condutância da agulha para o tempo ajustado, considerando sinal de 6 bar. */
  private get needle() {
    const delay = Math.max(0.05, num(this.params.delay, 3));
    const p1 = 6 * BAR + P_ATM;
    const mass = (TIMER_VOLUME * TIMER_SWITCH) / RT;
    return mass / (delay * p1 * RHO_ANR * TIMER_SHAPE);
  }

  link(a: string, b: string, w: number): Branch {
    return this.between(a, b, (pa, pb) => orificeFlow(C_OUTPUT * w, pa, pb));
  }

  update(dt: number, rt: Runtime) {
    this.output.update(dt, rt.p[this.ctx.net("#res")] - P_ATM > TIMER_SWITCH);
  }

  branches(out: Branch[]) {
    const c = this.needle;
    out.push(this.between("12", "#res", (pa, pb) => orificeFlow(c, pa, pb)));
    const [from, to] = this.mode === "on-delay" ? ["#res", "12"] : ["12", "#res"];
    out.push(this.between(from, to, (pa, pb) => (pa > pb ? clamp01((pa - pb) / CHECK_RAMP) * orificeFlow(C_FAST, pa, pb) : 0)));
    this.output.branches(this, out);
  }

  staticVolumes() {
    return [{ net: this.ctx.net("#res"), volume: TIMER_VOLUME }];
  }

  override state(rt?: Runtime): ComponentSimState {
    return { charge: clamp01((rt!.p[this.ctx.net("#res")] - P_ATM) / TIMER_SWITCH), spool: this.output.position };
  }
}

/**
 * Contador pneumático: conta os pulsos de pressão no conector 12. Ao chegar no valor
 * ajustado, a saída 1→2 abre e fica aberta até um pulso em 10 (ou um clique) zerar.
 */
export class Counter extends Base {
  private readonly output = new OutputValve();
  private count = 0;
  private lastCount = false;
  private lastReset = false;
  private manualReset = false;

  link(a: string, b: string, w: number): Branch {
    return this.between(a, b, (pa, pb) => orificeFlow(C_OUTPUT * w, pa, pb));
  }

  actuate(_side: "left" | "right", active: boolean) {
    if (active) this.manualReset = true;
  }

  update(dt: number, rt: Runtime) {
    const counting = rt.p[this.ctx.net("12")] - P_ATM > PILOT_MIN;
    const reset = rt.p[this.ctx.net("10")] - P_ATM > PILOT_MIN || this.manualReset;
    if (reset && !this.lastReset) this.count = 0;
    else if (counting && !this.lastCount && !reset) this.count++;
    this.lastCount = counting;
    this.lastReset = reset;
    this.manualReset = false;
    this.output.update(dt, this.count >= Math.max(1, num(this.params.preset, 5)));
  }

  branches(out: Branch[]) {
    this.output.branches(this, out);
  }

  override state(): ComponentSimState {
    return { count: this.count, spool: this.output.position };
  }
}

/**
 * Motor pneumático: o ar passa de 1 para 2 (ou ao contrário) girando o eixo.
 * A rotação é a vazão de ar dividida pelo volume engolido por volta.
 */
export class AirMotor extends Base {
  private angle = 0;
  private rpm = 0;
  private flow = 0;

  branches(out: Branch[]) {
    const c = conductanceFromNominal(num(this.params.nominalFlow, 300));
    out.push(this.between("1", "2", (pa, pb) => orificeFlow(c, pa, pb)));
  }

  update(dt: number, rt: Runtime) {
    const pa = rt.p[this.ctx.net("1")];
    const pb = rt.p[this.ctx.net("2")];
    const c = conductanceFromNominal(num(this.params.nominalFlow, 300));
    this.flow = massToLmin(orificeFlow(c, pa, pb));
    // vazão real na entrada (l/min) = vazão ANR × patm / p_entrada
    const inlet = Math.max(pa, pb) / P_ATM;
    const litersPerRev = Math.max(0.001, num(this.params.displacement, 20) / 1000);
    this.rpm = this.flow / inlet / litersPerRev;
    this.angle = (this.angle + (this.rpm / 60) * 360 * dt) % 360;
  }

  override state(): ComponentSimState {
    return { angle: this.angle, rpm: this.rpm };
  }
}

/** Pressão absoluta que um gerador de vácuo (ejetor) alcança [Pa] ≈ −0,8 bar. */
const VACUUM_LIMIT = 0.2 * BAR;
const C_EJECTOR = conductanceFromNominal(120);

/**
 * Gerador de vácuo (ejetor/Venturi): com ar em 1, o ar escapa por 3 e "puxa" o ar da via 2,
 * criando vácuo. A força de sucção cresce com a pressão de alimentação.
 */
export class VacuumGenerator extends Base {
  private readonly vacuumNode: number;
  private drive = 0;

  constructor(ctx: BuildContext) {
    super(ctx);
    this.vacuumNode = ctx.addFixedNode(VACUUM_LIMIT);
  }

  update(_dt: number, rt: Runtime) {
    this.drive = clamp01((rt.p[this.ctx.net("1")] - P_ATM) / (4 * BAR));
  }

  branches(out: Branch[]) {
    out.push(this.between("1", "3", (pa, pb) => orificeFlow(C_EJECTOR, pa, pb)));
    const d = this.drive;
    if (d > 0) {
      out.push({
        a: this.ctx.net("2"),
        b: this.vacuumNode,
        flow: (pa, pb) => orificeFlow(C_EJECTOR * d, pa, pb),
        portA: this.port("2"),
      });
    }
  }
}

/** Ventosa: segura a peça quando o vácuo passa de −0,4 bar. */
export class SuctionCup extends Base {
  branches() {}
  staticVolumes() {
    return [{ net: this.ctx.net("1"), volume: 5e-6 }];
  }
  override state(rt?: Runtime): ComponentSimState {
    const p = rt!.p[this.ctx.net("1")] - P_ATM;
    return { pressure: p / BAR, holding: p < -0.4 * BAR };
  }
}
