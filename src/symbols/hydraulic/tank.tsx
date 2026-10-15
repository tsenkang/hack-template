import type { ComponentDef } from "../types";

/** Reservatório (tanque) aberto para a atmosfera. */
export const tank: ComponentDef = {
  type: "hyd.tank",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "Z",
  width: 40,
  height: 30,
  ports: [{ id: "T", x: 20, y: 0, kind: "hydraulic" }],
  params: [{ key: "volume", type: "number", unit: "l", default: 40, min: 1, max: 2000 }],
  keywords: ["reservatório", "retorno", "óleo", "tanque"],
  sim: { kind: "hyd-tank" },
  Symbol: () => (
    <g>
      <path className="sym" d="M4 10 V26 H36 V10" />
      <line className="sym" x1={20} y1={0} x2={20} y2={22} />
    </g>
  ),
};
