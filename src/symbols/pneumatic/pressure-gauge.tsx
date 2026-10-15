import { Arrow } from "../draw";
import type { ComponentDef } from "../types";

/** Manômetro: mede a pressão no ponto em que é ligado. */
export const pressureGauge: ComponentDef = {
  type: "pneu.gauge.pressure",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "M",
  width: 20,
  height: 30,
  ports: [{ id: "1", x: 10, y: 30, kind: "pneumatic" }],
  params: [{ key: "range", type: "number", unit: "bar", default: 10, min: 1, max: 400 }],
  keywords: ["medidor", "pressão"],
  Symbol: () => (
    <g>
      <circle className="sym sym-bg" cx={10} cy={11} r={9} />
      <Arrow from={[4, 17]} to={[16, 5]} head={3.5} />
      <line className="sym" x1={10} y1={20} x2={10} y2={30} />
    </g>
  ),
};
