/**
 * Tipos trocados entre a tela e o motor de simulação (que roda no Web Worker).
 * Tudo aqui é dado puro (serializável), sem funções nem React.
 */
import type { ParamValue } from "./types";

/** Acionamento de um lado da válvula direcional. */
export type Actuator =
  | "spring"
  | "button"
  | "pedal"
  | "lever"
  /** Alavanca com trava: cada clique alterna a posição, que fica presa. */
  | "lever-detent"
  /** Trava (detente) do lado oposto à alavanca com trava. */
  | "detent"
  | "pilot"
  | "solenoid"
  | "roller"
  /** Rolete escamoteável (gatilho): só aciona quando a haste passa num sentido. */
  | "roller-oneway"
  /** Sensor de proximidade pneumático: aciona sem contato, perto da posição ajustada. */
  | "proximity";

/** Acionamentos que dependem da posição de um cilindro (rótulo + posição no curso). */
export const POSITION_ACTUATORS: readonly Actuator[] = ["roller", "roller-oneway", "proximity"];
/** Acionamentos que a pessoa opera com o mouse durante a simulação. */
export const MANUAL_ACTUATORS: readonly Actuator[] = ["button", "pedal", "lever", "lever-detent", "roller", "roller-oneway", "solenoid"];

/** Comportamento de cada tipo de peça no motor. Fica na definição da peça (`ComponentDef.sim`). */
export type SimSpec =
  | { kind: "air-source" }
  | { kind: "reservoir" }
  | { kind: "and-valve" }
  | { kind: "or-valve" }
  | { kind: "quick-exhaust" }
  | { kind: "flow-control-two-way" }
  | { kind: "pressure-regulator" }
  | { kind: "relief-valve" }
  | { kind: "timer"; mode: "on-delay" | "off-delay" }
  | { kind: "counter" }
  | { kind: "air-motor" }
  | { kind: "vacuum-generator" }
  | { kind: "suction-cup" }
  | { kind: "service-unit" }
  | { kind: "silencer" }
  | { kind: "gauge" }
  | { kind: "junction" }
  | { kind: "check-valve" }
  | { kind: "flow-control-one-way" }
  | { kind: "cylinder"; singleActing: boolean; throughRod?: boolean; cushioned?: boolean }
  | {
      kind: "valve";
      squares: readonly { flows: readonly (readonly [string, string])[]; blocked: readonly string[] }[];
      restIndex: number;
      left: Actuator;
      right: Actuator;
      pilotIds?: { left?: string; right?: string };
      /** Válvula de 3 posições centrada por molas nos dois lados. */
      springCentered?: boolean;
    };

/** Conectores internos que o motor cria para algumas peças (ex.: reservatório do temporizador). */
export function internalPorts(spec: SimSpec): string[] {
  return spec.kind === "timer" ? ["#res"] : [];
}

/** Conector, como o motor enxerga: tipo + se fica aberto para a atmosfera quando solto. */
export interface SimPort {
  id: string;
  /** true = conector solto escapa para a atmosfera; false = fica fechado (piloto, manômetro). */
  ventsWhenOpen: boolean;
  /** Escape (3, 5…): ficar solto é normal, não gera aviso de vazamento. */
  exhaust: boolean;
}

export interface SimComponent {
  id: string;
  label: string;
  spec: SimSpec;
  params: Record<string, ParamValue>;
  ports: SimPort[];
}

/** Rede = conjunto de conectores ligados entre si (mesma pressão). */
export interface SimNet {
  ports: string[]; // chaves "componentId:portId"
  wires: string[];
}

/** Circuito pronto para simular: peças com comportamento + redes já montadas. */
export interface SimCircuit {
  components: SimComponent[];
  nets: SimNet[];
  wires: { id: string; from: string; to: string }[];
}

/** Estado visível de uma peça a cada quadro. */
export interface ComponentSimState {
  /** Posição do êmbolo da válvula (0 = quadrado da esquerda, 1 = próximo…). */
  spool?: number;
  /** Avanço da haste do cilindro, 0 (recuada) a 1 (avançada). */
  extension?: number;
  /** Velocidade da haste em m/s. */
  velocity?: number;
  /** Pressão medida (bar, manométrica). */
  pressure?: number;
  /** Lados acionados manualmente agora. */
  pressed?: { left: boolean; right: boolean };
  /** Os dois lados da válvula acionados ao mesmo tempo (sinal preso). */
  conflict?: boolean;
  /** Contagem atual (contador) e valor ajustado. */
  count?: number;
  /** Carga do temporizador, 0 (vazio) a 1 (comutou). */
  charge?: number;
  /** Ângulo do eixo [graus] e rotação [rpm] do motor pneumático. */
  angle?: number;
  rpm?: number;
  /** Ventosa segurando a peça (vácuo suficiente). */
  holding?: boolean;
}

/** Problema detectado durante a simulação. */
export interface RuntimeWarning {
  componentId: string;
  code: "overpressure" | "stuck-signal" | "leak";
  port?: string;
  /** Pressão (bar) ou vazão (l/min), conforme o código. */
  value?: number;
}

/** Estado de uma linha (tubo): pressão em bar e vazão em l/min (positivo = de `from` para `to`). */
export interface WireSimState {
  p: number;
  q: number;
}

export interface SimSnapshot {
  time: number;
  components: Record<string, ComponentSimState>;
  wires: Record<string, WireSimState>;
  /** Pressão (bar) de cada conector, chave "componentId:portId". */
  ports: Record<string, number>;
  warnings: RuntimeWarning[];
}

export type SimCommand =
  | { type: "actuate"; id: string; side: "left" | "right"; active: boolean }
  | { type: "param"; id: string; key: string; value: ParamValue };

export const portKey = (componentId: string, portId: string) => `${componentId}:${portId}`;
