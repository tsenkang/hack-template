import { CheckElement } from "../draw";
import type { ComponentDef } from "../types";

/** Válvula de retenção: deixa passar de 1 para 2 e bloqueia de 2 para 1. */
export const checkValve: ComponentDef = {
  type: "pneu.check-valve",
  domain: "pneumatic",
  category: "pneu-flow-check",
  labelPrefix: "V",
  width: 40,
  height: 20,
  ports: [
    { id: "1", x: 0, y: 10, kind: "pneumatic" },
    { id: "2", x: 40, y: 10, kind: "pneumatic" },
  ],
  params: [{ key: "crackingPressure", type: "number", unit: "bar", default: 0.1, min: 0, max: 5, step: 0.05 }],
  keywords: ["retenção", "unidirecional", "bloqueio"],
  sim: { kind: "check-valve" },
  Symbol: () => (
    <g>
      <line className="sym" x1={0} y1={10} x2={13} y2={10} />
      <CheckElement cx={20} cy={10} free="right" />
      <line className="sym" x1={26} y1={10} x2={40} y2={10} />
    </g>
  ),
};
