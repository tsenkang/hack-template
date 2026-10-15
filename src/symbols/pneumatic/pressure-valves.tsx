import { Adjustable, Arrow, Spring } from "../draw";
import type { ComponentDef } from "../types";

/** Regulador de pressão: mantém a saída 2 na pressão ajustada (aliviando o excesso). */
export const pressureRegulator: ComponentDef = {
  type: "pneu.valve.pressure-regulator",
  domain: "pneumatic",
  category: "pneu-pressure",
  labelPrefix: "V",
  width: 70,
  height: 60,
  ports: [
    { id: "1", x: 30, y: 60, kind: "pneumatic" },
    { id: "2", x: 30, y: 0, kind: "pneumatic" },
  ],
  params: [{ key: "setPressure", type: "number", unit: "bar", default: 4, min: 0, max: 12, step: 0.1 }],
  keywords: ["redutora", "reguladora de pressão"],
  sim: { kind: "pressure-regulator" },
  Symbol: () => (
    <g>
      <path className="sym" d="M30 0 V10 M30 50 V60" />
      <rect className="sym sym-bg" x={10} y={10} width={40} height={40} />
      {/* seta alinhada às vias = aberta em repouso */}
      <Arrow from={[30, 46]} to={[30, 14]} />
      {/* piloto interno vindo da saída */}
      <path className="sym sym-dashed" d="M30 5 H4 V30 H10" />
      <Spring x1={50} x2={66} y={30} amp={6} turns={3} />
      <Adjustable cx={58} cy={30} size={8} />
    </g>
  ),
};

/** Válvula de alívio (limitadora de pressão): abre 1 → 3 quando a pressão passa do ajuste. */
export const pneuReliefValve: ComponentDef = {
  type: "pneu.valve.relief",
  domain: "pneumatic",
  category: "pneu-pressure",
  labelPrefix: "V",
  width: 70,
  height: 60,
  ports: [
    { id: "1", x: 30, y: 60, kind: "pneumatic" },
    { id: "3", x: 30, y: 0, kind: "pneumatic", exhaust: true },
  ],
  params: [{ key: "setPressure", type: "number", unit: "bar", default: 7, min: 0.5, max: 16, step: 0.1 }],
  keywords: ["limitadora", "segurança", "pressão máxima"],
  sim: { kind: "relief-valve" },
  Symbol: () => (
    <g>
      <path className="sym" d="M30 0 V10 M30 50 V60" />
      <rect className="sym sym-bg" x={10} y={10} width={40} height={40} />
      <Arrow from={[40, 46]} to={[40, 14]} />
      <path className="sym sym-dashed" d="M30 55 H4 V30 H10" />
      <Spring x1={50} x2={66} y={30} amp={6} turns={3} />
      <Adjustable cx={58} cy={30} size={8} />
    </g>
  ),
};
