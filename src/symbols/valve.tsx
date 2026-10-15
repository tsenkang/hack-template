/**
 * Gerador de válvulas direcionais (2/2, 3/2, 4/2, 5/2, 5/3…).
 *
 * Uma válvula é descrita só por dados: os quadrados (posições), para onde o
 * fluido vai em cada um, quais vias ficam bloqueadas e o acionamento de cada lado.
 */
import { MANUAL_ACTUATORS, POSITION_ACTUATORS, type Actuator } from "@/engine/core/sim-types";
import type { Domain } from "@/engine/core/types";
import type { CategoryId } from "./categories";
import { Adjustable, Arrow, Blocked, Spring } from "./draw";
import type { ComponentDef, ParamDef, PortDef, SymbolProps } from "./types";

/** Lado do quadrado: 40 × 40 unidades. */
export const VALVE_SQUARE = 40;
/** Borda superior do corpo (os 10 de cima e de baixo são as pontas dos conectores). */
const TOP = 10;
const HEIGHT = VALVE_SQUARE + 2 * TOP;
const CY = TOP + VALVE_SQUARE / 2;

export type { Actuator };

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
  /** 3 posições centrada por molas: desenha uma mola por fora de cada acionamento. */
  springCentered?: boolean;
  /** Mola com regulagem (válvula de sequência): pressão de comutação ajustável. */
  adjustableSpring?: boolean;
  keywords?: string[];
}

const VALVE_PARAMS: ParamDef[] = [
  { key: "switchTime", type: "number", unit: "ms", default: 20, min: 1, max: 500 },
  { key: "nominalFlow", type: "number", unit: "l/min", default: 500, min: 10, max: 5000, step: 10 },
];

/** Válvulas acionadas pela haste: qual cilindro e em que ponto do curso. */
const POSITION_PARAMS: ParamDef[] = [
  { key: "cylinder", type: "text", default: "A1" },
  { key: "position", type: "number", unit: "%", default: 100, min: 0, max: 100 },
];

/** Rolete escamoteável: em qual sentido da haste ele aciona. */
const DIRECTION_PARAM: ParamDef = { key: "direction", type: "select", default: "advance", options: ["advance", "return"] };

/** Válvula de sequência: pressão no piloto que faz a válvula comutar. */
const SWITCH_PRESSURE_PARAM: ParamDef = {
  key: "switchPressure",
  type: "number",
  unit: "bar",
  default: 4,
  min: 0.5,
  max: 10,
  step: 0.1,
};

/** Largura reservada para o acionamento de cada lado. */
const actuatorWidth = (spec: ValveSpec) => (spec.springCentered ? 50 : 30);

/** Desenho do acionamento, com a borda do corpo em x=0 e crescendo para x negativo. */
function ActuatorGlyph({ kind, domain, reach }: { kind: Actuator; domain: ValveSpec["domain"]; reach: number }) {
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
    case "pedal":
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-10} y2={0} />
          <path className="sym" d="M-4 8 L-24 -6" />
          <circle className="sym-solid" cx={-10} cy={4} r={1.6} />
        </g>
      );
    case "pilot":
      return (
        <g>
          <polygon className={domain === "hydraulic" ? "sym sym-solid" : "sym sym-bg"} points="-2,0 -12,-6 -12,6" />
          <line className="sym sym-dashed" x1={-12} y1={0} x2={-reach} y2={0} />
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
    case "roller-oneway":
      // rolete na ponta de uma alavanca articulada: só "pega" num sentido
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-12} y2={0} />
          <line className="sym" x1={-12} y1={0} x2={-18} y2={-7} />
          <circle className="sym-solid" cx={-12} cy={0} r={1.5} />
          <circle className="sym sym-bg" cx={-21} cy={-10} r={4.5} />
        </g>
      );
    case "proximity":
      // sensor sem contato: losango com a face sensora
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-8} y2={0} />
          <polygon className="sym sym-bg" points="-8,0 -16,-8 -24,0 -16,8" />
          <line className="sym" x1={-26} y1={-8} x2={-26} y2={8} />
        </g>
      );
    case "lever":
    case "lever-detent":
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-10} y2={0} />
          <line className="sym" x1={-10} y1={0} x2={-22} y2={-12} />
          <circle className="sym-solid" cx={-22} cy={-12} r={2.5} />
        </g>
      );
    case "detent":
      // trava: haste com entalhes e o pino que encaixa
      return (
        <g>
          <line className="sym" x1={0} y1={0} x2={-22} y2={0} />
          <path className="sym" d="M-8 0 L-11 -4 L-14 0 L-17 -4 L-20 0" />
          <line className="sym" x1={-14} y1={-11} x2={-14} y2={-5} />
        </g>
      );
  }
}

/** Acionamento completo de um lado: o próprio acionamento e, se centrada por molas, a mola por fora. */
function SideActuator({ spec, side, reach }: { spec: ValveSpec; side: "left" | "right"; reach: number }) {
  const kind = spec[side];
  return (
    <g>
      <ActuatorGlyph kind={kind} domain={spec.domain} reach={reach} />
      {spec.springCentered && kind !== "spring" && <Spring x1={-22} x2={-46} y={0} amp={6} turns={3} />}
      {spec.adjustableSpring && kind === "spring" && <Adjustable cx={-13} cy={0} size={10} />}
    </g>
  );
}

/** Cria a definição completa de uma válvula a partir da especificação. */
export function makeValveDef(spec: ValveSpec): ComponentDef {
  const act = actuatorWidth(spec);
  const n = spec.squares.length;
  const width = act + n * VALVE_SQUARE + act;
  const restX = act + spec.restIndex * VALVE_SQUARE;
  const portById = new Map(spec.ports.map((p) => [p.id, p]));

  const ports: PortDef[] = spec.ports.map((p) => ({
    id: p.id,
    x: restX + p.x,
    y: p.side === "top" ? 0 : HEIGHT,
    kind: spec.domain,
    // Na pneumática, 3 e 5 são escapes: podem ficar soltos (o ar sai pela própria válvula).
    exhaust: spec.domain === "pneumatic" && (p.id === "3" || p.id === "5"),
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

  function ValveSymbol({ params, state }: SymbolProps) {
    // O corpo desliza para que o quadrado ativo fique sob os conectores (como no FluidSIM).
    const bodyShift = (spec.restIndex - (state?.spool ?? spec.restIndex)) * VALVE_SQUARE;
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
            const sx = act + i * VALVE_SQUARE;
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
          <g transform={`translate(${act} ${CY})`}>
            <SideActuator spec={spec} side="left" reach={act} />
          </g>
          {/* rótulo do solenoide (Y1…) acima da bobina */}
          {spec.left === "solenoid" && (
            <text className="sym-text" x={act - 11} y={TOP - 1} fontSize={8} textAnchor="middle">
              {String(params.solenoidLeft ?? "")}
            </text>
          )}
          {spec.right === "solenoid" && (
            <text className="sym-text" x={act + n * VALVE_SQUARE + 11} y={TOP - 1} fontSize={8} textAnchor="middle">
              {String(params.solenoidRight ?? "")}
            </text>
          )}
          <g transform={`translate(${act + n * VALVE_SQUARE} ${CY}) scale(-1 1)`}>
            <SideActuator spec={spec} side="right" reach={act} />
          </g>
        </g>
        {/* Conector de piloto é fixo; quando o corpo desliza, a linha de comando "estica" até ele. */}
        {bodyShift !== 0 && spec.left === "pilot" && <line className="sym sym-dashed" x1={0} y1={CY} x2={bodyShift} y2={CY} />}
        {bodyShift !== 0 && spec.right === "pilot" && (
          <line className="sym sym-dashed" x1={width} y1={CY} x2={width + bodyShift} y2={CY} />
        )}
      </g>
    );
  }
  ValveSymbol.displayName = `Valve(${spec.type})`;

  const sides = [spec.left, spec.right];
  const params = [...VALVE_PARAMS];
  // Solenoides: rótulo que liga a válvula à bobina do circuito elétrico (Y1, Y2…).
  if (spec.left === "solenoid") params.push({ key: "solenoidLeft", type: "text", default: "Y1", autoLabel: "Y" });
  if (spec.right === "solenoid") params.push({ key: "solenoidRight", type: "text", default: "Y2", autoLabel: "Y" });
  if (sides.some((s) => POSITION_ACTUATORS.includes(s))) params.push(...POSITION_PARAMS);
  if (sides.includes("roller-oneway")) params.push(DIRECTION_PARAM);
  if (spec.adjustableSpring) params.push(SWITCH_PRESSURE_PARAM);

  return {
    type: spec.type,
    domain: spec.domain,
    category: spec.category,
    labelPrefix: "V",
    width,
    height: HEIGHT,
    ports,
    params,
    keywords: spec.keywords,
    interactive: sides.some((s) => MANUAL_ACTUATORS.includes(s)),
    sim: {
      kind: "valve",
      squares: spec.squares,
      restIndex: spec.restIndex,
      left: spec.left,
      right: spec.right,
      pilotIds: spec.pilotIds,
      springCentered: spec.springCentered,
    },
    Symbol: ValveSymbol,
  };
}
