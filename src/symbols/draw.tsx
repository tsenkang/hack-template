/**
 * Peças de desenho reutilizadas pelos símbolos (ISO 1219 / IEC 60617).
 *
 * Todas usam as classes `.sym*` de globals.css, que pegam as cores do tema
 * (claro/escuro). Coordenadas em unidades de mundo; traço padrão 1,5.
 */

type Pt = readonly [number, number];

/** Seta com ponta cheia, de `a` até `b` (indica sentido do fluxo dentro da válvula). */
export function Arrow({ from, to, head = 5 }: { from: Pt; to: Pt; head?: number }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - head * Math.cos(ang);
  const by = y2 - head * Math.sin(ang);
  const w = head * 0.45;
  const px = -Math.sin(ang) * w;
  const py = Math.cos(ang) * w;
  return (
    <g>
      <line className="sym" x1={x1} y1={y1} x2={bx} y2={by} />
      <polygon className="sym-solid" points={`${x2},${y2} ${bx + px},${by + py} ${bx - px},${by - py}`} />
    </g>
  );
}

/** Via bloqueada (o "T" dentro do quadrado da válvula). `side` = lado do quadrado onde fica a via. */
export function Blocked({ x, y, side }: { x: number; y: number; side: "top" | "bottom" }) {
  const dir = side === "top" ? 1 : -1;
  const stem = y + dir * 7;
  return (
    <g>
      <line className="sym" x1={x} y1={y} x2={x} y2={stem} />
      <line className="sym" x1={x - 4} y1={stem} x2={x + 4} y2={stem} />
    </g>
  );
}

/** Mola em zigue-zague entre dois pontos na horizontal (y fixo). */
export function Spring({ x1, x2, y, amp = 6, turns = 4 }: { x1: number; x2: number; y: number; amp?: number; turns?: number }) {
  const n = turns * 2;
  const step = (x2 - x1) / n;
  let d = `M${x1} ${y}`;
  for (let i = 0; i < n; i++) {
    d += ` L${x1 + step * (i + 0.5)} ${y + (i % 2 === 0 ? -amp : amp)}`;
  }
  d += ` L${x2} ${y}`;
  return <path className="sym" d={d} />;
}

/** Seta diagonal de "ajustável" que atravessa um elemento (mola, estrangulamento…). */
export function Adjustable({ cx, cy, size = 12 }: { cx: number; cy: number; size?: number }) {
  return <Arrow from={[cx - size, cy + size]} to={[cx + size, cy - size]} head={4} />;
}

/** Linha tracejada (linha de comando/piloto). */
export function DashedPath({ d }: { d: string }) {
  return <path className="sym sym-dashed" d={d} />;
}

/** Ponto de ligação (bolinha cheia) onde linhas se juntam. */
export function Junction({ x, y }: { x: number; y: number }) {
  return <circle className="sym-solid" cx={x} cy={y} r={2} />;
}

/** Bola + assento em "V" da válvula de retenção. `free` = sentido do fluxo livre. */
export function CheckElement({ cx, cy, free }: { cx: number; cy: number; free: "right" | "left" }) {
  // O assento fica do lado de onde vem o fluxo livre; a bola é empurrada para longe dele.
  const s = free === "right" ? 1 : -1;
  const apex = cx - s * 9;
  const open = cx - s * 2;
  return (
    <g>
      <polyline className="sym" points={`${open},${cy - 7} ${apex},${cy} ${open},${cy + 7}`} />
      <circle className="sym sym-bg" cx={cx + s * 2} cy={cy} r={4.5} />
    </g>
  );
}
