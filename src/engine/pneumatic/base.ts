/** Peças comuns às peças pneumáticas do motor. */
import type { BuildContext, Element, Runtime } from "../core/element";
import type { ComponentSimState } from "../core/sim-types";
import type { ParamValue } from "../core/types";
import type { Branch } from "../solver/network";
import { BAR } from "./flow";

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Pressão mínima de pilotagem [Pa acima da atmosfera] para comutar uma válvula. */
export const PILOT_MIN = 1.5 * BAR;
/** Faixa em que a válvula de retenção vai de fechada a aberta. */
export const CHECK_RAMP = 0.05 * BAR;
/** Faixa de transição de válvulas que comparam pressões (E, OU, escape rápido). */
export const SHUTTLE_BAND = 0.1 * BAR;

/** Classe base: guarda os parâmetros (que podem mudar com a simulação rodando). */
export abstract class Base implements Element {
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
  state(): ComponentSimState {
    return {};
  }
  /** Chave "componente:conector" usada para contabilizar a vazão em cada conector. */
  protected port(id: string) {
    return `${this.ctx.comp.id}:${id}`;
  }
  /** Ramo entre dois conectores desta peça, com a vazão contabilizada nos dois. */
  protected between(a: string, b: string, flow: Branch["flow"]): Branch {
    return { a: this.ctx.net(a), b: this.ctx.net(b), flow, portA: this.port(a), portB: this.port(b) };
  }
  /** Ramo de um conector para a atmosfera. */
  protected toAtm(a: string, flow: Branch["flow"]): Branch {
    return { a: this.ctx.net(a), b: this.ctx.atm, flow, portA: this.port(a) };
  }
}
