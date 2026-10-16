import { Arrow } from "../draw";
import type { ComponentDef, SymbolProps } from "../types";
import { getLocale } from "@/i18n";

/** Ângulo do ponteiro: −135° (zero) a +135° (fundo de escala); 45° no modo de edição. */
function needleAngle(pressure: number | undefined, range: number) {
  if (pressure === undefined) return 45;
  return -135 + 270 * Math.min(1, Math.max(0, pressure / range));
}

function GaugeSymbol({ params, state }: SymbolProps) {
  const range = typeof params.range === "number" ? params.range : 10;
  const rad = ((needleAngle(state?.pressure, range) - 90) * Math.PI) / 180;
  const r = 7;
  return (
    <g>
      <circle className="sym sym-bg" cx={10} cy={11} r={9} />
      <Arrow from={[10 - r * Math.cos(rad), 11 - r * Math.sin(rad)]} to={[10 + r * Math.cos(rad), 11 + r * Math.sin(rad)]} head={3.5} />
      <line className="sym" x1={10} y1={20} x2={10} y2={30} />
      {state?.pressure !== undefined && (
        <text className="sym-text" x={22} y={24} fontSize={8}>
          {state.pressure.toLocaleString(getLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} bar
        </text>
      )}
    </g>
  );
}

/** Manômetro: mede a pressão no ponto em que é ligado. Na simulação o ponteiro se move. */
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
  sim: { kind: "gauge" },
  Symbol: GaugeSymbol,
};
