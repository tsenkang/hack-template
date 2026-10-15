/**
 * Peças pneumáticas no motor: cada uma vira um ou mais orifícios entre redes.
 */
import type { BuildContext, Element, Runtime } from "../core/element";
import { num } from "../core/element";
import type { Actuator, ComponentSimState, SimSpec } from "../core/sim-types";
import type { ParamValue } from "../core/types";
import type { Branch } from "../solver/network";
import { BAR, conductanceFromNominal, fromBarGauge, orificeFlow, P_ATM, toBarGauge } from "./flow";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Pressão mínima de pilotagem [Pa acima da atmosfera] para comutar uma válvula. */
export const PILOT_MIN = 1.5 * BAR;
/** Faixa (bar) em que a válvula de retenção vai de fechada a aberta. */
const CHECK_RAMP = 0.05 * BAR;
/** Faixa de regulagem do regulador de pressão. */
const REGULATOR_BAND = 0.15 * BAR;

const C_SOURCE = conductanceFromNominal(3000);
const C_SERVICE_UNIT = conductanceFromNominal(1500);
const C_SILENCER = conductanceFromNominal(800);
const C_CHECK = conductanceFromNominal(400);
const C_NEEDLE_FULL = conductanceFromNominal(250);
/** Conector solto: ar escapa como por um furo de ~4 mm. */
export const C_OPEN_PORT = conductanceFromNominal(500);

/** Classe base com parâmetros editáveis em tempo real. */
abstract class Base implements Element {
  readonly id: string;
  protected params: Record<string, ParamValue>;
  constructor(protected ctx: BuildContext) {
    this.id = ctx.comp.id;
    this.params = { ...ctx.comp.params };
  }
  setParam(key: string, value: ParamValue) {
    this.params = { ...this.params, [key]: value };
  }
  abstract branches(out: Branch[], rt: Runtime): void;
  /** O Runtime é opcional para peças cujo estado não depende das pressões. */
  state(rt?: Runtime): ComponentSimState;
  state(): ComponentSimState {
    return {};
  }
}

const key = (ctx: BuildContext, portId: string) => `${ctx.comp.id}:${portId}`;

/** Fonte de ar: nó interno com a pressão ajustada, ligado ao conector por um orifício grande. */
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
    out.push({ a: this.inner, b: this.ctx.net("1"), flow: (pa, pb) => orificeFlow(C_SOURCE, pa, pb), portB: key(this.ctx, "1") });
  }
}

/** Unidade de conservação: regulador de pressão com alívio (1 → 2). */
class ServiceUnit extends Base {
  branches(out: Branch[]) {
    const set = fromBarGauge(num(this.params.setPressure, 6));
    out.push({
      a: this.ctx.net("1"),
      b: this.ctx.net("2"),
      flow: (pa, pb) => {
        const open = clamp01((set - pb) / REGULATOR_BAND);
        return open > 0 && pa > pb ? orificeFlow(C_SERVICE_UNIT * open, pa, pb) : 0;
      },
      portA: key(this.ctx, "1"),
      portB: key(this.ctx, "2"),
    });
    // Alívio: se a saída passar do ajuste (ex.: ajuste reduzido), o excesso escapa.
    out.push({
      a: this.ctx.net("2"),
      b: this.ctx.atm,
      flow: (pa, pb) => orificeFlow(C_SERVICE_UNIT * 0.2 * clamp01((pa - set - REGULATOR_BAND) / REGULATOR_BAND), pa, pb),
      portA: key(this.ctx, "2"),
    });
  }
}

class Silencer extends Base {
  branches(out: Branch[]) {
    out.push({ a: this.ctx.net("1"), b: this.ctx.atm, flow: (pa, pb) => orificeFlow(C_SILENCER, pa, pb), portA: key(this.ctx, "1") });
  }
}

class Gauge extends Base {
  branches() {}
  override state(rt: Runtime): ComponentSimState {
    return { pressure: toBarGauge(rt.p[this.ctx.net("1")]) };
  }
}

/** Retenção: passa de 1 para 2 quando a diferença supera a pressão de abertura. */
class CheckValve extends Base {
  branches(out: Branch[]) {
    const crack = num(this.params.crackingPressure, 0.1) * BAR;
    out.push({
      a: this.ctx.net("1"),
      b: this.ctx.net("2"),
      flow: (pa, pb) => (pa > pb ? clamp01((pa - pb - crack) / CHECK_RAMP) * orificeFlow(C_CHECK, pa, pb) : 0),
      portA: key(this.ctx, "1"),
      portB: key(this.ctx, "2"),
    });
  }
}

/** Reguladora de vazão unidirecional: agulha nos dois sentidos + retenção livre de 2 para 1. */
class FlowControlOneWay extends Base {
  branches(out: Branch[]) {
    const c = C_NEEDLE_FULL * clamp01(num(this.params.opening, 50) / 100);
    const a = this.ctx.net("1");
    const b = this.ctx.net("2");
    const ports = { portA: key(this.ctx, "1"), portB: key(this.ctx, "2") };
    out.push({ a, b, flow: (pa, pb) => orificeFlow(c, pa, pb), ...ports });
    out.push({
      a: b,
      b: a,
      flow: (pa, pb) => (pa > pb ? clamp01((pa - pb) / CHECK_RAMP) * orificeFlow(C_CHECK, pa, pb) : 0),
      portA: ports.portB,
      portB: ports.portA,
    });
  }
}

type ValveSpec = Extract<SimSpec, { kind: "valve" }>;

/**
 * Válvula direcional. O êmbolo tem posição contínua `spool` (0 = quadrado da esquerda).
 * Cada quadrado abre suas vias com um peso que cai a zero no meio do caminho
 * (recobrimento positivo: durante a troca, tudo fecha por um instante).
 */
class DirectionalValve extends Base {
  private spool: number;
  private readonly manual = { left: false, right: false };
  private readonly last: number;

  constructor(
    ctx: BuildContext,
    private readonly spec: ValveSpec,
  ) {
    super(ctx);
    this.spool = spec.restIndex;
    this.last = spec.squares.length - 1;
  }

  actuate(side: "left" | "right", active: boolean) {
    this.manual[side] = active;
  }

  /** O acionamento deste lado está ativo agora? (mola não conta: ela só age quando nada mais age). */
  private active(side: "left" | "right", rt: Runtime): boolean {
    const kind: Actuator = this.spec[side];
    switch (kind) {
      case "spring":
        return false;
      case "pilot": {
        const id = this.spec.pilotIds?.[side];
        return id !== undefined && rt.p[this.ctx.net(id)] - P_ATM > PILOT_MIN;
      }
      case "roller":
        return this.manual[side] || this.rollerTouched(rt);
      default:
        // botão, alavanca e solenoide (no solenoide, o clique é o "acionamento manual de emergência")
        return this.manual[side];
    }
  }

  private rollerTouched(rt: Runtime): boolean {
    const cyl = rt.cylinder(String(this.params.cylinder ?? ""));
    if (!cyl) return false;
    const target = (clamp01(num(this.params.position, 100) / 100)) * cyl.stroke;
    return Math.abs(cyl.position - target) <= 0.002;
  }

  update(dt: number, rt: Runtime) {
    const left = this.active("left", rt);
    const right = this.active("right", rt);
    let target = this.spool;
    if (left && !right) target = 0;
    else if (right && !left) target = this.last;
    else if (!left && !right) {
      if (this.spec.right === "spring" && this.spec.left !== "spring") target = this.last;
      else if (this.spec.left === "spring" && this.spec.right !== "spring") target = 0;
      else if (this.spec.left === "spring" && this.spec.right === "spring") target = this.last / 2;
    }
    // Os dois lados acionados ao mesmo tempo: o êmbolo fica onde está ("sinal preso").
    const speed = dt / Math.max(0.001, num(this.params.switchTime, 20) / 1000);
    const delta = target - this.spool;
    this.spool += Math.abs(delta) <= speed ? delta : Math.sign(delta) * speed;
  }

  branches(out: Branch[]) {
    const c = conductanceFromNominal(num(this.params.nominalFlow, 500));
    this.spec.squares.forEach((sq, i) => {
      const w = clamp01(1 - 2 * Math.abs(this.spool - i));
      if (w <= 0) return;
      for (const [from, to] of sq.flows) {
        out.push({
          a: this.ctx.net(from),
          b: this.ctx.net(to),
          flow: (pa, pb) => orificeFlow(c * w, pa, pb),
          portA: key(this.ctx, from),
          portB: key(this.ctx, to),
        });
      }
    });
  }

  override state(): ComponentSimState {
    return { spool: this.spool, pressed: { ...this.manual } };
  }
}

/** Escape de um conector solto (o ar sai para a atmosfera). */
export class OpenPortVent implements Element {
  readonly id: string;
  constructor(
    private readonly node: number,
    private readonly atm: number,
    private readonly port: string,
  ) {
    this.id = `vent:${port}`;
  }
  branches(out: Branch[]) {
    out.push({ a: this.node, b: this.atm, flow: (pa, pb) => orificeFlow(C_OPEN_PORT, pa, pb), portA: this.port });
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
    case "service-unit":
      return new ServiceUnit(ctx);
    case "silencer":
      return new Silencer(ctx);
    case "gauge":
      return new Gauge(ctx);
    case "check-valve":
      return new CheckValve(ctx);
    case "flow-control-one-way":
      return new FlowControlOneWay(ctx);
    case "valve":
      return new DirectionalValve(ctx, spec);
    default:
      return null;
  }
}
