"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLocale, t } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { motionHistory, useSim } from "@/store/sim-store";
import { stepStarts } from "./phase-steps";

const ROW_H = 34;
const ROW_GAP = 10;
const LABEL_W = 64;
const TOP = 18;
const BOTTOM = 20;
const RIGHT = 12;
/** Janela de tempo mostrada [s]: os últimos segundos da simulação. */
const WINDOW = 20;

/**
 * Diagrama de fases (trajeto-tempo) desenhado durante a simulação: uma faixa por
 * cilindro, de "recuado" (embaixo) a "avançado" (em cima), com os passos numerados.
 */
export function PhaseDiagram() {
  const version = useSim((s) => s.historyVersion);
  const project = useEditor((s) => s.project);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // `version` muda quando chegam amostras novas; o histórico em si fica fora do React.
  const data = useMemo(() => {
    void version;
    const labels = new Map(project.circuits.flatMap((c) => c.components.map((k) => [k.id, k.label || "?"] as const)));
    const ids = Object.keys(motionHistory.series).filter((id) => labels.has(id));
    const tt = motionHistory.t;
    const end = tt[tt.length - 1] ?? 0;
    const start = Math.max(0, end - WINDOW);
    const first = tt.findIndex((v) => v >= start);
    const from = first < 0 ? 0 : first;
    const time = tt.slice(from);
    const rows = ids.map((id) => ({ id, label: labels.get(id)!, values: motionHistory.series[id].slice(from) }));
    return { time, rows, start, end: Math.max(end, start + 1), steps: stepStarts(time, rows.map((r) => r.values)) };
  }, [version, project]);

  if (data.rows.length === 0) {
    return (
      <div ref={ref}>
        <p className="text-muted">{t("phases.empty")}</p>
      </div>
    );
  }

  const plotW = Math.max(100, width - LABEL_W - RIGHT);
  const height = TOP + data.rows.length * (ROW_H + ROW_GAP) + BOTTOM;
  const x = (time: number) => LABEL_W + ((time - data.start) / (data.end - data.start)) * plotW;
  const y = (row: number, v: number) => TOP + row * (ROW_H + ROW_GAP) + (1 - v) * ROW_H;
  const tickStep = data.end - data.start > 10 ? 2 : data.end - data.start > 4 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let v = Math.ceil(data.start / tickStep) * tickStep; v <= data.end; v += tickStep) ticks.push(v);

  const hoverIndex =
    hover === null ? null : data.time.reduce((best, v, i) => (Math.abs(v - hover) < Math.abs(data.time[best] - hover) ? i : best), 0);

  return (
    <div ref={ref} className="relative" data-testid="phase-diagram">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={t("phases.aria")}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const px = e.clientX - r.left;
          setHover(px < LABEL_W ? null : data.start + ((px - LABEL_W) / plotW) * (data.end - data.start));
        }}
        onPointerLeave={() => setHover(null)}
      >
        {/* passos */}
        {data.steps.map((s, i) => (
          <g key={s}>
            <line className="chart-grid" x1={x(s)} x2={x(s)} y1={TOP - 4} y2={height - BOTTOM} strokeDasharray="3 3" />
            <text className="chart-text" x={x(s) + 3} y={TOP - 6} fontSize={10}>
              {i + 1}
            </text>
          </g>
        ))}
        {data.rows.map((row, r) => {
          const d = row.values.map((v, i) => `${i ? "L" : "M"}${x(data.time[i]).toFixed(1)} ${y(r, v).toFixed(1)}`).join(" ");
          return (
            <g key={row.id}>
              <text className="chart-label" x={4} y={y(r, 0.5) + 4} fontSize={12} fontWeight={600}>
                {row.label}
              </text>
              <text className="chart-text" x={LABEL_W - 6} y={y(r, 1) + 4} fontSize={9} textAnchor="end">
                1
              </text>
              <text className="chart-text" x={LABEL_W - 6} y={y(r, 0) + 3} fontSize={9} textAnchor="end">
                0
              </text>
              <line className="chart-grid" x1={LABEL_W} x2={LABEL_W + plotW} y1={y(r, 0)} y2={y(r, 0)} />
              <line className="chart-grid" x1={LABEL_W} x2={LABEL_W + plotW} y1={y(r, 1)} y2={y(r, 1)} />
              <path className="chart-line" d={d} />
            </g>
          );
        })}
        {/* eixo do tempo */}
        {ticks.map((v) => (
          <text key={v} className="chart-text" x={x(v)} y={height - 6} fontSize={9} textAnchor="middle">
            {v.toLocaleString(getLocale())} s
          </text>
        ))}
        {hoverIndex !== null && (
          <line className="chart-crosshair" x1={x(data.time[hoverIndex])} x2={x(data.time[hoverIndex])} y1={TOP - 4} y2={height - BOTTOM} />
        )}
      </svg>
      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-md border border-line bg-panel px-2 py-1 text-xs shadow"
          style={{ left: Math.min(x(data.time[hoverIndex]) + 8, width - 140) }}
        >
          <div className="text-muted tabular-nums">
            t = {data.time[hoverIndex].toLocaleString(getLocale(), { maximumFractionDigits: 2 })} s
          </div>
          {data.rows.map((row) => (
            <div key={row.id} className="tabular-nums">
              <span className="font-semibold">{row.label}</span>: {Math.round(row.values[hoverIndex] * 100)}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
