/**
 * Elementos comuns dos símbolos elétricos (IEC 60617), desenhados na vertical
 * como no esquema em escada: terminal de cima em (20,0) e de baixo em (20,60).
 */

export const ELEC_W = 40;
export const ELEC_H = 60;

/** Contato NA (aberto em repouso): a lâmina fica afastada do terminal de cima. */
export function ContactNO() {
  return (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={20} />
      <line className="sym" x1={20} y1={40} x2={20} y2={60} />
      <line className="sym" x1={20} y1={40} x2={10} y2={21} />
    </g>
  );
}

/** Contato NF (fechado em repouso): a lâmina cruza o batente do terminal de cima. */
export function ContactNC() {
  return (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={20} />
      <line className="sym" x1={20} y1={20} x2={28} y2={20} />
      <line className="sym" x1={20} y1={40} x2={20} y2={60} />
      <line className="sym" x1={20} y1={40} x2={30} y2={17} />
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
