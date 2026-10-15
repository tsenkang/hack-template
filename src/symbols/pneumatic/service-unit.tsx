import { Adjustable, Arrow, Spring } from "../draw";
import type { ComponentDef } from "../types";

/** Unidade de conservação (filtro + regulador com manômetro), desenho detalhado ISO 1219. */
export const serviceUnit: ComponentDef = {
  type: "pneu.source.service-unit",
  domain: "pneumatic",
  category: "pneu-supply",
  labelPrefix: "Z",
  width: 100,
  height: 60,
  ports: [
    { id: "1", x: 0, y: 40, kind: "pneumatic" },
    { id: "2", x: 100, y: 40, kind: "pneumatic" },
  ],
  params: [{ key: "setPressure", type: "number", unit: "bar", default: 6, min: 0, max: 12, step: 0.1 }],
  keywords: ["frl", "filtro", "regulador", "lubrificador", "lubrefil"],
  Symbol: () => (
    <g>
      <rect className="sym sym-dashed" x={4} y={2} width={92} height={56} />
      <line className="sym" x1={0} y1={40} x2={16} y2={40} />
      {/* filtro: losango com linha tracejada */}
      <polygon className="sym sym-bg" points="28,28 40,40 28,52 16,40" />
      <line className="sym sym-dashed" x1={28} y1={29} x2={28} y2={51} />
      <line className="sym" x1={40} y1={40} x2={52} y2={40} />
      {/* regulador de pressão */}
      <rect className="sym sym-bg" x={52} y={30} width={20} height={20} />
      <Arrow from={[56, 44]} to={[68, 36]} head={4} />
      <Spring x1={72} x2={82} y={40} amp={4} turns={2} />
      <Adjustable cx={77} cy={40} size={6} />
      <line className="sym" x1={62} y1={50} x2={62} y2={54} />
      <line className="sym" x1={62} y1={54} x2={92} y2={54} />
      <line className="sym" x1={92} y1={54} x2={92} y2={40} />
      <line className="sym" x1={92} y1={40} x2={100} y2={40} />
      {/* manômetro */}
      <line className="sym" x1={62} y1={30} x2={62} y2={22} />
      <circle className="sym sym-bg" cx={62} cy={14} r={8} />
      <Arrow from={[57, 19]} to={[67, 9]} head={3} />
    </g>
  ),
};
