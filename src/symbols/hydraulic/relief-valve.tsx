import { Adjustable, Arrow, Spring } from "../draw";
import type { ComponentDef } from "../types";

/** Válvula de alívio (limitadora de pressão): abre P→T quando a pressão passa do ajuste. */
export const reliefValve: ComponentDef = {
  type: "hyd.valve.relief",
  domain: "hydraulic",
  category: "hyd-valves",
  labelPrefix: "V",
  width: 70,
  height: 60,
  ports: [
    { id: "P", x: 30, y: 60, kind: "hydraulic" },
    { id: "T", x: 30, y: 0, kind: "hydraulic" },
  ],
  params: [{ key: "setPressure", type: "number", unit: "bar", default: 100, min: 5, max: 350 }],
  keywords: ["limitadora", "segurança", "pressão máxima"],
  Symbol: () => (
    <g>
      <line className="sym" x1={30} y1={0} x2={30} y2={10} />
      <line className="sym" x1={30} y1={50} x2={30} y2={60} />
      <rect className="sym sym-bg" x={10} y={10} width={40} height={40} />
      {/* seta deslocada = fechada em repouso */}
      <Arrow from={[40, 46]} to={[40, 14]} />
      {/* piloto interno vindo de P */}
      <path className="sym sym-dashed" d="M30 55 H4 V30 H10" />
      <Spring x1={50} x2={66} y={30} amp={6} turns={3} />
      <Adjustable cx={58} cy={30} size={8} />
    </g>
  ),
};
