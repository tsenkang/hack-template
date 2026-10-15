"use client";

/**
 * Desenho de um degrau do ladder a partir da condição em texto:
 * E = contatos em série, OU = ramos em paralelo. Na simulação, contatos
 * fechados e a bobina ligada ficam coloridos.
 */
import type { ReactNode } from "react";
import { parseExpression, type Expr } from "@/engine/logic/expression";
import type { CoilKind, PlcState } from "@/engine/logic/plc";

const CW = 56; // largura de um contato
const RH = 34; // altura de uma linha
const COIL_W = 70;

interface Box {
  w: number;
  h: number;
  draw(x: number, y: number): ReactNode;
}

/** Estado de um operando (só os que o CLP mostra: I, Q, M, X). */
function bit(state: PlcState | undefined, kind: string, index: number): boolean | undefined {
  if (!state) return undefined;
  if (kind === "I") return state.inputs[index];
  if (kind === "Q") return state.outputs[index];
  if (kind === "M") return state.memories.includes(index);
  if (kind === "X") return state.steps.includes(index);
  return undefined;
}

/** Contador de chaves do React, local a cada desenho. */
interface Keys {
  n: number;
}

function layout(e: Expr, state: PlcState | undefined, k: Keys): Box {
  if (e.type === "var" || e.type === "timer" || e.type === "const") {
    const name = e.type === "var" ? `${e.kind}${e.index}` : e.type === "timer" ? `${e.seconds}s/X${e.step}` : e.value ? "1" : "0";
    const negated = e.type !== "const" && e.negated;
    const value = e.type === "var" ? bit(state, e.kind, e.index) : undefined;
    const conducts = value === undefined ? false : value !== negated;
    return {
      w: CW,
      h: RH,
      draw: (x, y) => {
        const mid = y + RH / 2 + 4;
        const cls = conducts ? "ladder-wire ladder-on" : "ladder-wire";
        return (
          <g key={k.n++}>
            <path className={cls} d={`M${x} ${mid} H${x + 20} M${x + 36} ${mid} H${x + CW}`} />
            <path className={cls} d={`M${x + 20} ${mid - 8} V${mid + 8} M${x + 36} ${mid - 8} V${mid + 8}`} />
            {negated && <path className={cls} d={`M${x + 22} ${mid + 8} L${x + 34} ${mid - 8}`} />}
            <text x={x + CW / 2} y={mid - 11} className="ladder-text" textAnchor="middle">
              {name}
            </text>
          </g>
        );
      },
    };
  }
  const items = e.items.map((x) => layout(x, state, k));
  if (e.type === "and") {
    const w = items.reduce((s, b) => s + b.w, 0);
    const h = Math.max(...items.map((b) => b.h));
    return {
      w,
      h,
      draw: (x, y) => {
        let cx = x;
        return (
          <g key={k.n++}>
            {items.map((b) => {
              const node = b.draw(cx, y);
              cx += b.w;
              return node;
            })}
          </g>
        );
      },
    };
  }
  // OU: ramos empilhados, ligados por barras verticais nas pontas.
  const inner = Math.max(...items.map((b) => b.w));
  const w = inner + 16;
  const h = items.reduce((s, b) => s + b.h, 0);
  return {
    w,
    h,
    draw: (x, y) => {
      let cy = y;
      const mids: number[] = [];
      const nodes = items.map((b) => {
        mids.push(cy + RH / 2 + 4);
        const node = (
          <g key={k.n++}>
            <path className="ladder-wire" d={`M${x} ${cy + RH / 2 + 4} H${x + 8}`} />
            {b.draw(x + 8, cy)}
            <path className="ladder-wire" d={`M${x + 8 + b.w} ${cy + RH / 2 + 4} H${x + w}`} />
          </g>
        );
        cy += b.h;
        return node;
      });
      return (
        <g key={k.n++}>
          {nodes}
          <path className="ladder-wire" d={`M${x} ${mids[0]} V${mids[mids.length - 1]} M${x + w} ${mids[0]} V${mids[mids.length - 1]}`} />
        </g>
      );
    },
  };
}

const COIL_MARK: Record<CoilKind, string> = { out: "", set: "S", reset: "R", ton: "TON", tof: "TOF", ctu: "CTU", ctr: "R" };

export function LadderRung({
  condition,
  coil,
  target,
  preset,
  state,
}: {
  condition: string;
  coil: CoilKind;
  target: string;
  preset?: number;
  state?: PlcState;
}) {
  const parsed = parseExpression(condition);
  const box = parsed.ok ? layout(parsed.expr, state, { n: 0 }) : null;
  const bodyW = box?.w ?? CW * 2;
  const h = Math.max(RH, box?.h ?? RH) + 6;
  const W = bodyW + COIL_W + 40;
  const mid = RH / 2 + 4;
  const t = /^([QM])(\d+)$/i.exec(target.trim());
  const coilOn = t ? bit(state, t[1].toUpperCase(), Number(t[2])) : undefined;
  const isBox = coil === "ton" || coil === "tof" || coil === "ctu";
  return (
    <svg width={W} height={h} viewBox={`0 0 ${W} ${h}`} className="block max-w-full" role="img" aria-label={`${condition} → ${target}`}>
      <path className="ladder-rail" d={`M2 0 V${h} M${W - 2} 0 V${h}`} />
      <path className="ladder-wire" d={`M2 ${mid} H12`} />
      {box ? box.draw(12, 0) : (
        <text x={14} y={mid + 4} className="ladder-text ladder-error">
          ?
        </text>
      )}
      <path className="ladder-wire" d={`M${12 + bodyW} ${mid} H${12 + bodyW + 14}`} />
      <g transform={`translate(${12 + bodyW + 14} 0)`}>
        {isBox ? (
          <>
            <rect className={coilOn ? "ladder-wire ladder-coil-on" : "ladder-wire"} x={0} y={mid - 12} width={COIL_W - 8} height={24} rx={2} />
            <text x={(COIL_W - 8) / 2} y={mid + 4} className="ladder-text" textAnchor="middle">
              {COIL_MARK[coil]} {target} {preset !== undefined ? `· ${preset}${coil === "ctu" ? "" : "s"}` : ""}
            </text>
          </>
        ) : (
          <>
            <path className="ladder-wire" d={`M6 ${mid - 10} Q0 ${mid} 6 ${mid + 10} M${COIL_W - 14} ${mid - 10} Q${COIL_W - 8} ${mid} ${COIL_W - 14} ${mid + 10}`} />
            {coilOn && <circle cx={(COIL_W - 8) / 2} cy={mid} r={9} className="ladder-coil-on" />}
            <text x={(COIL_W - 8) / 2} y={mid + 4} className="ladder-text" textAnchor="middle">
              {COIL_MARK[coil]}
            </text>
            <text x={(COIL_W - 8) / 2} y={mid - 13} className="ladder-text" textAnchor="middle">
              {target}
            </text>
          </>
        )}
      </g>
      <path className="ladder-wire" d={`M${12 + bodyW + 14 + COIL_W - 8} ${mid} H${W - 2}`} />
    </svg>
  );
}
