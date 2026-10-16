import { Arrow } from "../draw";
import type { ComponentDef } from "../types";

const PORTS = [
  { id: "P", x: 50, y: 0, kind: "hydraulic" },
  { id: "S", x: 50, y: 60, kind: "hydraulic" },
] as const;

/** Motor elétrico + bomba: círculo com triângulo cheio (óleo). `variable` desenha a seta de ajuste. */
function PumpSymbol({ variable }: { variable: boolean }) {
  return (
    <g>
      <circle className="sym sym-bg" cx={14} cy={30} r={12} />
      <text className="sym-text" x={14} y={34} textAnchor="middle" fontSize={11}>
        M
      </text>
      <path className="sym" d="M26 28 H38 M26 32 H38" />
      <circle className="sym sym-bg" cx={50} cy={30} r={12} />
      <polygon className="sym-solid" points="50,19 45,27 55,27" />
      {variable && <Arrow from={[40, 42]} to={[62, 18]} head={4} />}
      <line className="sym" x1={50} y1={0} x2={50} y2={18} />
      <line className="sym" x1={50} y1={42} x2={50} y2={60} />
    </g>
  );
}

/** Bomba hidráulica de deslocamento fixo, com motor elétrico de acionamento. */
export const pumpFixed: ComponentDef = {
  type: "hyd.pump.fixed",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "P",
  width: 70,
  height: 60,
  ports: [...PORTS],
  params: [
    { key: "displacement", type: "number", unit: "cm³/rot", default: 8, min: 0.5, max: 250, step: 0.5 },
    { key: "speed", type: "number", unit: "rpm", default: 1450, min: 100, max: 3600, step: 10 },
    { key: "maxPressure", type: "number", unit: "bar", default: 250, min: 10, max: 700 },
  ],
  keywords: ["unidade hidráulica", "motobomba", "fonte", "bomba"],
  sim: { kind: "hyd-pump", variable: false },
  Symbol: () => <PumpSymbol variable={false} />,
};

/** Bomba de deslocamento variável com compensador de pressão. */
export const pumpVariable: ComponentDef = {
  type: "hyd.pump.variable",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "P",
  width: 70,
  height: 60,
  ports: [...PORTS],
  params: [
    { key: "displacement", type: "number", unit: "cm³/rot", default: 16, min: 0.5, max: 250, step: 0.5 },
    { key: "setting", type: "number", unit: "%", default: 100, min: 0, max: 100 },
    { key: "speed", type: "number", unit: "rpm", default: 1450, min: 100, max: 3600, step: 10 },
    { key: "setPressure", type: "number", unit: "bar", default: 120, min: 5, max: 350 },
  ],
  keywords: ["bomba variável", "compensada", "pistões", "economia"],
  sim: { kind: "hyd-pump", variable: true },
  Symbol: () => <PumpSymbol variable />,
};
