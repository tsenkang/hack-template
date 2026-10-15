/**
 * Gerador de cilindros lineares (simples e dupla ação), usado na pneumática e na hidráulica.
 * O desenho tem o corpo, o êmbolo e a haste; durante a simulação a haste acompanha `state.extension`.
 */
import type { Domain } from "@/engine/core/types";
import type { CategoryId } from "./categories";
import { Spring } from "./draw";
import type { ComponentDef, ParamDef, SymbolProps } from "./types";

const BODY_W = 120;
const BODY_TOP = 10;
const BODY_H = 30;
const CY = BODY_TOP + BODY_H / 2;
const ROD_OUT = 30;
const WIDTH = BODY_W + ROD_OUT;
const HEIGHT = BODY_TOP + BODY_H + 10;
const PISTON_X = 8;
/** Comprimento da haste: com o cilindro recuado, ela sai ROD_OUT para fora do corpo. */
const ROD_LENGTH = BODY_W - PISTON_X - 4 + ROD_OUT;

export interface CylinderSpec {
  type: string;
  domain: Extract<Domain, "pneumatic" | "hydraulic">;
  category: CategoryId;
  singleActing: boolean;
  defaults: { piston: number; rod: number; stroke: number; maxPressure: number };
  keywords?: string[];
}

export function makeCylinderDef(spec: CylinderSpec): ComponentDef {
  const d = spec.defaults;
  const params: ParamDef[] = [
    { key: "pistonDiameter", type: "number", unit: "mm", default: d.piston, min: 6, max: 320 },
    { key: "rodDiameter", type: "number", unit: "mm", default: d.rod, min: 3, max: 200 },
    { key: "stroke", type: "number", unit: "mm", default: d.stroke, min: 5, max: 2000, step: 5 },
    { key: "load", type: "number", unit: "N", default: 0, min: -100000, max: 100000, step: 10 },
    { key: "maxPressure", type: "number", unit: "bar", default: d.maxPressure, min: 1, max: 400 },
  ];
  if (spec.singleActing) {
    params.push({ key: "springForce", type: "number", unit: "N", default: 30, min: 0, max: 5000 });
  }

  function CylinderSymbol({ state }: SymbolProps) {
    const extension = state?.extension ?? 0;
    const travel = BODY_W - 2 * PISTON_X - 4;
    const px = PISTON_X + extension * travel;
    return (
      <g>
        <rect className="sym sym-bg" x={0} y={BODY_TOP} width={BODY_W} height={BODY_H} />
        {/* êmbolo */}
        <rect className="sym-solid" x={px} y={BODY_TOP + 1} width={4} height={BODY_H - 2} />
        {/* haste */}
        <rect className="sym sym-bg" x={px + 4} y={CY - 3} width={ROD_LENGTH} height={6} />
        <line className="sym" x1={BODY_W} y1={BODY_TOP} x2={BODY_W} y2={BODY_TOP + BODY_H} />
        {/* mola na câmara da haste: comprime conforme a haste avança (fica visível mesmo toda comprimida) */}
        {spec.singleActing && <Spring x1={Math.min(px + 8, BODY_W - 12)} x2={BODY_W - 4} y={CY - 9} amp={4} turns={5} />}
        {/* conectores */}
        <line className="sym" x1={10} y1={BODY_TOP + BODY_H} x2={10} y2={HEIGHT} />
        {spec.singleActing ? (
          // respiro do lado da mola
          <circle className="sym" cx={BODY_W - 10} cy={BODY_TOP + BODY_H} r={1.5} />
        ) : (
          <line className="sym" x1={BODY_W - 10} y1={BODY_TOP + BODY_H} x2={BODY_W - 10} y2={HEIGHT} />
        )}
      </g>
    );
  }
  CylinderSymbol.displayName = `Cylinder(${spec.type})`;

  return {
    type: spec.type,
    domain: spec.domain,
    category: spec.category,
    labelPrefix: "A",
    width: WIDTH,
    height: HEIGHT,
    ports: spec.singleActing
      ? [{ id: "A", x: 10, y: HEIGHT, kind: spec.domain }]
      : [
          { id: "A", x: 10, y: HEIGHT, kind: spec.domain },
          { id: "B", x: BODY_W - 10, y: HEIGHT, kind: spec.domain },
        ],
    params,
    keywords: spec.keywords,
    sim: spec.domain === "pneumatic" ? { kind: "cylinder", singleActing: spec.singleActing } : undefined,
    Symbol: CylinderSymbol,
  };
}
