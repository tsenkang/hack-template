/** Válvulas de vazão e de bloqueio hidráulicas. */
import { Adjustable, Arrow, CheckElement, Junction } from "../draw";
import type { ComponentDef } from "../types";

const INLINE = [
  { id: "1", x: 0, y: 20, kind: "hydraulic" },
  { id: "2", x: 60, y: 20, kind: "hydraulic" },
] as const;

const base = { domain: "hydraulic", category: "hyd-valves", labelPrefix: "V", width: 60, height: 40, ports: [...INLINE] } as const;

/** Estrangulamento (dois arcos), com seta se for ajustável. */
function Restriction({ adjustable, y = 20 }: { adjustable: boolean; y?: number }) {
  return (
    <g>
      <path className="sym" d={`M24 ${y - 7} Q30 ${y} 24 ${y + 7} M36 ${y - 7} Q30 ${y} 36 ${y + 7}`} />
      {adjustable && <Adjustable cx={30} cy={y} size={9} />}
    </g>
  );
}

export const throttleFixed: ComponentDef = {
  ...base,
  type: "hyd.throttle.fixed",
  params: [{ key: "nominalFlow", type: "number", unit: "l/min", default: 10, min: 0.1, max: 500 }],
  keywords: ["estrangulador", "orifício", "restrição fixa"],
  sim: { kind: "hyd-throttle", mode: "fixed" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 20 H24 M36 20 H60" />
      <Restriction adjustable={false} />
    </g>
  ),
};

export const throttleAdjustable: ComponentDef = {
  ...base,
  type: "hyd.throttle.adjustable",
  params: [
    { key: "opening", type: "number", unit: "%", default: 50, min: 0, max: 100 },
    { key: "nominalFlow", type: "number", unit: "l/min", default: 30, min: 0.1, max: 500 },
  ],
  keywords: ["estrangulador", "agulha", "velocidade", "vazão ajustável"],
  sim: { kind: "hyd-throttle", mode: "adjustable" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 20 H24 M36 20 H60" />
      <Restriction adjustable />
    </g>
  ),
};

export const throttleOneWay: ComponentDef = {
  ...base,
  type: "hyd.throttle.one-way",
  height: 60,
  ports: [
    { id: "1", x: 0, y: 30, kind: "hydraulic" },
    { id: "2", x: 60, y: 30, kind: "hydraulic" },
  ],
  params: [
    { key: "opening", type: "number", unit: "%", default: 50, min: 0, max: 100 },
    { key: "nominalFlow", type: "number", unit: "l/min", default: 30, min: 0.1, max: 500 },
  ],
  keywords: ["estrangulador", "unidirecional", "retenção", "velocidade"],
  sim: { kind: "hyd-throttle", mode: "one-way" },
  Symbol: () => (
    <g>
      <rect className="sym sym-dashed" x={4} y={4} width={52} height={52} />
      <path className="sym" d="M0 30 H12 M48 30 H60 M12 16 V44 M48 16 V44 M12 16 H24 M36 16 H48 M12 44 H23 M37 44 H48" />
      <Junction x={12} y={30} />
      <Junction x={48} y={30} />
      <Restriction adjustable y={16} />
      <CheckElement cx={30} cy={44} free="left" />
    </g>
  ),
};

/** Reguladora de vazão com compensação de pressão: vazão constante mesmo com a carga mudando. */
export const flowCompensated: ComponentDef = {
  ...base,
  type: "hyd.flow.compensated",
  height: 50,
  params: [{ key: "flowSetting", type: "number", unit: "l/min", default: 10, min: 0.1, max: 500 }],
  keywords: ["compensada", "vazão constante", "reguladora de vazão", "2 vias"],
  sim: { kind: "hyd-flow-compensated" },
  Symbol: () => (
    <g>
      <rect className="sym sym-bg" x={10} y={4} width={40} height={36} />
      <path className="sym" d="M0 20 H10 M50 20 H60 M10 20 H24 M36 20 H50" />
      <Restriction adjustable />
      {/* seta do compensador */}
      <Arrow from={[14, 34]} to={[46, 34]} head={3} />
    </g>
  ),
};

/** Retenção: passa de 1 para 2. */
export const hydCheck: ComponentDef = {
  ...base,
  type: "hyd.check",
  height: 20,
  width: 40,
  ports: [
    { id: "1", x: 0, y: 10, kind: "hydraulic" },
    { id: "2", x: 40, y: 10, kind: "hydraulic" },
  ],
  params: [],
  keywords: ["retenção", "unidirecional", "bloqueio"],
  sim: { kind: "hyd-check" },
  Symbol: () => (
    <g>
      <line className="sym" x1={0} y1={10} x2={13} y2={10} />
      <CheckElement cx={20} cy={10} free="right" />
      <line className="sym" x1={26} y1={10} x2={40} y2={10} />
    </g>
  ),
};

/** Retenção pilotada: livre de A para B; de B para A só com pressão no piloto X. */
export const hydPilotCheck: ComponentDef = {
  ...base,
  type: "hyd.check.pilot",
  width: 60,
  height: 40,
  ports: [
    { id: "A", x: 0, y: 10, kind: "hydraulic" },
    { id: "B", x: 60, y: 10, kind: "hydraulic" },
    { id: "X", x: 30, y: 40, kind: "hydraulic-pilot" },
  ],
  params: [],
  keywords: ["retenção pilotada", "travamento", "segurar carga", "desbloqueio"],
  sim: { kind: "hyd-pilot-check" },
  Symbol: () => (
    <g>
      <rect className="sym sym-dashed" x={8} y={2} width={44} height={24} />
      <path className="sym" d="M0 10 H23 M37 10 H60" />
      <CheckElement cx={30} cy={10} free="right" />
      <path className="sym sym-dashed" d="M30 40 V22 H22 V16" />
    </g>
  ),
};

/** Ponto de ligação (T) hidráulico. */
export const hydJunction: ComponentDef = {
  type: "hyd.junction",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "",
  width: 20,
  height: 20,
  ports: [
    { id: "1", x: 10, y: 0, kind: "hydraulic" },
    { id: "2", x: 20, y: 10, kind: "hydraulic" },
    { id: "3", x: 10, y: 20, kind: "hydraulic" },
    { id: "4", x: 0, y: 10, kind: "hydraulic" },
  ],
  params: [],
  keywords: ["t", "derivação", "conexão", "ponto"],
  sim: { kind: "junction" },
  Symbol: () => (
    <g>
      <path className="sym" d="M10 0 V20 M0 10 H20" />
      <Junction x={10} y={10} />
    </g>
  ),
};
