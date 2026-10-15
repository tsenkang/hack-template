/**
 * Tipos trocados entre a tela e o motor de simulação (que roda no Web Worker).
 * Tudo aqui é dado puro (serializável), sem funções nem React.
 */
import type { ParamValue } from "./types";

/** Acionamento de um lado da válvula direcional. */
export type Actuator = "spring" | "button" | "pilot" | "solenoid" | "roller" | "lever";

/** Comportamento de cada tipo de peça no motor. Fica na definição da peça (`ComponentDef.sim`). */
export type SimSpec =
  | { kind: "air-source" }
  | { kind: "service-unit" }
  | { kind: "silencer" }
  | { kind: "gauge" }
  | { kind: "junction" }
  | { kind: "check-valve" }
  | { kind: "flow-control-one-way" }
  | { kind: "cylinder"; singleActing: boolean }
  | {
      kind: "valve";
      squares: readonly { flows: readonly (readonly [string, string])[]; blocked: readonly string[] }[];
      restIndex: number;
      left: Actuator;
      right: Actuator;
      pilotIds?: { left?: string; right?: string };
    };

/** Conector, como o motor enxerga: tipo + se fica aberto para a atmosfera quando solto. */
export interface SimPort {
  id: string;
  /** true = conector solto escapa para a atmosfera; false = fica fechado (piloto, manômetro). */
  ventsWhenOpen: boolean;
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
}

export type SimCommand =
  | { type: "actuate"; id: string; side: "left" | "right"; active: boolean }
  | { type: "param"; id: string; key: string; value: ParamValue };

export const portKey = (componentId: string, portId: string) => `${componentId}:${portId}`;
