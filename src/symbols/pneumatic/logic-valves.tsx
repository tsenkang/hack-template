import { Adjustable, CheckElement } from "../draw";
import type { ComponentDef } from "../types";

const LOGIC_PORTS = [
  { id: "1a", x: 0, y: 30, kind: "pneumatic" },
  { id: "1b", x: 60, y: 30, kind: "pneumatic" },
  { id: "2", x: 30, y: 0, kind: "pneumatic" },
] as const;

/** Válvula de simultaneidade (função E): só há saída em 2 com ar em 1a E em 1b. */
export const andValve: ComponentDef = {
  type: "pneu.valve.and",
  domain: "pneumatic",
  category: "pneu-flow-check",
  labelPrefix: "V",
  width: 60,
  height: 40,
  ports: [...LOGIC_PORTS],
  params: [],
  keywords: ["e", "and", "simultaneidade", "duas pressões", "bimanual"],
  sim: { kind: "and-valve" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 30 H10 M50 30 H60 M30 0 V20" />
      <rect className="sym sym-bg" x={10} y={20} width={40} height={20} />
      {/* êmbolo com dois assentos: a entrada sozinha fecha a própria passagem */}
      <rect className="sym sym-bg" x={22} y={25} width={16} height={10} />
      <path className="sym" d="M10 26 L16 30 L10 34 M50 26 L44 30 L50 34" />
    </g>
  ),
};

/** Válvula alternadora (função OU): há saída em 2 com ar em 1a OU em 1b. */
export const orValve: ComponentDef = {
  type: "pneu.valve.or",
  domain: "pneumatic",
  category: "pneu-flow-check",
  labelPrefix: "V",
  width: 60,
  height: 40,
  ports: [...LOGIC_PORTS],
  params: [],
  keywords: ["ou", "or", "alternadora", "seletora de circuito"],
  sim: { kind: "or-valve" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 30 H10 M50 30 H60 M30 0 V20" />
      <rect className="sym sym-bg" x={10} y={20} width={40} height={20} />
      {/* esfera que fecha o lado de menor pressão */}
      <path className="sym" d="M16 24 L20 30 L16 36 M44 24 L40 30 L44 36" />
      <circle className="sym sym-bg" cx={30} cy={30} r={5} />
    </g>
  ),
};

/** Válvula de escape rápido: o ar do cilindro (2) sai direto por 3, sem voltar pela válvula. */
export const quickExhaust: ComponentDef = {
  type: "pneu.valve.quick-exhaust",
  domain: "pneumatic",
  category: "pneu-flow-check",
  labelPrefix: "V",
  width: 60,
  height: 50,
  ports: [
    { id: "1", x: 0, y: 20, kind: "pneumatic" },
    { id: "2", x: 60, y: 20, kind: "pneumatic" },
    { id: "3", x: 30, y: 50, kind: "pneumatic", exhaust: true },
  ],
  params: [],
  keywords: ["escape rápido", "velocidade", "descarga"],
  sim: { kind: "quick-exhaust" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 20 H10 M50 20 H60 M30 34 V50" />
      <rect className="sym sym-bg" x={10} y={8} width={40} height={26} />
      <CheckElement cx={26} cy={20} free="right" />
      <path className="sym" d="M33 20 H50 M30 22 V34" />
      {/* escape para a atmosfera */}
      <polygon className="sym sym-bg" points="26,44 34,44 30,50" />
    </g>
  ),
};

/** Reguladora de vazão bidirecional: estrangula nos dois sentidos. */
export const flowControlTwoWay: ComponentDef = {
  type: "pneu.flow-control.two-way",
  domain: "pneumatic",
  category: "pneu-flow-check",
  labelPrefix: "V",
  width: 40,
  height: 20,
  ports: [
    { id: "1", x: 0, y: 10, kind: "pneumatic" },
    { id: "2", x: 40, y: 10, kind: "pneumatic" },
  ],
  params: [{ key: "opening", type: "number", unit: "%", default: 50, min: 0, max: 100 }],
  keywords: ["vazão", "estrangulamento", "agulha", "bidirecional"],
  sim: { kind: "flow-control-two-way" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 10 H14 M26 10 H40" />
      <path className="sym" d="M14 3 Q20 10 14 17 M26 3 Q20 10 26 17" />
      <Adjustable cx={20} cy={10} size={9} />
    </g>
  ),
};
