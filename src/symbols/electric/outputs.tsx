import type { ComponentDef } from "../types";
import { ELEC_H, ELEC_W } from "./draw";

const TERMINALS = [
  { id: "A1", x: 20, y: 0, kind: "electric" },
  { id: "A2", x: 20, y: ELEC_H, kind: "electric" },
] as const;

/** Bobina de relé (ou de solenoide de válvula). */
export const relayCoil: ComponentDef = {
  type: "elec.relay.coil",
  domain: "electric",
  category: "elec-outputs",
  labelPrefix: "K",
  width: ELEC_W,
  height: ELEC_H,
  ports: [...TERMINALS],
  params: [],
  keywords: ["relé", "bobina", "contator", "auxiliar"],
  Symbol: () => (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={22} />
      <rect className="sym sym-bg" x={10} y={22} width={20} height={16} />
      <line className="sym" x1={20} y1={38} x2={20} y2={60} />
    </g>
  ),
};

/** Lâmpada de sinalização. */
export const lamp: ComponentDef = {
  type: "elec.lamp",
  domain: "electric",
  category: "elec-outputs",
  labelPrefix: "H",
  width: ELEC_W,
  height: ELEC_H,
  ports: [
    { id: "X1", x: 20, y: 0, kind: "electric" },
    { id: "X2", x: 20, y: ELEC_H, kind: "electric" },
  ],
  params: [{ key: "color", type: "select", default: "green", options: ["green", "red", "yellow", "white"] }],
  keywords: ["sinaleiro", "indicador", "luz"],
  Symbol: () => (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={20} />
      <circle className="sym sym-bg" cx={20} cy={30} r={10} />
      <path className="sym" d="M13 23 L27 37 M27 23 L13 37" />
      <line className="sym" x1={20} y1={40} x2={20} y2={60} />
    </g>
  ),
};
