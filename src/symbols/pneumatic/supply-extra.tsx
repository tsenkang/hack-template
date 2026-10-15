import type { ComponentDef } from "../types";

/** Compressor: fonte com vazão limitada (a pressão cai se o consumo passar da capacidade). */
export const compressor: ComponentDef = {
  type: "pneu.source.compressor",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "P",
  width: 40,
  height: 40,
  ports: [{ id: "1", x: 20, y: 0, kind: "pneumatic" }],
  params: [
    { key: "pressure", type: "number", unit: "bar", default: 6, min: 0, max: 16, step: 0.1 },
    { key: "flow", type: "number", unit: "l/min", default: 600, min: 10, max: 10000, step: 10 },
  ],
  keywords: ["compressor", "fonte", "alimentação"],
  sim: { kind: "air-source" },
  Symbol: () => (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={10} />
      <circle className="sym sym-bg" cx={20} cy={23} r={13} />
      <polygon className="sym sym-bg" points="20,11 14,20 26,20" />
    </g>
  ),
};

/** Reservatório de ar (pulmão): guarda ar e amortece quedas de pressão. */
export const airReservoir: ComponentDef = {
  type: "pneu.reservoir",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "Z",
  width: 60,
  height: 40,
  ports: [
    { id: "1", x: 0, y: 20, kind: "pneumatic" },
    { id: "2", x: 60, y: 20, kind: "pneumatic" },
  ],
  params: [{ key: "volume", type: "number", unit: "l", default: 5, min: 0.1, max: 1000, step: 0.1 }],
  keywords: ["tanque", "pulmão", "acumulador", "reservatório"],
  sim: { kind: "reservoir" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 20 H10 M50 20 H60" />
      <rect className="sym sym-bg" x={10} y={8} width={40} height={24} rx={10} />
    </g>
  ),
};
