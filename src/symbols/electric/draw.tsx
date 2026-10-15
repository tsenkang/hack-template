/**
 * Elementos comuns dos símbolos elétricos (IEC 60617), desenhados na vertical
 * como no esquema em escada: terminal de cima em (20,0) e de baixo em (20,60).
 */

export const ELEC_W = 40;
export const ELEC_H = 60;

/**
 * Contato com lâmina articulada no terminal de baixo.
 * `normally` = estado em repouso; `closed` = estado agora (na simulação).
 */
export function Contact({ normally, closed }: { normally: "open" | "closed"; closed?: boolean }) {
  const isClosed = closed ?? normally === "closed";
  return (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={20} />
      {normally === "closed" && <line className="sym" x1={20} y1={20} x2={28} y2={20} />}
      <line className="sym" x1={20} y1={40} x2={20} y2={60} />
      {isClosed ? (
        <line className={normally === "closed" ? "sym" : "sym sym-active"} x1={20} y1={40} x2={normally === "closed" ? 30 : 21} y2={normally === "closed" ? 17 : 20} />
      ) : (
        <line className={normally === "closed" ? "sym sym-active" : "sym"} x1={20} y1={40} x2={10} y2={21} />
      )}
    </g>
  );
}

/** Acionamento por botão (pulsador) ligado ao contato por linha tracejada. */
export function PushOperator({ y = 30 }: { y?: number }) {
  return (
    <g>
      <line className="sym sym-dashed" x1={4} y1={y} x2={15} y2={y} />
      <path className="sym" d={`M8 ${y - 6} H4 V${y + 6} H8`} />
    </g>
  );
}

/** Trava (detente) desenhada sobre a linha de acionamento. */
export function DetentMark({ y = 30 }: { y?: number }) {
  return <path className="sym" d={`M9 ${y - 5} L11 ${y} L13 ${y - 5}`} />;
}

/** Cogumelo do botão de emergência. */
export function MushroomOperator({ y = 30 }: { y?: number }) {
  return (
    <g>
      <line className="sym sym-dashed" x1={6} y1={y} x2={15} y2={y} />
      <path className="sym sym-bg" d={`M6 ${y - 7} A7 7 0 0 0 6 ${y + 7} Z`} />
    </g>
  );
}

/** Chave seletora (manopla girante). */
export function SelectorOperator({ y = 30 }: { y?: number }) {
  return (
    <g>
      <line className="sym sym-dashed" x1={8} y1={y} x2={15} y2={y} />
      <path className="sym" d={`M2 ${y + 6} L8 ${y} L2 ${y - 6}`} />
    </g>
  );
}

/** Rolete de fim de curso mecânico. */
export function RollerOperator({ y = 30 }: { y?: number }) {
  return (
    <g>
      <line className="sym sym-dashed" x1={9} y1={y} x2={15} y2={y} />
      <circle className="sym sym-bg" cx={5} cy={y} r={4} />
    </g>
  );
}

/** Corpo de sensor sem contato (losango) com o desenho que indica o tipo. */
export function SensorOperator({ kind, y = 30 }: { kind: "inductive" | "capacitive" | "optical" | "reed"; y?: number }) {
  return (
    <g>
      <line className="sym sym-dashed" x1={12} y1={y} x2={15} y2={y} />
      <polygon className="sym sym-bg" points={`6,${y - 7} 12,${y} 6,${y + 7} 0,${y}`} />
      {kind === "inductive" && <path className="sym" d={`M3 ${y - 2} q1.5 -2 3 0 q1.5 2 3 0`} />}
      {kind === "capacitive" && <path className="sym" d={`M5 ${y - 3} V${y + 3} M7 ${y - 3} V${y + 3}`} />}
      {kind === "optical" && <path className="sym" d={`M2 ${y - 2} L8 ${y - 2} M2 ${y + 2} L8 ${y + 2}`} />}
      {kind === "reed" && <path className="sym" d={`M3 ${y} H9`} />}
    </g>
  );
}

/** Retângulo de bobina; preenchido quando energizada. */
export function CoilBox({ energized, children }: { energized?: boolean; children?: React.ReactNode }) {
  return (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={22} />
      <rect className={energized ? "sym sym-energized" : "sym sym-bg"} x={10} y={22} width={20} height={16} />
      {children}
      <line className="sym" x1={20} y1={38} x2={20} y2={60} />
    </g>
  );
}
