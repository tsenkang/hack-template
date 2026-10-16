import type { ComponentDef } from "../types";

function Terminal({ label, portAtBottom }: { label: string; portAtBottom: boolean }) {
  const cy = portAtBottom ? 10 : 20;
  return (
    <g>
      <circle className="sym sym-bg" cx={20} cy={cy} r={4} />
      <line className="sym" x1={20} y1={portAtBottom ? 14 : 0} x2={20} y2={portAtBottom ? 30 : 16} />
      <text className="sym-text" x={28} y={cy + 4} fontSize={10}>
        {label}
      </text>
    </g>
  );
}

const base = { domain: "electric", category: "elec-supply", labelPrefix: "", width: 40, height: 30 } as const;

/** Polo positivo da fonte de 24 V CC (barramento de cima do esquema em escada). */
export const supply24v: ComponentDef = {
  ...base,
  type: "elec.supply.24v",
  ports: [{ id: "+", x: 20, y: 30, kind: "electric" }],
  params: [{ key: "voltage", type: "number", unit: "V", default: 24, min: 1, max: 48 }],
  keywords: ["fonte", "positivo", "alimentação", "24v"],
  sim: { kind: "elec-supply", potential: "positive" },
  Symbol: () => <Terminal label="+24V" portAtBottom />,
};

/** Polo 0 V da fonte (barramento de baixo do esquema em escada). */
export const supply0v: ComponentDef = {
  ...base,
  type: "elec.supply.0v",
  ports: [{ id: "0", x: 20, y: 0, kind: "electric" }],
  params: [],
  keywords: ["fonte", "negativo", "terra", "0v", "comum"],
  sim: { kind: "elec-supply", potential: "zero" },
  Symbol: () => <Terminal label="0V" portAtBottom={false} />,
};

/** Fase de rede 220 V CA. */
export const supplyLine: ComponentDef = {
  ...base,
  type: "elec.supply.line",
  ports: [{ id: "L", x: 20, y: 30, kind: "electric" }],
  params: [{ key: "voltage", type: "number", unit: "V", default: 220, min: 1, max: 440 }],
  keywords: ["fase", "220", "corrente alternada", "ca", "rede"],
  sim: { kind: "elec-supply", potential: "positive" },
  Symbol: () => <Terminal label="L ~220V" portAtBottom />,
};

/** Neutro da rede CA. */
export const supplyNeutral: ComponentDef = {
  ...base,
  type: "elec.supply.neutral",
  ports: [{ id: "N", x: 20, y: 0, kind: "electric" }],
  params: [],
  keywords: ["neutro", "220", "corrente alternada", "ca"],
  sim: { kind: "elec-supply", potential: "zero" },
  Symbol: () => <Terminal label="N" portAtBottom={false} />,
};
