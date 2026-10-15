/**
 * Gerador de cilindros lineares, usado na pneumática e na hidráulica.
 * Variantes: padrão, haste dupla (passante), com amortecimento, sem haste e garra.
 * Durante a simulação o êmbolo (e a haste, o carro ou as garras) acompanha `state.extension`.
 */
import type { Domain } from "@/engine/core/types";
import type { CategoryId } from "./categories";
import { Adjustable, Spring } from "./draw";
import type { ComponentDef, ParamDef, PortDef, SymbolProps } from "./types";

const BODY_W = 120;
const BODY_TOP = 10;
const BODY_H = 30;
const CY = BODY_TOP + BODY_H / 2;
const ROD_OUT = 30;
const HEIGHT = BODY_TOP + BODY_H + 10;
const PISTON_X = 8;
const PISTON_W = 4;
/** Comprimento da haste: com o cilindro recuado, ela sai ROD_OUT para fora do corpo. */
const ROD_LENGTH = BODY_W - PISTON_X - PISTON_W + ROD_OUT;
/** Curso do êmbolo no desenho. */
const TRAVEL = BODY_W - 2 * PISTON_X - PISTON_W;

export type CylinderVariant = "standard" | "through-rod" | "cushioned" | "rodless" | "gripper";

export interface CylinderSpec {
  type: string;
  domain: Extract<Domain, "pneumatic" | "hydraulic">;
  category: CategoryId;
  singleActing: boolean;
  variant?: CylinderVariant;
  defaults: { piston: number; rod: number; stroke: number; maxPressure: number };
  keywords?: string[];
}

/** Deslocamento horizontal do corpo (a haste passante sai também pela esquerda). */
const bodyX = (variant: CylinderVariant) => (variant === "through-rod" ? ROD_OUT : 0);

function width(variant: CylinderVariant) {
  if (variant === "rodless" || variant === "gripper") return BODY_W;
  return bodyX(variant) + BODY_W + ROD_OUT;
}

/** Garra paralela: corpo pequeno e duas garras que fecham quando a "haste" avança. */
function GripperSymbol({ extension }: { extension: number }) {
  const open = 14 - 10 * extension;
  return (
    <g>
      <rect className="sym sym-bg" x={20} y={BODY_TOP} width={80} height={BODY_H} />
      <rect className="sym-solid" x={30 + 50 * extension} y={BODY_TOP + 1} width={PISTON_W} height={BODY_H - 2} />
      <path className="sym" d={`M30 ${BODY_TOP + BODY_H} V${HEIGHT} M90 ${BODY_TOP + BODY_H} V${HEIGHT}`} />
      {/* garras */}
      <path className="sym" d={`M60 ${BODY_TOP} V${BODY_TOP - 4} H${60 - open} V${BODY_TOP - 10}`} />
      <path className="sym" d={`M60 ${BODY_TOP} V${BODY_TOP - 4} H${60 + open} V${BODY_TOP - 10}`} />
    </g>
  );
}

export function makeCylinderDef(spec: CylinderSpec): ComponentDef {
  const variant = spec.variant ?? "standard";
  const d = spec.defaults;
  const x0 = bodyX(variant);
  const params: ParamDef[] = [
    { key: "pistonDiameter", type: "number", unit: "mm", default: d.piston, min: 6, max: 320 },
    { key: "rodDiameter", type: "number", unit: "mm", default: d.rod, min: 3, max: 200 },
    { key: "stroke", type: "number", unit: "mm", default: d.stroke, min: 5, max: 2000, step: 5 },
    { key: "load", type: "number", unit: "N", default: 0, min: -100000, max: 100000, step: 10 },
    { key: "maxPressure", type: "number", unit: "bar", default: d.maxPressure, min: 1, max: 400 },
  ];
  if (spec.singleActing) params.push({ key: "springForce", type: "number", unit: "N", default: 30, min: 0, max: 5000 });
  if (variant === "cushioned") params.push({ key: "cushioning", type: "number", unit: "%", default: 50, min: 0, max: 100 });
  // No óleo a massa da carga importa mais (forças grandes, peças pesadas).
  if (spec.domain === "hydraulic") params.push({ key: "mass", type: "number", unit: "kg", default: 20, min: 0.1, max: 100000 });

  function CylinderSymbol({ state }: SymbolProps) {
    const extension = state?.extension ?? 0;
    if (variant === "gripper") return <GripperSymbol extension={extension} />;
    const px = x0 + PISTON_X + extension * TRAVEL;
    const right = x0 + BODY_W;
    return (
      <g>
        <rect className="sym sym-bg" x={x0} y={BODY_TOP} width={BODY_W} height={BODY_H} />
        {/* êmbolo */}
        <rect className="sym-solid" x={px} y={BODY_TOP + 1} width={PISTON_W} height={BODY_H - 2} />
        {variant === "rodless" ? (
          // carro externo preso ao êmbolo (acoplamento magnético/mecânico)
          <rect className="sym sym-bg" x={px - 12} y={BODY_TOP - 8} width={28} height={8} />
        ) : (
          <rect className="sym sym-bg" x={px + PISTON_W} y={CY - 3} width={ROD_LENGTH} height={6} />
        )}
        {/* haste passante: do lado esquerdo, desenhada saindo ROD_OUT com a haste recuada */}
        {variant === "through-rod" && (
          <rect className="sym sym-bg" x={px - PISTON_X - ROD_OUT} y={CY - 3} width={PISTON_X + ROD_OUT} height={6} />
        )}
        {variant === "cushioned" && (
          <g>
            {/* buchas de amortecimento nas duas faces do êmbolo e regulagem nas tampas */}
            <rect className="sym sym-bg" x={px - 6} y={CY - 5} width={6} height={10} />
            <rect className="sym sym-bg" x={px + PISTON_W} y={CY - 5} width={6} height={10} />
            <Adjustable cx={x0 + 6} cy={BODY_TOP + 8} size={5} />
            <Adjustable cx={right - 6} cy={BODY_TOP + 8} size={5} />
          </g>
        )}
        <line className="sym" x1={right} y1={BODY_TOP} x2={right} y2={BODY_TOP + BODY_H} />
        {/* mola na câmara da haste: comprime conforme a haste avança (fica visível mesmo toda comprimida) */}
        {spec.singleActing && <Spring x1={Math.min(px + 8, right - 12)} x2={right - 4} y={CY - 9} amp={4} turns={5} />}
        {/* conectores */}
        <line className="sym" x1={x0 + 10} y1={BODY_TOP + BODY_H} x2={x0 + 10} y2={HEIGHT} />
        {spec.singleActing ? (
          // respiro do lado da mola
          <circle className="sym" cx={right - 10} cy={BODY_TOP + BODY_H} r={1.5} />
        ) : (
          <line className="sym" x1={right - 10} y1={BODY_TOP + BODY_H} x2={right - 10} y2={HEIGHT} />
        )}
      </g>
    );
  }
  CylinderSymbol.displayName = `Cylinder(${spec.type})`;

  const portA: PortDef = { id: "A", x: variant === "gripper" ? 30 : x0 + 10, y: HEIGHT, kind: spec.domain };
  const portB: PortDef = { id: "B", x: variant === "gripper" ? 90 : x0 + BODY_W - 10, y: HEIGHT, kind: spec.domain };

  return {
    type: spec.type,
    domain: spec.domain,
    category: spec.category,
    labelPrefix: "A",
    width: width(variant),
    height: HEIGHT,
    ports: spec.singleActing ? [portA] : [portA, portB],
    params,
    keywords: spec.keywords,
    sim: {
      kind: "cylinder",
      singleActing: spec.singleActing,
      throughRod: variant === "through-rod",
      cushioned: variant === "cushioned",
    },
    Symbol: CylinderSymbol,
  };
}
