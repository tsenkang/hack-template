/**
 * Tipos trocados entre a tela e o motor de simulação (que roda no Web Worker).
 * Tudo aqui é dado puro (serializável), sem funções nem React.
 */
import type { PlcState } from "../logic/plc";
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
  | HydraulicSpec
  | ElectricSpec
  | {
      kind: "valve";
      squares: readonly { flows: readonly (readonly [string, string])[]; blocked: readonly string[] }[];
      restIndex: number;
      left: Actuator;
      right: Actuator;
      pilotIds?: { left?: string; right?: string };
      /** Válvula de 3 posições centrada por molas nos dois lados. */
      springCentered?: boolean;
      /** Ar (padrão) ou óleo: muda a lei de vazão e a pressão de pilotagem. */
      domain?: FluidDomain;
    };

/** Peças hidráulicas próprias (cilindros, válvulas direcionais, manômetro e T são compartilhados). */
export type HydraulicSpec =
  | { kind: "hyd-pump"; variable: boolean }
  | { kind: "hyd-tank" }
  /** Filtro, resfriador, aquecedor: uma pequena perda de carga entre 1 e 2. */
  | { kind: "hyd-passthrough" }
  | { kind: "flow-meter" }
  | { kind: "accumulator" }
  | { kind: "hyd-motor" }
  | { kind: "hyd-relief" }
  | { kind: "hyd-reducing" }
  | { kind: "hyd-sequence" }
  | { kind: "hyd-counterbalance" }
  | { kind: "hyd-throttle"; mode: "fixed" | "adjustable" | "one-way" }
  | { kind: "hyd-flow-compensated" }
  | { kind: "hyd-check" }
  | { kind: "hyd-pilot-check" }
  | { kind: "proportional-valve"; servo: boolean };

/** Como um contato elétrico é acionado. */
export type ContactDrive =
  /** botão comum (só enquanto apertado) */
  | "push"
  /** botão com trava, chave seletora de 2 posições: cada clique alterna */
  | "toggle"
  /** botão de emergência: clique trava aberto, outro clique destrava */
  | "emergency"
  /** contato de relé, contator, temporizador ou contador com o mesmo rótulo */
  | "relay"
  /** fim de curso mecânico (rolete) ou sensor: posição da haste de um cilindro */
  | "position"
  /** pressostato: pressão no conector pneumático P */
  | "pressure";

/** Peças elétricas (IEC 60617). Os conectores elétricos formam redes próprias. */
export type ElectricSpec =
  /** Polo da fonte: "positive" fica na tensão ajustada (+24 V, fase), "zero" em 0 V (neutro). */
  | { kind: "elec-supply"; potential: "positive" | "zero" }
  /**
   * Chave com um ou mais contatos. Cada contato liga `a`–`b` quando está fechado:
   * NA fecha quando acionado; NF abre quando acionado. `tolerance` [mm] para sensores.
   */
  | {
      kind: "elec-switch";
      drive: ContactDrive;
      contacts: readonly { a: string; b: string; normally: "open" | "closed" }[];
      tolerance?: number;
    }
  /** Seletora de 3 posições: 1–2 fecha à esquerda, 1–4 à direita, centro desligado. */
  | { kind: "elec-selector3" }
  /** Cargas: consomem corrente entre dois terminais. */
  | {
      kind: "elec-load";
      load: "relay-coil" | "solenoid-coil" | "timer-on" | "timer-off" | "counter" | "counter-reset" | "lamp" | "buzzer" | "resistor";
    }
  /** Fusível (queima e fica aberto) ou disjuntor (desarma; clique rearma ou desliga). */
  | { kind: "elec-fuse"; breaker: boolean }
  | { kind: "elec-diode" }
  /** CLP: alimentação L+/M, entradas I0…I7 e saídas Q0…Q7 (programa ladder/GRAFCET no parâmetro `program`). */
  | { kind: "elec-plc" };

export const isElectric = (spec: SimSpec): spec is ElectricSpec => spec.kind.startsWith("elec-");

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

/** Domínio de uma rede ou linha. */
export type FluidDomain = "pneumatic" | "hydraulic";

export interface SimComponent {
  id: string;
  label: string;
  spec: SimSpec;
  params: Record<string, ParamValue>;
  /** Conectores pneumáticos (redes de ar). */
  ports: SimPort[];
  /** Conectores hidráulicos (redes de óleo). */
  hydPorts: SimPort[];
  /** Conectores elétricos (redes elétricas). */
  elecPorts: string[];
}

/** Rede = conjunto de conectores ligados entre si (mesma pressão). */
export interface SimNet {
  ports: string[]; // chaves "componentId:portId"
  wires: string[];
}

/** Circuito pronto para simular: peças com comportamento + redes já montadas. */
export interface SimCircuit {
  components: SimComponent[];
  /** Redes de ar. */
  nets: SimNet[];
  /** Redes de óleo. */
  hydNets: SimNet[];
  /** Redes elétricas (fios ligados entre si). */
  elecNets: SimNet[];
  wires: { id: string; from: string; to: string; domain: FluidDomain | "electric" }[];
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
  /** Contato fechado (chaves elétricas; nas de 2 contatos, o primeiro). */
  closed?: boolean;
  /** Carga elétrica ligada (bobina, lâmpada, buzina). */
  energized?: boolean;
  /** Posição da seletora de 3 posições: −1, 0 ou 1. */
  position?: number;
  /** Fusível queimado / disjuntor desarmado. */
  blown?: boolean;
  /** Vazão medida [l/min] (medidor de vazão). */
  flow?: number;
  /** Entradas, saídas e etapas ativas do CLP. */
  plc?: PlcState;
}

/** Problema detectado durante a simulação. */
export interface RuntimeWarning {
  componentId: string;
  code: "overpressure" | "stuck-signal" | "leak" | "short-circuit" | "overvoltage" | "fuse-blown";
  port?: string;
  /** Pressão (bar) ou vazão (l/min), conforme o código. */
  value?: number;
}

/**
 * Estado de uma linha. Tubo: pressão `p` [bar] e vazão `q` [l/min].
 * Fio: tensão `p` [V] e corrente `q` [mA]. Positivo = de `from` para `to`.
 */
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
