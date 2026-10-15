import type { ComponentDef } from "../types";

/** Silenciador de escape. */
export const silencer: ComponentDef = {
  type: "pneu.silencer",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "Z",
  width: 20,
  height: 30,
  ports: [{ id: "1", x: 10, y: 0, kind: "pneumatic" }],
  params: [],
  keywords: ["escape", "abafador"],
  Symbol: () => (
    <g>
      <line className="sym" x1={10} y1={0} x2={10} y2={10} />
      <rect className="sym sym-bg" x={3} y={10} width={14} height={16} />
      <line className="sym" x1={7} y1={13} x2={7} y2={23} />
      <line className="sym" x1={10} y1={13} x2={10} y2={23} />
      <line className="sym" x1={13} y1={13} x2={13} y2={23} />
    </g>
  ),
};
