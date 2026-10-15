import { Junction } from "../draw";
import type { ComponentDef } from "../types";

/** Ponto de ligação (T / distribuidor): todos os conectores estão no mesmo ponto. */
export const junction: ComponentDef = {
  type: "pneu.junction",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "",
  width: 20,
  height: 20,
  ports: [
    { id: "1", x: 10, y: 0, kind: "pneumatic" },
    { id: "2", x: 20, y: 10, kind: "pneumatic" },
    { id: "3", x: 10, y: 20, kind: "pneumatic" },
    { id: "4", x: 0, y: 10, kind: "pneumatic" },
  ],
  params: [],
  keywords: ["t", "derivação", "distribuidor", "conexão", "ponto"],
  sim: { kind: "junction" },
  Symbol: () => (
    <g>
      <path className="sym" d="M10 0 V20 M0 10 H20" />
      <Junction x={10} y={10} />
    </g>
  ),
};
