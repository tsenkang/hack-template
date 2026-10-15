/** Interface comum das peças dentro do motor. */
import type { Branch } from "../solver/network";
import type { ComponentSimState, RuntimeWarning, SimComponent } from "./sim-types";
import type { ParamValue } from "./types";

/** O que uma peça pode consultar enquanto a simulação roda. */
export interface Runtime {
  /** Pressões absolutas [Pa] de todos os nós (redes + nós fixos). */
  readonly p: Float64Array;
  /** Cilindro com um dado rótulo (para os roletes de fim de curso). Posição [m], velocidade [m/s]. */
  cylinder(label: string): { position: number; stroke: number; velocity: number } | undefined;
}

/** O que uma peça recebe ao ser montada. */
export interface BuildContext {
  comp: SimComponent;
  /** Nó da rede ligada a um conector desta peça. */
  net(portId: string): number;
  /** Nó da atmosfera. */
  atm: number;
  /** Cria um nó de pressão fixa (ex.: dentro da fonte de ar). */
  addFixedNode(pressure: number): number;
  setFixedPressure(node: number, pressure: number): void;
}

export interface Element {
  readonly id: string;
  /** Atualiza o estado interno antes do passo (posição do êmbolo das válvulas…). */
  update?(dt: number, rt: Runtime): void;
  /** Orifícios ativos neste passo. */
  branches(out: Branch[], rt: Runtime): void;
  setParam(key: string, value: ParamValue): void;
  /** Acionamento manual (botão, alavanca, ou clique no acionamento). */
  actuate?(side: "left" | "right", active: boolean): void;
  state(rt: Runtime): ComponentSimState;
  /** Volume fixo [m³] que a peça soma às redes (ex.: reservatório). */
  staticVolumes?(): { net: number; volume: number }[];
  /** Problemas próprios da peça agora (ex.: sinal preso). */
  warnings?(rt: Runtime): RuntimeWarning[];
}

/** Peça com parte móvel que muda o volume das redes (cilindros). */
export interface MechanicalElement extends Element {
  /** Volume [m³] que a peça soma em cada rede, na posição atual. */
  chambers(): { net: number; volume: number }[];
  /** Integra o movimento por `h` segundos com as pressões atuais. */
  integrate(h: number, p: Float64Array): void;
  readonly label: string;
  readonly position: number;
  readonly velocity: number;
  readonly stroke: number;
}

export const num = (v: ParamValue | undefined, fallback: number) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
