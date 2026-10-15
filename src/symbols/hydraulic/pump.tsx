import type { ComponentDef } from "../types";

/** Bomba hidráulica de deslocamento fixo, com motor elétrico de acionamento. */
export const pumpFixed: ComponentDef = {
  type: "hyd.pump.fixed",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "P",
  width: 70,
  height: 60,
  ports: [
    { id: "P", x: 50, y: 0, kind: "hydraulic" },
    { id: "S", x: 50, y: 60, kind: "hydraulic" },
  ],
  params: [
    { key: "displacement", type: "number", unit: "cm³/rot", default: 8, min: 0.5, max: 250, step: 0.5 },
    { key: "speed", type: "number", unit: "rpm", default: 1450, min: 100, max: 3600, step: 10 },
  ],
  keywords: ["unidade hidráulica", "motobomba", "fonte"],
  Symbol: () => (
    <g>
      {/* motor elétrico */}
      <circle className="sym sym-bg" cx={14} cy={30} r={12} />
      <text className="sym-text" x={14} y={34} textAnchor="middle" fontSize={11}>M</text>
      <path className="sym" d="M26 28 H38 M26 32 H38" />
      {/* bomba: triângulo cheio apontando para a saída */}
      <circle className="sym sym-bg" cx={50} cy={30} r={12} />
      <polygon className="sym-solid" points="50,19 45,27 55,27" />
      <line className="sym" x1={50} y1={0} x2={50} y2={18} />
      <line className="sym" x1={50} y1={42} x2={50} y2={60} />
    </g>
  ),
};
