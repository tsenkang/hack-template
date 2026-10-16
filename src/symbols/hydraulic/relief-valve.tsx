/** Válvulas de pressão hidráulicas: alívio, redutora, sequência e contrabalanço. */
import { Adjustable, Arrow, CheckElement, Spring } from "../draw";
import type { ComponentDef, ParamDef } from "../types";

const SET = (value: number): ParamDef => ({ key: "setPressure", type: "number", unit: "bar", default: value, min: 2, max: 400 });
const FLOW: ParamDef = { key: "nominalFlow", type: "number", unit: "l/min", default: 60, min: 1, max: 1000 };

/** Quadrado com seta (deslocada = fechada; alinhada = aberta), piloto tracejado e mola regulável. */
function PressureBody({ open, pilotFrom }: { open: boolean; pilotFrom: "in" | "out" }) {
  const arrowX = open ? 30 : 40;
  return (
    <g>
      <line className="sym" x1={30} y1={0} x2={30} y2={10} />
      <line className="sym" x1={30} y1={50} x2={30} y2={60} />
      <rect className="sym sym-bg" x={10} y={10} width={40} height={40} />
      <Arrow from={[arrowX, 46]} to={[arrowX, 14]} />
      <path className="sym sym-dashed" d={pilotFrom === "in" ? "M30 55 H4 V30 H10" : "M30 5 H4 V30 H10"} />
      <Spring x1={50} x2={66} y={30} amp={6} turns={3} />
      <Adjustable cx={58} cy={30} size={8} />
    </g>
  );
}

const base = { domain: "hydraulic", category: "hyd-valves", labelPrefix: "V", width: 70, height: 60 } as const;

/** Válvula de alívio (limitadora de pressão): abre P→T quando a pressão passa do ajuste. */
export const reliefValve: ComponentDef = {
  ...base,
  type: "hyd.valve.relief",
  ports: [
    { id: "P", x: 30, y: 60, kind: "hydraulic" },
    { id: "T", x: 30, y: 0, kind: "hydraulic" },
  ],
  params: [SET(100), FLOW],
  keywords: ["limitadora", "segurança", "pressão máxima", "alívio"],
  sim: { kind: "hyd-relief" },
  Symbol: () => <PressureBody open={false} pilotFrom="in" />,
};

/** Redutora de pressão: mantém a saída A no valor ajustado. */
export const reducingValve: ComponentDef = {
  ...base,
  type: "hyd.valve.reducing",
  ports: [
    { id: "P", x: 30, y: 60, kind: "hydraulic" },
    { id: "A", x: 30, y: 0, kind: "hydraulic" },
  ],
  params: [SET(40), FLOW],
  keywords: ["redutora", "pressão reduzida", "fixação"],
  sim: { kind: "hyd-reducing" },
  Symbol: () => <PressureBody open pilotFrom="out" />,
};

/** Válvula de sequência: só deixa passar para A quando a entrada P passa do ajuste. */
export const sequenceValveHyd: ComponentDef = {
  ...base,
  type: "hyd.valve.sequence",
  ports: [
    { id: "P", x: 30, y: 60, kind: "hydraulic" },
    { id: "A", x: 30, y: 0, kind: "hydraulic" },
  ],
  params: [SET(60), FLOW],
  keywords: ["sequência", "segundo cilindro", "ordem"],
  sim: { kind: "hyd-sequence" },
  Symbol: () => <PressureBody open={false} pilotFrom="in" />,
};

/** Contrabalanço: segura a carga (A → B só acima do ajuste); volta livre de B para A. */
export const counterbalanceValve: ComponentDef = {
  ...base,
  type: "hyd.valve.counterbalance",
  width: 90,
  ports: [
    { id: "A", x: 30, y: 60, kind: "hydraulic" },
    { id: "B", x: 30, y: 0, kind: "hydraulic" },
  ],
  params: [SET(80), FLOW],
  keywords: ["contrabalanço", "carga suspensa", "segurar peso", "prensa vertical"],
  sim: { kind: "hyd-counterbalance" },
  Symbol: () => (
    <g>
      <PressureBody open={false} pilotFrom="in" />
      {/* retenção em paralelo: livre de B para A */}
      <path className="sym" d="M30 5 H80 V20 M80 40 V55 H30" />
      <g transform="translate(80 30) rotate(90)">
        <CheckElement cx={0} cy={0} free="left" />
      </g>
    </g>
  ),
};
