import { Adjustable, CheckElement, Junction } from "../draw";
import type { ComponentDef } from "../types";

/** Válvula reguladora de vazão unidirecional: estrangula de 1→2 e passa livre de 2→1. */
export const flowControlOneWay: ComponentDef = {
  type: "pneu.flow-control.one-way",
  domain: "pneumatic",
  category: "pneu-flow-check",
  labelPrefix: "V",
  width: 60,
  height: 60,
  ports: [
    { id: "1", x: 0, y: 30, kind: "pneumatic" },
    { id: "2", x: 60, y: 30, kind: "pneumatic" },
  ],
  params: [{ key: "opening", type: "number", unit: "%", default: 50, min: 0, max: 100 }],
  keywords: ["vazão", "velocidade", "estrangulamento", "agulha"],
  sim: { kind: "flow-control-one-way" },
  Symbol: () => (
    <g>
      <rect className="sym sym-dashed" x={4} y={4} width={52} height={52} />
      <line className="sym" x1={0} y1={30} x2={12} y2={30} />
      <line className="sym" x1={48} y1={30} x2={60} y2={30} />
      <path className="sym" d="M12 16 V44 M48 16 V44" />
      <Junction x={12} y={30} />
      <Junction x={48} y={30} />
      {/* ramo de cima: estrangulamento ajustável */}
      <path className="sym" d="M12 16 H24 M36 16 H48" />
      <path className="sym" d="M24 10 Q30 16 24 22 M36 10 Q30 16 36 22" />
      <Adjustable cx={30} cy={16} size={9} />
      {/* ramo de baixo: retenção, fluxo livre de 2 para 1 */}
      <path className="sym" d="M12 44 H23 M37 44 H48" />
      <CheckElement cx={30} cy={44} free="left" />
    </g>
  ),
};
