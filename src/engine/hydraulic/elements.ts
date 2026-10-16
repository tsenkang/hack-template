/**
 * Peças hidráulicas no motor. Cada uma vira ramos (orifícios ou fontes de vazão)
 * entre as redes de óleo. Pressões absolutas, como no ar; o tanque fica na atmosfera.
 */
import type { BuildContext, Element, Runtime } from "../core/element";
import { num } from "../core/element";
import type { ComponentSimState } from "../core/sim-types";
import type { Branch } from "../solver/network";
import { Base, clamp01 } from "../pneumatic/base";
import { DirectionalValve } from "../pneumatic/directional-valve";
import { BAR, fromBarGauge, P_ATM, toBarGauge } from "../pneumatic/flow";
import { oilFlow, toLmin } from "./flow";

/** Faixa de abertura das válvulas de pressão (fração do ajuste, com mínimo). */
const band = (set: number) => Math.max(2 * BAR, 0.03 * (set - P_ATM));
/** Retenção: começa a abrir com 0,5 bar e abre toda com mais 0,3 bar. */
const CHECK_CRACK = 0.5 * BAR;
const CHECK_RAMP = 0.3 * BAR;

/** Bomba (fixa ou variável): fonte de vazão de S para P, que só diminui perto da pressão máxima. */
class Pump extends Base {
  constructor(
    ctx: BuildContext,
    private readonly variable: boolean,
  ) {
    super(ctx);
  }
  private get nominal() {
    // vazão [m³/s] = deslocamento [cm³/rot] × rotação [rpm]
    const disp = num(this.params.displacement, 8) * (this.variable ? clamp01(num(this.params.setting, 100) / 100) : 1);
    return (disp * num(this.params.speed, 1450)) / 60 / 1e6;
  }
  branches(out: Branch[]) {
    const q = this.nominal;
    // Variável: o compensador reduz a vazão perto da pressão ajustada. Fixa: o motor "afoga" acima da máxima.
    const limit = fromBarGauge(this.variable ? num(this.params.setPressure, 100) : num(this.params.maxPressure, 250) * 1.2);
    const fade = this.variable ? 5 * BAR : 20 * BAR;
    out.push(this.between("S", "P", (_ps, pp) => q * clamp01((limit - pp) / fade)));
  }
}

/** Tanque: liga o conector T à atmosfera por um orifício bem grande. */
class Tank extends Base {
  branches(out: Branch[]) {
    out.push(this.toAtm("T", (pa, pb) => oilFlow(500, pa, pb, 0.5)));
  }
}

/** Filtro, resfriador, aquecedor: pequena perda de carga. */
class PassThrough extends Base {
  branches(out: Branch[]) {
    out.push(this.between("1", "2", (pa, pb) => oilFlow(num(this.params.nominalFlow, 60), pa, pb, 0.5)));
  }
}

class FlowMeter extends Base {
  branches(out: Branch[]) {
    out.push(this.between("1", "2", (pa, pb) => oilFlow(200, pa, pb, 0.5)));
  }
  override state(rt?: Runtime): ComponentSimState {
    return { flow: toLmin(oilFlow(200, rt!.p[this.ctx.net("1")], rt!.p[this.ctx.net("2")], 0.5)) };
  }
}

class Gauge extends Base {
  branches() {}
  override state(rt?: Runtime): ComponentSimState {
    return { pressure: toBarGauge(rt!.p[this.ctx.net("1")]) };
  }
}

/**
 * Acumulador com gás (nitrogênio) pré-carregado: abaixo da pré-carga fica vazio;
 * acima, recebe óleo comprimindo o gás (p·V constante).
 */
class Accumulator extends Base {
  private stored = 0;
  private dt = 0.002;
  private oilVolume(p: number) {
    const v0 = num(this.params.volume, 1) / 1000;
    const p0 = fromBarGauge(num(this.params.precharge, 50));
    return p > p0 ? v0 * (1 - p0 / p) : 0;
  }
  update(dt: number, rt: Runtime) {
    this.dt = dt;
    this.stored = this.oilVolume(rt.p[this.ctx.net("1")]);
  }
  branches(out: Branch[]) {
    out.push(this.toAtm("1", (pa) => (this.oilVolume(pa) - this.stored) / this.dt));
  }
  override state(rt?: Runtime): ComponentSimState {
    const v0 = num(this.params.volume, 1) / 1000;
    return { charge: this.oilVolume(rt!.p[this.ctx.net("1")]) / v0, pressure: toBarGauge(rt!.p[this.ctx.net("1")]) };
  }
}

/**
 * Motor hidráulico: gira quando a diferença de pressão vence a carga
 * (Δp de carga = 2π·torque/deslocamento). Acima disso, a rotação cresce com Δp.
 */
class HydMotor extends Base {
  private angle = 0;
  private rpm = 0;
  private get displacement() {
    return Math.max(0.1, num(this.params.displacement, 10)) / 1e6; // m³/rot
  }
  private flow(pa: number, pb: number) {
    const dp = pa - pb;
    const load = (2 * Math.PI * Math.max(0, num(this.params.torque, 0))) / this.displacement;
    const over = Math.max(0, Math.abs(dp) - load);
    // 50 bar acima da carga → 1000 rpm
    const g = (this.displacement * (1000 / 60)) / (50 * BAR);
    return Math.sign(dp) * g * over;
  }
  update(dt: number, rt: Runtime) {
    this.rpm = (this.flow(rt.p[this.ctx.net("1")], rt.p[this.ctx.net("2")]) / this.displacement) * 60;
    this.angle = (this.angle + (this.rpm / 60) * 360 * dt) % 360;
  }
  branches(out: Branch[]) {
    out.push(this.between("1", "2", (pa, pb) => this.flow(pa, pb)));
  }
  override state(): ComponentSimState {
    return { angle: this.angle, rpm: this.rpm };
  }
}

/** Válvulas de pressão: abrem conforme uma pressão de comando passa (ou fica abaixo) do ajuste. */
class PressureValve extends Base {
  constructor(
    ctx: BuildContext,
    private readonly mode: "relief" | "reducing" | "sequence" | "counterbalance",
  ) {
    super(ctx);
  }
  branches(out: Branch[]) {
    const set = fromBarGauge(num(this.params.setPressure, 100));
    const b = band(set);
    const qmax = num(this.params.nominalFlow, 60);
    switch (this.mode) {
      case "relief":
        out.push(this.between("P", "T", (pa, pb) => oilFlow(qmax * clamp01((pa - set) / b), pa, pb)));
        break;
      case "sequence":
        out.push(this.between("P", "A", (pa, pb) => oilFlow(qmax * clamp01((pa - set) / b), pa, pb)));
        break;
      case "reducing":
        out.push(this.between("P", "A", (pa, pb) => (pa > pb ? oilFlow(qmax * clamp01((set - pb) / b), pa, pb) : 0)));
        break;
      case "counterbalance":
        // segura a carga: A → B só com pressão acima do ajuste; volta livre de B para A
        out.push(this.between("A", "B", (pa, pb) => oilFlow(qmax * clamp01((pa - set) / b), pa, pb)));
        out.push(this.between("B", "A", (pa, pb) => (pa > pb ? oilFlow(qmax * clamp01((pa - pb - CHECK_CRACK) / CHECK_RAMP), pa, pb) : 0)));
        break;
    }
  }
}

/** Estranguladores: fixo, ajustável e unidirecional (com retenção livre de 2 para 1). */
class Throttle extends Base {
  constructor(
    ctx: BuildContext,
    private readonly mode: "fixed" | "adjustable" | "one-way",
  ) {
    super(ctx);
  }
  branches(out: Branch[]) {
    const q = this.mode === "fixed" ? num(this.params.nominalFlow, 10) : num(this.params.nominalFlow, 30) * clamp01(num(this.params.opening, 50) / 100);
    out.push(this.between("1", "2", (pa, pb) => oilFlow(q, pa, pb)));
    if (this.mode === "one-way") {
      out.push(this.between("2", "1", (pa, pb) => (pa > pb ? oilFlow(60 * clamp01((pa - pb - CHECK_CRACK) / CHECK_RAMP), pa, pb) : 0)));
    }
  }
}

/** Reguladora de vazão com compensação de pressão: a vazão de 1 para 2 não passa do ajuste, seja qual for a carga. */
class CompensatedFlow extends Base {
  branches(out: Branch[]) {
    const limit = num(this.params.flowSetting, 10) / 60_000;
    out.push(
      this.between("1", "2", (pa, pb) => {
        const q = oilFlow(200, pa, pb);
        return q > 0 ? Math.min(q, limit) : q * 0.05; // ao contrário, quase fechada
      }),
    );
  }
}

/** Retenção: passa de 1 para 2 acima da pressão de abertura. */
class CheckValve extends Base {
  branches(out: Branch[]) {
    out.push(this.between("1", "2", (pa, pb) => (pa > pb ? oilFlow(100 * clamp01((pa - pb - CHECK_CRACK) / CHECK_RAMP), pa, pb) : 0)));
  }
}

/** Retenção pilotada: livre de A para B; de B para A só com pressão no piloto X (relação 1:3). */
class PilotCheck extends Base {
  private open = 0;
  update(_dt: number, rt: Runtime) {
    const px = rt.p[this.ctx.net("X")] - P_ATM;
    const pb = rt.p[this.ctx.net("B")] - P_ATM;
    this.open = clamp01((px - pb / 3 - 2 * BAR) / (2 * BAR));
  }
  branches(out: Branch[]) {
    out.push(this.between("A", "B", (pa, pb) => (pa > pb ? oilFlow(100 * clamp01((pa - pb - CHECK_CRACK) / CHECK_RAMP), pa, pb) : 0)));
    const o = this.open;
    if (o > 0) out.push(this.between("B", "A", (pa, pb) => (pa > pb ? oilFlow(100 * o, pa, pb) : 0)));
  }
}

/**
 * Válvula proporcional (ou servoválvula) 4/3 de centro fechado: o comando (−100…100%)
 * posiciona o carretel continuamente. Positivo: P→A e B→T; negativo: P→B e A→T.
 */
class ProportionalValve extends Base {
  private spool = 0;
  constructor(
    ctx: BuildContext,
    private readonly servo: boolean,
  ) {
    super(ctx);
  }
  update(dt: number) {
    const target = Math.max(-1, Math.min(1, num(this.params.command, 0) / 100));
    const tau = this.servo ? 0.01 : 0.05;
    this.spool += (target - this.spool) * Math.min(1, dt / tau);
  }
  branches(out: Branch[]) {
    const q = num(this.params.nominalFlow, 30) * Math.abs(this.spool);
    if (q <= 0) return;
    const [a, b] = this.spool > 0 ? ["A", "B"] : ["B", "A"];
    out.push(this.between("P", a, (pa, pb) => oilFlow(q, pa, pb)));
    out.push(this.between(b, "T", (pa, pb) => oilFlow(q, pa, pb)));
  }
  override state(): ComponentSimState {
    // spool 0..2 como nas outras válvulas (1 = centro)
    return { spool: 1 - this.spool };
  }
}

/** Cria o elemento do motor para uma peça hidráulica (cilindros: ver mechanics/). */
export function createHydraulicElement(ctx: BuildContext): Element | null {
  const spec = ctx.comp.spec;
  switch (spec.kind) {
    case "hyd-pump":
      return new Pump(ctx, spec.variable);
    case "hyd-tank":
      return new Tank(ctx);
    case "hyd-passthrough":
      return new PassThrough(ctx);
    case "flow-meter":
      return new FlowMeter(ctx);
    case "gauge":
      return new Gauge(ctx);
    case "accumulator":
      return new Accumulator(ctx);
    case "hyd-motor":
      return new HydMotor(ctx);
    case "hyd-relief":
      return new PressureValve(ctx, "relief");
    case "hyd-reducing":
      return new PressureValve(ctx, "reducing");
    case "hyd-sequence":
      return new PressureValve(ctx, "sequence");
    case "hyd-counterbalance":
      return new PressureValve(ctx, "counterbalance");
    case "hyd-throttle":
      return new Throttle(ctx, spec.mode);
    case "hyd-flow-compensated":
      return new CompensatedFlow(ctx);
    case "hyd-check":
      return new CheckValve(ctx);
    case "hyd-pilot-check":
      return new PilotCheck(ctx);
    case "proportional-valve":
      return new ProportionalValve(ctx, spec.servo);
    case "valve":
      return new DirectionalValve(ctx, spec);
    default:
      return null;
  }
}
