/**
 * Peças pneumáticas "de orifício": fonte, reservatório, reguladores, retenção,
 * reguladoras de vazão, válvulas E/OU e escape rápido. Cada uma vira um ou mais
 * orifícios (ramos) entre as redes ligadas aos seus conectores.
 */
import type { BuildContext, Element, Runtime } from "../core/element";
import { num } from "../core/element";
import type { ComponentSimState } from "../core/sim-types";
import type { ParamValue } from "../core/types";
import type { Branch } from "../solver/network";
import { Base, CHECK_RAMP, clamp01, SHUTTLE_BAND } from "./base";
import { DirectionalValve } from "./directional-valve";
import { BAR, conductanceFromNominal, fromBarGauge, orificeFlow, toBarGauge } from "./flow";
import { AirMotor, Counter, SuctionCup, Timer, VacuumGenerator } from "./special";

/** Faixa de regulagem dos reguladores e válvulas de alívio. */
const REGULATOR_BAND = 0.15 * BAR;

const C_SERVICE_UNIT = conductanceFromNominal(1500);
const C_SILENCER = conductanceFromNominal(800);
const C_CHECK = conductanceFromNominal(400);
const C_NEEDLE_FULL = conductanceFromNominal(250);
const C_LOGIC = conductanceFromNominal(300);
const C_QUICK_EXHAUST = conductanceFromNominal(1500);
const C_RELIEF = conductanceFromNominal(600);
/** Conector solto: ar escapa como por um furo de ~4 mm. */
export const C_OPEN_PORT = conductanceFromNominal(500);

/** Fonte de ar (ou compressor): nó interno com a pressão ajustada, ligado ao conector por um orifício. */
class AirSource extends Base {
  private readonly inner: number;
  constructor(ctx: BuildContext) {
    super(ctx);
    this.inner = ctx.addFixedNode(fromBarGauge(num(this.params.pressure, 6)));
  }
  override setParam(k: string, v: ParamValue) {
    super.setParam(k, v);
    this.ctx.setFixedPressure(this.inner, fromBarGauge(num(this.params.pressure, 6)));
  }
  branches(out: Branch[]) {
    const c = conductanceFromNominal(num(this.params.flow, 3000));
    out.push({ a: this.inner, b: this.ctx.net("1"), flow: (pa, pb) => orificeFlow(c, pa, pb), portB: this.port("1") });
  }
}

/** Reservatório de ar: só soma volume à rede (os dois conectores são o mesmo ponto). */
class Reservoir extends Base {
  branches() {}
  staticVolumes() {
    return [{ net: this.ctx.net("1"), volume: num(this.params.volume, 1) / 1000 }];
  }
}

/** Regulador de pressão com alívio (1 → 2). Usado também na unidade de conservação. */
class PressureRegulator extends Base {
  branches(out: Branch[]) {
    const set = fromBarGauge(num(this.params.setPressure, 6));
    out.push(
      this.between("1", "2", (pa, pb) => {
        const open = clamp01((set - pb) / REGULATOR_BAND);
        return open > 0 && pa > pb ? orificeFlow(C_SERVICE_UNIT * open, pa, pb) : 0;
      }),
    );
    // Alívio: se a saída passar do ajuste (ex.: ajuste reduzido), o excesso escapa.
    out.push(
      this.toAtm("2", (pa, pb) =>
        orificeFlow(C_SERVICE_UNIT * 0.2 * clamp01((pa - set - REGULATOR_BAND) / REGULATOR_BAND), pa, pb),
      ),
    );
  }
}

/** Válvula de alívio: abre 1 → 3 quando a pressão passa do ajuste. */
class ReliefValve extends Base {
  branches(out: Branch[]) {
    const set = fromBarGauge(num(this.params.setPressure, 7));
    out.push(this.between("1", "3", (pa, pb) => orificeFlow(C_RELIEF * clamp01((pa - set) / REGULATOR_BAND), pa, pb)));
  }
}

class Silencer extends Base {
  branches(out: Branch[]) {
    out.push(this.toAtm("1", (pa, pb) => orificeFlow(C_SILENCER, pa, pb)));
  }
}

class Gauge extends Base {
  branches() {}
  override state(rt?: Runtime): ComponentSimState {
    return { pressure: toBarGauge(rt!.p[this.ctx.net("1")]) };
  }
}

/** Retenção: passa de 1 para 2 quando a diferença supera a pressão de abertura. */
class CheckValve extends Base {
  branches(out: Branch[]) {
    const crack = num(this.params.crackingPressure, 0.1) * BAR;
    out.push(
      this.between("1", "2", (pa, pb) => (pa > pb ? clamp01((pa - pb - crack) / CHECK_RAMP) * orificeFlow(C_CHECK, pa, pb) : 0)),
    );
  }
}

/** Reguladora de vazão: agulha nos dois sentidos; na unidirecional, mais uma retenção livre de 2 para 1. */
class FlowControl extends Base {
  constructor(
    ctx: BuildContext,
    private readonly oneWay: boolean,
  ) {
    super(ctx);
  }
  branches(out: Branch[]) {
    const c = C_NEEDLE_FULL * clamp01(num(this.params.opening, 50) / 100);
    out.push(this.between("1", "2", (pa, pb) => orificeFlow(c, pa, pb)));
    if (this.oneWay) {
      out.push(this.between("2", "1", (pa, pb) => (pa > pb ? clamp01((pa - pb) / CHECK_RAMP) * orificeFlow(C_CHECK, pa, pb) : 0)));
    }
  }
}

/**
 * Válvulas com "bolinha" que compara as duas entradas (1a e 1b):
 * - E (simultaneidade): a saída 2 fica ligada à entrada de MENOR pressão;
 * - OU (alternadora): a saída 2 fica ligada à entrada de MAIOR pressão.
 * A posição da bolinha é calculada no início do passo, com as pressões atuais.
 */
class ShuttleValve extends Base {
  private towardA = 0.5;
  constructor(
    ctx: BuildContext,
    private readonly and: boolean,
  ) {
    super(ctx);
  }
  update(_dt: number, rt: Runtime) {
    const pa = rt.p[this.ctx.net("1a")];
    const pb = rt.p[this.ctx.net("1b")];
    const diff = this.and ? pb - pa : pa - pb;
    this.towardA = clamp01(diff / SHUTTLE_BAND + 0.5);
  }
  branches(out: Branch[]) {
    const wa = this.towardA;
    if (wa > 0) out.push(this.between("1a", "2", (pa, pb) => orificeFlow(C_LOGIC * wa, pa, pb)));
    if (wa < 1) out.push(this.between("1b", "2", (pa, pb) => orificeFlow(C_LOGIC * (1 - wa), pa, pb)));
  }
}

/** Escape rápido: 1 alimenta 2; quando 1 perde pressão, 2 descarrega direto por 3. */
class QuickExhaust extends Base {
  private forward = 1;
  update(_dt: number, rt: Runtime) {
    this.forward = clamp01((rt.p[this.ctx.net("1")] - rt.p[this.ctx.net("2")]) / SHUTTLE_BAND + 0.5);
  }
  branches(out: Branch[]) {
    const f = this.forward;
    if (f > 0) out.push(this.between("1", "2", (pa, pb) => orificeFlow(C_LOGIC * f, pa, pb)));
    if (f < 1) out.push(this.between("2", "3", (pa, pb) => orificeFlow(C_QUICK_EXHAUST * (1 - f), pa, pb)));
  }
}

/** Escape de um conector solto (o ar sai para a atmosfera). */
export class OpenPortVent implements Element {
  readonly id: string;
  constructor(
    private readonly node: number,
    private readonly atm: number,
    readonly port: string,
    readonly exhaust: boolean,
  ) {
    this.id = `vent:${port}`;
  }
  /** Vazão [kg/s] escapando agora (para o aviso de vazamento). */
  leak(p: Float64Array) {
    return orificeFlow(C_OPEN_PORT, p[this.node], p[this.atm]);
  }
  branches(out: Branch[]) {
    // Sem portA: a vazão no conector é a da própria peça (o escape está "do lado de fora").
    out.push({ a: this.node, b: this.atm, flow: (pa, pb) => orificeFlow(C_OPEN_PORT, pa, pb) });
  }
  setParam() {}
  state() {
    return {};
  }
}

/** Cria o elemento do motor para uma peça pneumática (exceto cilindros, ver mechanics/). */
export function createPneumaticElement(ctx: BuildContext): Element | null {
  const spec = ctx.comp.spec;
  switch (spec.kind) {
    case "air-source":
      return new AirSource(ctx);
    case "reservoir":
      return new Reservoir(ctx);
    case "service-unit":
    case "pressure-regulator":
      return new PressureRegulator(ctx);
    case "relief-valve":
      return new ReliefValve(ctx);
    case "silencer":
      return new Silencer(ctx);
    case "gauge":
      return new Gauge(ctx);
    case "check-valve":
      return new CheckValve(ctx);
    case "flow-control-one-way":
      return new FlowControl(ctx, true);
    case "flow-control-two-way":
      return new FlowControl(ctx, false);
    case "and-valve":
      return new ShuttleValve(ctx, true);
    case "or-valve":
      return new ShuttleValve(ctx, false);
    case "quick-exhaust":
      return new QuickExhaust(ctx);
    case "valve":
      return new DirectionalValve(ctx, spec);
    case "timer":
      return new Timer(ctx, spec.mode);
    case "counter":
      return new Counter(ctx);
    case "air-motor":
      return new AirMotor(ctx);
    case "vacuum-generator":
      return new VacuumGenerator(ctx);
    case "suction-cup":
      return new SuctionCup(ctx);
    default:
      return null;
  }
}
