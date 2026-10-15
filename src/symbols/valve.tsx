/**
 * Gerador de válvulas direcionais (2/2, 3/2, 4/2, 5/2, 5/3…).
 *
 * Uma válvula é descrita só por dados: os quadrados (posições), para onde o
 * fluido vai em cada um, quais vias ficam bloqueadas e o acionamento de cada lado.
 */
import type { Domain } from "@/engine/core/types";
import type { CategoryId } from "./categories";
import { Arrow, Blocked, Spring } from "./draw";
import type { ComponentDef, ParamDef, PortDef } from "./types";

/** Lado do quadrado: 40 × 40 unidades. */
export const VALVE_SQUARE = 40;
/** Espaço reservado para o acionamento em cada lado. */
const ACT = 30;
/** Borda superior do corpo (os 10 de cima e de baixo são as pontas dos conectores). */
const TOP = 10;
const HEIGHT = VALVE_SQUARE + 2 * TOP;
const CY = TOP + VALVE_SQUARE / 2;

export type Actuator = "spring" | "button" | "pilot" | "solenoid" | "roller" | "lever";

export interface ValvePort {
  id: string;
  /** Posição dentro do quadrado (0–40, múltiplo de 10). */
  x: number;
  side: "top" | "bottom";
}

export interface ValveSquare {
  /** Pares [de, para] de vias ligadas nesta posição (desenha uma seta). */
  flows: readonly (readonly [string, string])[];
  /** Vias bloqueadas nesta posição (desenha um "T"). */
  blocked: readonly string[];
}

export interface ValveSpec {
  type: string;
  domain: Extract<Domain, "pneumatic" | "hydraulic">;
  category: CategoryId;
  ports: readonly ValvePort[];
  squares: readonly ValveSquare[];
  /** Quadrado de repouso: é nele que os tubos se ligam. */
  restIndex: number;
  left: Actuator;
  right: Actuator;
  /** Nome dos conectores de pilotagem (ex.: 14 e 12), quando o acionamento é por piloto. */
  pilotIds?: { left?: string; right?: string };
  keywords?: string[];
}

const VALVE_PARAMS: ParamDef[] = [
  { key: "switchTime", type: "number", unit: "ms", default: 20, min: 1, max: 500 },
  { key: "nominalFlow", type: "number", unit: "l/min", default: 500, min: 10, max: 5000, step: 10 },
];

/** Desenho do acionamento, com a borda do corpo em x=0 e crescendo para x negativo. */
function ActuatorGlyph({ kind, domain }: { kind: Actuator; domain: ValveSpec["domain"] }) {
  switch (kind) {
    case "spring":
      return <Spring x1={0} x2={-26} y={0} amp={7} />;
    case "button":
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-16} y2={0} />
          <line className="sym" x1={-16} y1={-8} x2={-16} y2={8} />
          <path className="sym" d="M-16 -8 A8 8 0 0 0 -16 8" />
        </g>
      );
    case "pilot":
      return (
        <g>
          <polygon
            className={domain === "hydraulic" ? "sym sym-solid" : "sym sym-bg"}
            points="-2,0 -12,-6 -12,6"
          />
          <line className="sym sym-dashed" x1={-12} y1={0} x2={-ACT} y2={0} />
        </g>
      );
    case "solenoid":
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-4} y2={0} />
          <rect className="sym sym-bg" x={-18} y={-8} width={14} height={16} />
          <line className="sym" x1={-18} y1={8} x2={-4} y2={-8} />
        </g>
      );
    case "roller":
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-16} y2={0} />
          <circle className="sym sym-bg" cx={-21} cy={0} r={5} />
        </g>
      );
    case "lever":
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-10} y2={0} />
          <line className="sym" x1={-10} y1={0} x2={-22} y2={-12} />
          <circle className="sym-solid" cx={-22} cy={-12} r={2.5} />
        </g>
      );
  }
}

/** Cria a definição completa de uma válvula a partir da especificação. */
export function makeValveDef(spec: ValveSpec): ComponentDef {
  const n = spec.squares.length;
  const width = ACT + n * VALVE_SQUARE + ACT;
  const restX = ACT + spec.restIndex * VALVE_SQUARE;
  const portById = new Map(spec.ports.map((p) => [p.id, p]));

  const ports: PortDef[] = spec.ports.map((p) => ({
    id: p.id,
    x: restX + p.x,
    y: p.side === "top" ? 0 : HEIGHT,
    kind: spec.domain,
  }));
  if (spec.left === "pilot" && spec.pilotIds?.left) {
    ports.push({ id: spec.pilotIds.left, x: 0, y: CY, kind: "pilot" });
  }
  if (spec.right === "pilot" && spec.pilotIds?.right) {
    ports.push({ id: spec.pilotIds.right, x: width, y: CY, kind: "pilot" });
  }

  /** Ponto de uma via dentro do quadrado `sx` (ligeiramente para dentro da borda). */
  const at = (sx: number, id: string, inset = 3): readonly [number, number] => {
    const p = portById.get(id);
    if (!p) throw new Error(`Válvula ${spec.type}: via ${id} não existe`);
    return [sx + p.x, p.side === "top" ? TOP + inset : TOP + VALVE_SQUARE - inset];
  };

  function ValveSymbol() {
    // Fase 1: desenho estático na posição de repouso. Na Fase 2 o corpo desliza conforme o êmbolo.
    const bodyShift = 0;
    return (
      <g>
        {spec.ports.map((p) => {
          const x = restX + p.x;
          return p.side === "top" ? (
            <line key={p.id} className="sym" x1={x} y1={0} x2={x} y2={TOP} />
          ) : (
            <line key={p.id} className="sym" x1={x} y1={TOP + VALVE_SQUARE} x2={x} y2={HEIGHT} />
          );
        })}
        <g transform={`translate(${bodyShift} 0)`}>
          {spec.squares.map((sq, i) => {
            const sx = ACT + i * VALVE_SQUARE;
            return (
              <g key={i}>
                <rect className="sym sym-bg" x={sx} y={TOP} width={VALVE_SQUARE} height={VALVE_SQUARE} />
                {sq.flows.map(([a, b]) => (
                  <Arrow key={`${a}-${b}`} from={at(sx, a)} to={at(sx, b)} />
                ))}
                {sq.blocked.map((id) => {
                  const [x, y] = at(sx, id, 0);
                  return <Blocked key={id} x={x} y={y} side={portById.get(id)!.side} />;
                })}
              </g>
            );
          })}
          <g transform={`translate(${ACT} ${CY})`}>
            <ActuatorGlyph kind={spec.left} domain={spec.domain} />
          </g>
          <g transform={`translate(${ACT + n * VALVE_SQUARE} ${CY}) scale(-1 1)`}>
            <ActuatorGlyph kind={spec.right} domain={spec.domain} />
          </g>
        </g>
      </g>
    );
  }
  ValveSymbol.displayName = `Valve(${spec.type})`;

  return {
    type: spec.type,
    domain: spec.domain,
    category: spec.category,
    labelPrefix: "V",
    width,
    height: HEIGHT,
    ports,
    params: VALVE_PARAMS,
    keywords: spec.keywords,
    Symbol: ValveSymbol,
  };
}
