/**
 * Válvula direcional (2/2, 3/2, 4/2, 5/2, 5/3…).
 *
 * O êmbolo tem posição contínua `spool` (0 = quadrado da esquerda). Cada quadrado
 * abre suas vias com um peso que cai a zero no meio do caminho (recobrimento
 * positivo: durante a troca, tudo fecha por um instante).
 *
 * Regras do acionamento:
 *  - um lado acionado (e o outro não) leva o êmbolo para o quadrado daquele lado;
 *  - nenhum lado acionado: a mola leva para o lado dela; centrada por molas → centro;
 *    sem mola, fica onde está (memória);
 *  - os dois lados acionados: fica onde está ("sinal preso", gera aviso).
 */
import type { BuildContext, Runtime } from "../core/element";
import { num } from "../core/element";
import type { Actuator, ComponentSimState, RuntimeWarning, SimSpec } from "../core/sim-types";
import type { Branch } from "../solver/network";
import { Base, clamp01, PILOT_MIN } from "./base";
import { BAR, conductanceFromNominal, orificeFlow, P_ATM } from "./flow";

type ValveSpec = Extract<SimSpec, { kind: "valve" }>;
type Side = "left" | "right";

/** Folga para roletes e sensores [m]: rolete precisa encostar; sensor sem contato alcança mais longe. */
const ROLLER_TOLERANCE = 0.002;
const ONEWAY_TOLERANCE = 0.004;
const PROXIMITY_TOLERANCE = 0.005;

export class DirectionalValve extends Base {
  private spool: number;
  private conflict = false;
  private readonly manual = { left: false, right: false };
  /** Alavanca com trava: posição presa pelo último clique. */
  private latched = false;
  private readonly last: number;

  constructor(
    ctx: BuildContext,
    private readonly spec: ValveSpec,
  ) {
    super(ctx);
    this.spool = spec.restIndex;
    this.last = spec.squares.length - 1;
  }

  actuate(side: Side, active: boolean) {
    if (this.spec[side] === "lever-detent") {
      if (active) this.latched = !this.latched;
      return;
    }
    this.manual[side] = active;
  }

  /** Pressão de comutação dos pilotos: ajustável na válvula de sequência, 1,5 bar nas demais. */
  private get pilotThreshold() {
    return typeof this.params.switchPressure === "number" ? this.params.switchPressure * BAR : PILOT_MIN;
  }

  private nearCylinder(rt: Runtime, tolerance: number, direction?: "advance" | "return"): boolean {
    const cyl = rt.cylinder(String(this.params.cylinder ?? ""));
    if (!cyl) return false;
    const target = clamp01(num(this.params.position, 100) / 100) * cyl.stroke;
    if (Math.abs(cyl.position - target) > tolerance) return false;
    if (!direction) return true;
    return direction === "advance" ? cyl.velocity > 1e-3 : cyl.velocity < -1e-3;
  }

  /** O acionamento deste lado está ativo agora? Mola e trava não "acionam": só seguram. */
  private active(side: Side, rt: Runtime): boolean {
    const kind: Actuator = this.spec[side];
    switch (kind) {
      case "spring":
      case "detent":
        return false;
      case "lever-detent":
        return this.latched;
      case "pilot": {
        const id = this.spec.pilotIds?.[side];
        return id !== undefined && rt.p[this.ctx.net(id)] - P_ATM > this.pilotThreshold;
      }
      case "roller":
        return this.manual[side] || this.nearCylinder(rt, ROLLER_TOLERANCE);
      case "roller-oneway":
        return this.manual[side] || this.nearCylinder(rt, ONEWAY_TOLERANCE, this.params.direction === "return" ? "return" : "advance");
      case "proximity":
        return this.nearCylinder(rt, PROXIMITY_TOLERANCE);
      case "solenoid": {
        // Bobina energizada pelo circuito elétrico, ou o clique (acionamento manual de emergência).
        const label = String(this.params[side === "left" ? "solenoidLeft" : "solenoidRight"] ?? "");
        return this.manual[side] || rt.solenoid(label);
      }
      default:
        // botão, pedal e alavanca
        return this.manual[side];
    }
  }

  /** Quadrado para onde o êmbolo vai quando nenhum lado está acionado. */
  private restTarget(): number {
    const { left, right, springCentered } = this.spec;
    if (springCentered) return this.last / 2;
    if (right === "spring" || (left === "lever-detent" && right === "detent")) return this.last;
    if (left === "spring") return 0;
    return this.spool;
  }

  update(dt: number, rt: Runtime) {
    const left = this.active("left", rt);
    const right = this.active("right", rt);
    this.conflict = left && right;
    let target = this.spool;
    if (left && !right) target = 0;
    else if (right && !left) target = this.last;
    else if (!left && !right) target = this.restTarget();
    const speed = dt / Math.max(0.001, num(this.params.switchTime, 20) / 1000);
    const delta = target - this.spool;
    this.spool += Math.abs(delta) <= speed ? delta : Math.sign(delta) * speed;
  }

  branches(out: Branch[]) {
    const c = conductanceFromNominal(num(this.params.nominalFlow, 500));
    this.spec.squares.forEach((sq, i) => {
      const w = clamp01(1 - 2 * Math.abs(this.spool - i));
      if (w <= 0) return;
      for (const [from, to] of sq.flows) out.push(this.between(from, to, (pa, pb) => orificeFlow(c * w, pa, pb)));
    });
  }

  override state(): ComponentSimState {
    const pressed = { ...this.manual };
    if (this.spec.left === "lever-detent") pressed.left = this.latched;
    return { spool: this.spool, pressed, conflict: this.conflict };
  }

  warnings(): RuntimeWarning[] {
    // Só é "sinal preso" se a mola não resolve: válvula de memória (sem mola) com os dois lados acionados.
    return this.conflict ? [{ componentId: this.id, code: "stuck-signal" }] : [];
  }
}
