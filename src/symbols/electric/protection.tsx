/** Fusível, disjuntor, diodo e resistor. */
import type { ComponentDef } from "../types";
import { ELEC_H, ELEC_W } from "./draw";

const T12 = [
  { id: "1", x: 20, y: 0, kind: "electric" },
  { id: "2", x: 20, y: ELEC_H, kind: "electric" },
] as const;

const base = { domain: "electric", category: "elec-protection", width: ELEC_W, height: ELEC_H } as const;

/** Fusível: queima acima da corrente nominal (clique para trocar). */
export const fuse: ComponentDef = {
  ...base,
  type: "elec.fuse",
  labelPrefix: "F",
  ports: [...T12],
  params: [{ key: "current", type: "number", unit: "A", default: 2, min: 0.05, max: 100, step: 0.05 }],
  keywords: ["fusível", "proteção", "curto"],
  interactive: true,
  sim: { kind: "elec-fuse", breaker: false },
  Symbol: ({ state }) => (
    <g>
      <path className="sym" d="M20 0 V18 M20 42 V60" />
      <rect className="sym sym-bg" x={15} y={18} width={10} height={24} />
      {!state?.blown && <line className="sym" x1={20} y1={18} x2={20} y2={42} />}
      {state?.blown && <path className="sym sym-danger" d="M13 24 L27 36 M27 24 L13 36" />}
    </g>
  ),
};

/** Disjuntor: desarma por sobrecorrente; clique rearma (ou desliga, se estiver ligado). */
export const breaker: ComponentDef = {
  ...base,
  type: "elec.breaker",
  labelPrefix: "Q",
  ports: [...T12],
  params: [{ key: "current", type: "number", unit: "A", default: 4, min: 0.1, max: 100, step: 0.1 }],
  keywords: ["disjuntor", "proteção", "liga-desliga geral"],
  interactive: true,
  sim: { kind: "elec-fuse", breaker: true },
  Symbol: ({ state }) => {
    const closed = state ? !state.blown : true;
    return (
      <g>
        <path className="sym" d="M20 0 V20 M20 40 V60" />
        <line className={closed ? "sym" : "sym sym-danger"} x1={20} y1={40} x2={closed ? 21 : 10} y2={closed ? 20 : 22} />
        <path className="sym" d="M17 17 L23 23 M23 17 L17 23" />
        <rect className="sym" x={4} y={26} width={6} height={8} />
        <line className="sym sym-dashed" x1={10} y1={30} x2={15} y2={30} />
      </g>
    );
  },
};

/** Diodo: deixa a corrente passar só do ânodo (A) para o cátodo (K). */
export const diode: ComponentDef = {
  ...base,
  type: "elec.diode",
  labelPrefix: "V",
  ports: [
    { id: "A", x: 20, y: 0, kind: "electric" },
    { id: "K", x: 20, y: ELEC_H, kind: "electric" },
  ],
  params: [],
  keywords: ["diodo", "roda livre", "retificador"],
  sim: { kind: "elec-diode" },
  Symbol: () => (
    <g>
      <path className="sym" d="M20 0 V22 M20 38 V60" />
      <polygon className="sym sym-bg" points="12,22 28,22 20,36" />
      <line className="sym" x1={12} y1={37} x2={28} y2={37} />
    </g>
  ),
};

/** Resistor. */
export const resistor: ComponentDef = {
  ...base,
  type: "elec.resistor",
  labelPrefix: "R",
  ports: [...T12],
  params: [{ key: "resistance", type: "number", unit: "Ω", default: 1000, min: 0.1, max: 1e7 }],
  keywords: ["resistor", "resistência"],
  sim: { kind: "elec-load", load: "resistor" },
  Symbol: () => (
    <g>
      <path className="sym" d="M20 0 V18 M20 42 V60" />
      <rect className="sym sym-bg" x={14} y={18} width={12} height={24} />
    </g>
  ),
};
