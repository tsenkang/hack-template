import type { ComponentDef } from "../types";

/** Fonte de ar comprimido (ISO 1219): círculo com ponto central. */
export const airSource: ComponentDef = {
  type: "pneu.source.air",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "P",
  width: 40,
  height: 40,
  ports: [{ id: "1", x: 20, y: 40, kind: "pneumatic" }],
  params: [{ key: "pressure", type: "number", unit: "bar", default: 6, min: 0, max: 16, step: 0.1 }],
  keywords: ["compressor", "alimentação", "ar"],
  sim: { kind: "air-source" },
  Symbol: () => (
    <g>
      <circle className="sym sym-bg" cx={20} cy={18} r={10} />
      <circle className="sym-solid" cx={20} cy={18} r={2.5} />
      <line className="sym" x1={20} y1={28} x2={20} y2={40} />
    </g>
  ),
};
