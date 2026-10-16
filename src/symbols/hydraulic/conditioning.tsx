/** Condicionamento e medição do óleo: filtro, resfriador, aquecedor, acumulador e instrumentos. */
import { Arrow } from "../draw";
import type { ComponentDef, SymbolProps } from "../types";
import { getLocale } from "@/i18n";

const INLINE = [
  { id: "1", x: 0, y: 20, kind: "hydraulic" },
  { id: "2", x: 60, y: 20, kind: "hydraulic" },
] as const;

/** Losango atravessado pela linha (padrão dos símbolos de condicionamento). */
function Diamond({ children }: { children?: React.ReactNode }) {
  return (
    <g>
      <path className="sym" d="M0 20 H16 M44 20 H60" />
      <polygon className="sym sym-bg" points="30,6 44,20 30,34 16,20" />
      {children}
    </g>
  );
}

const passthrough = (type: string, keywords: string[], children: React.ReactNode, nominalFlow: number): ComponentDef => ({
  type,
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "Z",
  width: 60,
  height: 40,
  ports: [...INLINE],
  params: [{ key: "nominalFlow", type: "number", unit: "l/min", default: nominalFlow, min: 1, max: 1000 }],
  keywords,
  sim: { kind: "hyd-passthrough" },
  Symbol: () => <Diamond>{children}</Diamond>,
});

export const filter = passthrough("hyd.filter", ["filtro", "limpeza", "contaminação"], <line className="sym sym-dashed" x1={30} y1={7} x2={30} y2={33} />, 60);

export const cooler = passthrough(
  "hyd.cooler",
  ["resfriador", "trocador de calor", "temperatura"],
  <g>
    <line className="sym" x1={22} y1={20} x2={38} y2={20} />
    <polygon className="sym-solid" points="26,14 30,10 34,14" />
    <polygon className="sym-solid" points="26,26 30,30 34,26" />
  </g>,
  80,
);

export const heater = passthrough(
  "hyd.heater",
  ["aquecedor", "temperatura", "partida a frio"],
  <g>
    <line className="sym" x1={22} y1={20} x2={38} y2={20} />
    <polygon className="sym-solid" points="26,10 30,14 34,10" />
    <polygon className="sym-solid" points="26,30 30,26 34,30" />
  </g>,
  80,
);

/** Acumulador com gás: o nível mostra quanto óleo ele guarda. */
export const accumulator: ComponentDef = {
  type: "hyd.accumulator",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "Z",
  width: 40,
  height: 60,
  ports: [{ id: "1", x: 20, y: 60, kind: "hydraulic" }],
  params: [
    { key: "volume", type: "number", unit: "l", default: 1, min: 0.05, max: 100, step: 0.05 },
    { key: "precharge", type: "number", unit: "bar", default: 50, min: 1, max: 300 },
  ],
  keywords: ["acumulador", "nitrogênio", "reserva de energia", "bexiga"],
  sim: { kind: "accumulator" },
  Symbol: ({ state }: SymbolProps) => {
    const level = Math.min(1, Math.max(0, state?.charge ?? 0));
    return (
      <g>
        <rect className="sym sym-bg" x={8} y={6} width={24} height={44} rx={12} />
        {level > 0 && <rect className="sym-solid" opacity={0.3} x={9} y={49 - 42 * level} width={22} height={42 * level} />}
        <line className="sym sym-dashed" x1={9} y1={28} x2={31} y2={28} />
        <line className="sym" x1={20} y1={50} x2={20} y2={60} />
      </g>
    );
  },
};

/** Manômetro hidráulico (escala até 250 bar). */
export const hydGauge: ComponentDef = {
  type: "hyd.gauge.pressure",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "M",
  width: 20,
  height: 30,
  ports: [{ id: "1", x: 10, y: 30, kind: "hydraulic" }],
  params: [{ key: "range", type: "number", unit: "bar", default: 250, min: 1, max: 1000 }],
  keywords: ["manômetro", "pressão", "medidor"],
  sim: { kind: "gauge" },
  Symbol: ({ params, state }) => {
    const range = typeof params.range === "number" ? params.range : 250;
    const deg = state?.pressure === undefined ? 45 : -135 + 270 * Math.min(1, Math.max(0, state.pressure / range));
    const rad = ((deg - 90) * Math.PI) / 180;
    return (
      <g>
        <circle className="sym sym-bg" cx={10} cy={11} r={9} />
        <Arrow from={[10 - 7 * Math.cos(rad), 11 - 7 * Math.sin(rad)]} to={[10 + 7 * Math.cos(rad), 11 + 7 * Math.sin(rad)]} head={3.5} />
        <line className="sym" x1={10} y1={20} x2={10} y2={30} />
        {state?.pressure !== undefined && (
          <text className="sym-text" x={22} y={24} fontSize={8}>
            {Math.round(state.pressure)} bar
          </text>
        )}
      </g>
    );
  },
};

/** Medidor de vazão (em linha). */
export const flowMeter: ComponentDef = {
  type: "hyd.flowmeter",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "M",
  width: 60,
  height: 40,
  ports: [...INLINE],
  params: [],
  keywords: ["medidor de vazão", "rotâmetro", "vazão"],
  sim: { kind: "flow-meter" },
  Symbol: ({ state }) => (
    <g>
      <path className="sym" d="M0 20 H18 M42 20 H60" />
      <circle className="sym sym-bg" cx={30} cy={20} r={12} />
      <Arrow from={[22, 20]} to={[38, 20]} head={4} />
      {state?.flow !== undefined && (
        <text className="sym-text" x={30} y={44} fontSize={8} textAnchor="middle">
          {state.flow.toLocaleString(getLocale(), { maximumFractionDigits: 1 })} l/min
        </text>
      )}
    </g>
  ),
};

/** Termômetro (o motor considera o óleo a uma temperatura fixa, ajustável aqui). */
export const thermometer: ComponentDef = {
  type: "hyd.thermometer",
  domain: "hydraulic",
  category: "hyd-supply",
  labelPrefix: "M",
  width: 20,
  height: 30,
  ports: [{ id: "1", x: 10, y: 30, kind: "hydraulic" }],
  params: [{ key: "temperature", type: "number", unit: "°C", default: 40, min: -20, max: 120 }],
  keywords: ["termômetro", "temperatura", "óleo"],
  Symbol: ({ params }) => (
    <g>
      <circle className="sym sym-bg" cx={10} cy={11} r={9} />
      <path className="sym" d="M10 5 V14" />
      <circle className="sym-solid" cx={10} cy={15} r={2.5} />
      <line className="sym" x1={10} y1={20} x2={10} y2={30} />
      <text className="sym-text" x={22} y={14} fontSize={8}>
        {String(params.temperature ?? 40)} °C
      </text>
    </g>
  ),
};
