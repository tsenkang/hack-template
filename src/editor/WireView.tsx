"use client";

import clsx from "clsx";
import { memo } from "react";
import type { WireSimState } from "@/engine/core/sim-types";
import type { Point } from "@/engine/core/types";
import { useSim } from "@/store/sim-store";
import { pointsToPath } from "./wires";

/** Pressão (bar) acima da qual a linha é considerada "com pressão". */
export const PRESSURE_ON = 0.2;
/** Pressão de referência para a cor mais forte. */
const PRESSURE_FULL = 6;

/** Óleo: "com pressão" acima disto [bar]; cor mais forte em OIL_FULL; retorno com vazão acima de OIL_RETURN_Q [l/min]. */
const OIL_ON = 5;
const OIL_FULL = 200;
const OIL_RETURN_Q = 0.2;

/** Animação do fluxo de óleo (vazões bem menores que as de ar). */
function oilDuration(qLmin: number): number | null {
  const q = Math.abs(qLmin);
  if (q < OIL_RETURN_Q) return null;
  if (q < 2) return 1.6;
  if (q < 10) return 0.9;
  if (q < 40) return 0.55;
  return 0.35;
}

/** Fio "vivo": tensão acima disto [V]; com corrente: acima disto [mA]. */
const LIVE_VOLTS = 1;
const CURRENT_MA = 1;

/** Velocidade da animação da corrente nos fios, pela intensidade [mA]. */
function currentDuration(mA: number): number | null {
  const i = Math.abs(mA);
  if (i < CURRENT_MA) return null;
  if (i < 100) return 1.2;
  if (i < 500) return 0.7;
  return 0.4;
}

/**
 * Velocidade da animação do fluxo, em faixas (só muda a animação quando muda de faixa,
 * para o movimento não "pular" a cada quadro). Retorna a duração de um ciclo em segundos.
 */
export function flowDuration(qLmin: number): number | null {
  const q = Math.abs(qLmin);
  if (q < 3) return null;
  if (q < 30) return 1.6;
  if (q < 100) return 0.9;
  if (q < 300) return 0.55;
  return 0.35;
}

interface Props {
  id: string;
  points: Point[];
  selected: boolean;
  /** Ligada à linha selecionada (rastro do sinal). */
  traced: boolean;
  /** Linha de comando (piloto): tracejada. */
  pilot: boolean;
  /** Domínio: ar, óleo ou fio elétrico (no fio, o estado é tensão em V e corrente em mA). */
  domain: "pneumatic" | "hydraulic" | "electric";
  /** Visível na tela: só então acompanha a simulação. */
  live: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
}

/** Aparência de uma linha na simulação, já reduzida ao que muda o desenho. */
interface Visual {
  /** Classe do estado (com pressão, vazia, retorno, corrente…). */
  cls: string;
  /** Intensidade da cor [%], em degraus de 5% (só ar e óleo com pressão). */
  pct: number;
  /** Duração do ciclo da animação do fluxo [s] (0 = parado). */
  dur: number;
  reverse: boolean;
}

function visualOf(domain: Props["domain"], state: WireSimState | undefined): Visual | null {
  if (!state) return null;
  const step5 = (v: number) => Math.round(v / 5) * 5;
  if (domain === "hydraulic") {
    const pressurized = state.p > OIL_ON;
    const dur = oilDuration(state.q) ?? 0;
    const level = Math.min(1, Math.max(0, state.p / OIL_FULL));
    return {
      cls: pressurized ? "wire-oil-pressure" : dur ? "wire-oil-return" : "wire-oil-empty",
      pct: pressurized ? step5(55 + 45 * level) : 0,
      dur,
      reverse: state.q < 0,
    };
  }
  if (domain === "electric") {
    const dur = currentDuration(state.q) ?? 0;
    return { cls: dur ? "wire-current" : Math.abs(state.p) > LIVE_VOLTS ? "wire-live" : "wire-empty-elec", pct: 0, dur, reverse: state.q < 0 };
  }
  const pressurized = state.p > PRESSURE_ON;
  const level = Math.min(1, Math.max(0, state.p / PRESSURE_FULL));
  return {
    cls: pressurized ? "wire-pressurized" : "wire-empty",
    pct: pressurized ? step5(45 + 55 * level) : 0,
    dur: flowDuration(state.q) ?? 0,
    reverse: state.q < 0,
  };
}

const keyOf = (v: Visual | null) => (v ? `${v.cls}|${v.pct}|${v.dur}|${v.reverse ? 1 : 0}` : "");

/**
 * Uma linha (tubo ou fio). Na simulação a cor indica a pressão (ou tensão) e traços
 * animados mostram o sentido do fluxo. A forma (espessura, tracejado) também muda,
 * para não depender só da cor.
 *
 * Desempenho: cada linha lê da simulação só a sua "aparência" resumida (texto curto);
 * ela só é redesenhada quando essa aparência muda, e não a cada quadro.
 */
export const WireView = memo(function WireView({ id, points, selected, traced, pilot, domain, live, onPointerDown }: Props) {
  const key = useSim((s) => (live ? keyOf(visualOf(domain, s.snapshot?.wires[id])) : ""));
  const d = pointsToPath(points);
  const [cls, pct, dur, reverse] = key ? key.split("|") : [];
  const color = domain === "hydraulic" ? "--oil-pressure" : "--line-pressure";
  const empty = domain === "hydraulic" ? "--oil-empty" : "--line-empty";
  const showColor = key !== "" && Number(pct) > 0;
  return (
    <g data-wire-id={id} onPointerDown={(e) => onPointerDown(e, id)}>
      <path className="wire-hit" d={d} />
      {(selected || traced) && <path className={selected ? "wire-selected" : "wire-traced"} d={d} data-export-ignore />}
      <path
        className={clsx("wire", pilot && domain !== "electric" && "wire-pilot", cls)}
        style={showColor ? { stroke: `color-mix(in srgb, var(${color}) ${pct}%, var(${empty}))` } : undefined}
        d={d}
      />
      {key !== "" && Number(dur) > 0 && (
        <path className={clsx("wire-flow", reverse === "1" && "reverse")} style={{ animationDuration: `${dur}s` }} d={d} data-export-ignore />
      )}
    </g>
  );
});
