"use client";

import clsx from "clsx";
import { memo } from "react";
import type { WireSimState } from "@/engine/core/sim-types";
import type { Point } from "@/engine/core/types";
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
  state?: WireSimState;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
}

/**
 * Uma linha (tubo). Na simulação a cor indica a pressão e traços animados
 * mostram para onde o ar anda. A forma da linha (espessura, tracejado) também
 * muda, para não depender só da cor.
 */
export const WireView = memo(function WireView({ id, points, selected, traced, pilot, domain, state, onPointerDown }: Props) {
  const d = pointsToPath(points);
  if (domain === "hydraulic") {
    const pressurized = state !== undefined && state.p > OIL_ON;
    const level = state ? Math.min(1, Math.max(0, state.p / OIL_FULL)) : 0;
    const duration = state ? oilDuration(state.q) : null;
    const returning = state !== undefined && !pressurized && duration !== null;
    return (
      <g data-wire-id={id} onPointerDown={(e) => onPointerDown(e, id)}>
        <path className="wire-hit" d={d} />
        {(selected || traced) && <path className={selected ? "wire-selected" : "wire-traced"} d={d} data-export-ignore />}
        <path
          className={clsx(
            "wire",
            pilot && "wire-pilot",
            state && (pressurized ? "wire-oil-pressure" : returning ? "wire-oil-return" : "wire-oil-empty"),
          )}
          style={
            pressurized ? { stroke: `color-mix(in srgb, var(--oil-pressure) ${Math.round(55 + 45 * level)}%, var(--oil-empty))` } : undefined
          }
          d={d}
        />
        {duration !== null && (
          <path className={clsx("wire-flow", state!.q < 0 && "reverse")} style={{ animationDuration: `${duration}s` }} d={d} data-export-ignore />
        )}
      </g>
    );
  }
  if (domain === "electric") {
    const live = state !== undefined && Math.abs(state.p) > LIVE_VOLTS;
    const duration = state ? currentDuration(state.q) : null;
    return (
      <g data-wire-id={id} onPointerDown={(e) => onPointerDown(e, id)}>
        <path className="wire-hit" d={d} />
        {(selected || traced) && <path className={selected ? "wire-selected" : "wire-traced"} d={d} data-export-ignore />}
        <path
          className={clsx("wire", state && (duration !== null ? "wire-current" : live ? "wire-live" : "wire-empty-elec"))}
          d={d}
        />
        {duration !== null && (
          <path
            className={clsx("wire-flow", state!.q < 0 && "reverse")}
            style={{ animationDuration: `${duration}s` }}
            d={d}
            data-export-ignore
          />
        )}
      </g>
    );
  }
  const pressurized = state !== undefined && state.p > PRESSURE_ON;
  const level = state ? Math.min(1, Math.max(0, state.p / PRESSURE_FULL)) : 0;
  const duration = state ? flowDuration(state.q) : null;
  const style = state
    ? { stroke: `color-mix(in srgb, var(--line-pressure) ${Math.round(45 + 55 * level)}%, var(--line-empty))` }
    : undefined;

  return (
    <g data-wire-id={id} onPointerDown={(e) => onPointerDown(e, id)}>
      <path className="wire-hit" d={d} />
      {(selected || traced) && <path className={selected ? "wire-selected" : "wire-traced"} d={d} data-export-ignore />}
      <path
        className={clsx(
          "wire",
          pilot && "wire-pilot",
          state && (pressurized ? "wire-pressurized" : "wire-empty"),
        )}
        style={pressurized ? style : undefined}
        d={d}
      />
      {duration !== null && (
        <path
          className={clsx("wire-flow", state!.q < 0 && "reverse")}
          style={{ animationDuration: `${duration}s` }}
          d={d}
          data-export-ignore
        />
      )}
    </g>
  );
});
