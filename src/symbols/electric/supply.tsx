import type { ComponentDef } from "../types";

function Terminal({ label, portAtBottom }: { label: string; portAtBottom: boolean }) {
  const cy = portAtBottom ? 10 : 20;
  return (
    <g>
      <circle className="sym sym-bg" cx={20} cy={cy} r={4} />
      <line className="sym" x1={20} y1={portAtBottom ? 14 : 0} x2={20} y2={portAtBottom ? 30 : 16} />
      <text className="sym-text" x={28} y={cy + 4} fontSize={10}>{label}</text>
    </g>
  );
}

/** Polo positivo da fonte de 24 V CC (barramento de cima do esquema em escada). */
export const supply24v: ComponentDef = {
  type: "elec.supply.24v",
  domain: "electric",
  category: "elec-supply",
  labelPrefix: "",
  width: 40,
  height: 30,
  ports: [{ id: "+", x: 20, y: 30, kind: "electric" }],
  params: [{ key: "voltage", type: "number", unit: "V", default: 24, min: 1, max: 48 }],
  keywords: ["fonte", "positivo", "alimentação", "24v"],
  Symbol: () => <Terminal label="+24V" portAtBottom />,
};

/** Polo 0 V da fonte (barramento de baixo do esquema em escada). */
export const supply0v: ComponentDef = {
  type: "elec.supply.0v",
  domain: "electric",
  category: "elec-supply",
  labelPrefix: "",
  width: 40,
  height: 30,
  ports: [{ id: "0", x: 20, y: 0, kind: "electric" }],
  params: [],
  keywords: ["fonte", "negativo", "terra", "0v", "comum"],
  Symbol: () => <Terminal label="0V" portAtBottom={false} />,
};
