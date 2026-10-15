"use client";

/**
 * Desenho do GRAFCET (IEC 60848): etapas em coluna, na ordem da lista.
 * Cada transição fica logo abaixo da sua primeira etapa de origem. Quando o destino
 * não é a etapa seguinte, uma linha de retorno sobe/desce pela esquerda até ele.
 * Divergência e convergência em E aparecem como linha dupla com a lista de etapas.
 * Na simulação, as etapas ativas ficam coloridas (com a marca de "ativa").
 */
import { parseActions, type PlcProgram } from "@/engine/logic/plc";

const SX = 120; // centro das etapas
const SW = 40;
const SH = 30;
const ROW = 86;
const TOP = 16;

export function GrafcetDiagram({ program, active }: { program: PlcProgram; active?: number[] }) {
  const steps = program.steps;
  if (steps.length === 0) return null;
  const row = new Map(steps.map((s, i) => [s.n, i]));
  const yOf = (n: number) => TOP + (row.get(n) ?? 0) * ROW;
  const height = TOP + steps.length * ROW + 10;
  const width = 460;
  let returnLane = 0;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block max-w-full" role="img" aria-label="GRAFCET">
      {steps.map((s, i) => {
        const y = yOf(s.n);
        const on = active?.includes(s.n);
        const actions = parseActions(s.actions);
        const next = steps[i + 1];
        const hasOwnTransition = program.transitions.some((t) => t.from[0] === s.n);
        return (
          <g key={`s${s.n}`}>
            <rect className={on ? "grafcet-step grafcet-step-active" : "grafcet-step"} x={SX - SW / 2} y={y} width={SW} height={SH} />
            {s.initial && <rect className="grafcet-step" fill="none" x={SX - SW / 2 + 3} y={y + 3} width={SW - 6} height={SH - 6} style={{ fill: "none" }} />}
            <text className="ladder-text" x={SX} y={y + SH / 2 + 4} textAnchor="middle" fontWeight={600}>
              {s.n}
            </text>
            {on && <circle cx={SX} cy={y + SH - 5} r={2.5} className="sym-solid" />}
            {actions.length > 0 && (
              <g>
                <path className="ladder-wire" d={`M${SX + SW / 2} ${y + SH / 2} H${SX + SW / 2 + 16}`} />
                <rect className="grafcet-step" x={SX + SW / 2 + 16} y={y + 4} width={Math.max(40, actions.length * 30 + 10)} height={SH - 8} />
                <text className="ladder-text" x={SX + SW / 2 + 22} y={y + SH / 2 + 4}>
                  {actions.map((a) => `${a.kind}${a.index}`).join("  ")}
                </text>
                {s.comment && (
                  <text className="ladder-text" x={SX + SW / 2 + 22 + Math.max(40, actions.length * 30 + 10)} y={y + SH / 2 + 4} opacity={0.7}>
                    {" "}
                    {s.comment}
                  </text>
                )}
              </g>
            )}
            {/* ligação para baixo até a etapa seguinte (se a transição estiver aqui) */}
            {hasOwnTransition && next && <path className="ladder-wire" d={`M${SX} ${y + SH} V${y + ROW}`} />}
            {hasOwnTransition && !next && <path className="ladder-wire" d={`M${SX} ${y + SH} V${y + SH + 28}`} />}
          </g>
        );
      })}
      {program.transitions.map((tr, k) => {
        const src = tr.from[0];
        if (!row.has(src)) return null;
        const y = yOf(src) + SH + 22;
        const multiFrom = tr.from.length > 1;
        const multiTo = tr.to.length > 1;
        const srcIndex = row.get(src)!;
        const linear = tr.to.length === 1 && row.get(tr.to[0]) === srcIndex + 1;
        const lane = linear ? 0 : 20 + 10 * returnLane++;
        const target = tr.to[0];
        const ty = row.has(target) ? yOf(target) : y;
        return (
          <g key={`t${k}`}>
            <path className="ladder-wire" d={`M${SX - 12} ${y} H${SX + 12}`} strokeWidth={3} />
            <text className="ladder-text" x={SX + 18} y={y + 4}>
              {tr.condition}
            </text>
            {multiFrom && (
              <text className="ladder-text" x={SX - 16} y={y - 8} textAnchor="end" opacity={0.75}>
                {tr.from.map((n) => `X${n}`).join(" · ")} =
              </text>
            )}
            {multiTo && (
              <g>
                <path className="ladder-wire" d={`M${SX - 30} ${y + 12} H${SX + 30} M${SX - 30} ${y + 15} H${SX + 30}`} />
                <text className="ladder-text" x={SX + 36} y={y + 18}>
                  → {tr.to.join(", ")}
                </text>
              </g>
            )}
            {!linear && !multiTo && row.has(target) && (
              <g>
                <path className="ladder-wire" d={`M${SX} ${y} V${y + 14} H${SX - SW / 2 - lane} V${ty - 10} H${SX} V${ty}`} />
                <path className="ladder-wire" d={`M${SX - SW / 2 - lane - 4} ${(y + ty) / 2 + 6} L${SX - SW / 2 - lane} ${(y + ty) / 2 - (ty < y ? 2 : -10)} L${SX - SW / 2 - lane + 4} ${(y + ty) / 2 + 6}`} transform={ty < y ? undefined : `rotate(180 ${SX - SW / 2 - lane} ${(y + ty) / 2})`} />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
