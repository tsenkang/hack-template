/**
 * Temporizadores e contador pneumáticos. Os dois têm uma pequena válvula 3/2 NF
 * de saída (1 → 2 quando comuta), desenhada dentro do contorno tracejado.
 */
import { Adjustable, Arrow, Blocked, CheckElement, Junction, Spring } from "../draw";
import type { ComponentDef, SymbolProps } from "../types";

/**
 * Válvula 3/2 NF de saída, pilotada pela esquerda. Quadrados de 30: o de repouso fica
 * sob os conectores (x = 100..130: 2 em cima em 110; 1 em 110 e 3 em 120 embaixo).
 * Ao comutar, o corpo desliza 30 para a direita, como nas outras válvulas.
 * `pilotFrom` = de onde sai a linha de comando tracejada (ponta fixa).
 */
function OutputValve({ position, pilotFrom }: { position: number; pilotFrom: number }) {
  const top = 25;
  const bottom = 55;
  const shift = position * 30;
  return (
    <g>
      <path className="sym" d={`M110 0 V${top} M110 ${bottom} V80 M120 ${bottom} V80`} />
      <line className="sym sym-dashed" x1={pilotFrom} y1={40} x2={60 + shift} y2={40} />
      <g transform={`translate(${shift} 0)`}>
        <polygon className="sym sym-bg" points="68,40 60,35 60,45" />
        {/* quadrado acionado: 1 → 2, 3 bloqueado */}
        <rect className="sym sym-bg" x={70} y={top} width={30} height={30} />
        <Arrow from={[80, bottom - 3]} to={[80, top + 3]} head={4} />
        <Blocked x={90} y={bottom} side="bottom" />
        {/* quadrado de repouso: 2 → 3, 1 bloqueado */}
        <rect className="sym sym-bg" x={100} y={top} width={30} height={30} />
        <Arrow from={[110, top + 3]} to={[120, bottom - 3]} head={4} />
        <Blocked x={110} y={bottom} side="bottom" />
        <Spring x1={130} x2={138} y={40} amp={4} turns={2} />
      </g>
    </g>
  );
}

const OUTPUT_PORTS = [
  { id: "2", x: 110, y: 0, kind: "pneumatic" },
  { id: "1", x: 110, y: 80, kind: "pneumatic" },
  { id: "3", x: 120, y: 80, kind: "pneumatic", exhaust: true },
] as const;

const TIMER_PORTS = [{ id: "12", x: 0, y: 40, kind: "pilot" }, ...OUTPUT_PORTS] as const;

function makeTimer(mode: "on-delay" | "off-delay"): ComponentDef {
  function TimerSymbol({ state }: SymbolProps) {
    const charge = state?.charge ?? 0;
    return (
      <g>
        <rect className="sym sym-dashed" x={2} y={6} width={136} height={68} />
        {/* sinal 12 → reguladora de vazão + retenção → reservatório → piloto da válvula */}
        <path className="sym" d="M0 40 H8 M8 28 V52 M8 28 H14 M26 28 H34 M8 52 H13 M27 52 H34 M34 28 V52 M34 40 H40" />
        <Junction x={8} y={40} />
        <Junction x={34} y={40} />
        <path className="sym" d="M14 22 Q20 28 14 34 M26 22 Q20 28 26 34" />
        <Adjustable cx={20} cy={28} size={8} />
        <CheckElement cx={20} cy={52} free={mode === "on-delay" ? "left" : "right"} />
        {/* reservatório: o nível mostra a carga */}
        <rect className="sym sym-bg" x={40} y={32} width={14} height={16} />
        {charge > 0 && <rect className="sym-solid" opacity={0.35} x={40} y={48 - 16 * charge} width={14} height={16 * charge} />}
        <OutputValve position={state?.spool ?? 0} pilotFrom={54} />
      </g>
    );
  }
  TimerSymbol.displayName = `Timer(${mode})`;
  return {
    type: mode === "on-delay" ? "pneu.timer.on-delay" : "pneu.timer.off-delay",
    domain: "pneumatic",
    category: "pneu-signal",
    labelPrefix: "V",
    width: 140,
    height: 80,
    ports: [...TIMER_PORTS],
    params: [{ key: "delay", type: "number", unit: "s", default: 3, min: 0.1, max: 60, step: 0.1 }],
    keywords: ["temporizador", "tempo", "retardo", "atraso", mode === "on-delay" ? "ligação" : "desligamento"],
    sim: { kind: "timer", mode },
    Symbol: TimerSymbol,
  };
}

/** Temporizador com retardo na ligação: a saída abre `delay` segundos depois do sinal em 12. */
export const timerOnDelay = makeTimer("on-delay");
/** Temporizador com retardo no desligamento: a saída fecha `delay` segundos depois que o sinal some. */
export const timerOffDelay = makeTimer("off-delay");

function CounterSymbol({ params, state }: SymbolProps) {
  const preset = typeof params.preset === "number" ? params.preset : 5;
  return (
    <g>
      <rect className="sym sym-dashed" x={2} y={6} width={136} height={68} />
      <path className="sym sym-dashed" d="M0 30 H10 M0 50 H10" />
      <rect className="sym sym-bg" x={10} y={22} width={44} height={36} />
      <text className="sym-text" x={32} y={38} fontSize={11} textAnchor="middle" fontWeight={600}>
        {state?.count ?? 0}/{preset}
      </text>
      <text className="sym-text" x={14} y={33} fontSize={6}>12</text>
      <text className="sym-text" x={14} y={55} fontSize={6}>10</text>
      <OutputValve position={state?.spool ?? 0} pilotFrom={54} />
    </g>
  );
}

/** Contador pneumático: conta pulsos em 12; ao chegar no valor ajustado, abre 1 → 2 até ser zerado em 10. */
export const pneuCounter: ComponentDef = {
  type: "pneu.counter",
  domain: "pneumatic",
  category: "pneu-signal",
  labelPrefix: "C",
  width: 140,
  height: 80,
  ports: [{ id: "12", x: 0, y: 30, kind: "pilot" }, { id: "10", x: 0, y: 50, kind: "pilot" }, ...OUTPUT_PORTS],
  params: [{ key: "preset", type: "number", default: 5, min: 1, max: 9999 }],
  keywords: ["contador", "contagem", "ciclos", "peças"],
  interactive: true,
  sim: { kind: "counter" },
  Symbol: CounterSymbol,
};
