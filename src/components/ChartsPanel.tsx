"use client";

/**
 * Gráficos ao vivo (painel de baixo): uma faixa por grandeza escolhida, com o mesmo
 * eixo de tempo — posição e velocidade dos cilindros, pressão dos manômetros,
 * vazão, rotação e tensão das cargas elétricas.
 */
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import type { Project } from "@/engine/core/types";
import { getLocale, t, tDynamic } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { motionHistory, useSim, type MeasureField } from "@/store/sim-store";
import { getDef } from "@/symbols/registry";

const LANE_H = 56;
const GAP = 12;
const LABEL_W = 92;
const TOP = 8;
const BOTTOM = 18;
const RIGHT = 12;
const WINDOW = 20;
const AUTO_MAX = 4;

interface ChartsState {
  /** null = escolha automática (cilindros e manômetros). */
  selected: string[] | null;
  toggle(key: string, current: string[]): void;
}

export const useCharts = create<ChartsState>()((set) => ({
  selected: null,
  toggle(key, current) {
    set({ selected: current.includes(key) ? current.filter((k) => k !== key) : [...current, key] });
  },
}));

interface Measure {
  key: string;
  id: string;
  field: MeasureField;
  label: string;
  quantity: string;
  unit: string;
  /** Converte o valor guardado para a unidade mostrada. */
  scale: number;
}

function describe(key: string, project: Project): Measure | null {
  const [id, field] = key.split(":") as [string, MeasureField];
  const comp = project.circuits.flatMap((c) => c.components).find((k) => k.id === id);
  if (!comp) return null;
  const def = getDef(comp.type);
  const electric = def?.domain === "electric";
  const label = comp.label || tDynamic(`parts.${comp.type}.name`);
  switch (field) {
    case "extension": {
      const stroke = typeof comp.params.stroke === "number" ? comp.params.stroke : 100;
      return { key, id, field, label, quantity: t("charts.position"), unit: "mm", scale: stroke };
    }
    case "velocity":
      return { key, id, field, label, quantity: t("charts.velocity"), unit: "m/s", scale: 1 };
    case "pressure":
      return electric
        ? { key, id, field, label, quantity: t("charts.voltage"), unit: "V", scale: 1 }
        : { key, id, field, label, quantity: t("charts.pressure"), unit: "bar", scale: 1 };
    case "flow":
      return { key, id, field, label, quantity: t("charts.flow"), unit: "l/min", scale: 1 };
    case "rpm":
      return { key, id, field, label, quantity: t("charts.rpm"), unit: "rpm", scale: 1 };
  }
  return null;
}

/** Escala "redonda" para o eixo. */
function niceRange(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  let lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (hi - lo < 1e-6) hi = lo + 1;
  const span = hi - lo;
  const step = 10 ** Math.floor(Math.log10(span));
  const unit = span / step > 5 ? step : span / step > 2 ? step / 2 : step / 5;
  lo = Math.floor(lo / unit) * unit;
  hi = Math.ceil(hi / unit) * unit;
  return [lo, hi];
}

const fmt = (v: number) => v.toLocaleString(getLocale(), { maximumFractionDigits: Math.abs(v) < 10 ? 2 : 0 });

export function ChartsPanel() {
  const version = useSim((s) => s.historyVersion);
  const simulating = useSim((s) => s.status !== "stopped");
  const project = useEditor((s) => s.project);
  const chosen = useCharts((s) => s.selected);
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

  const available = useMemo(() => {
    void version;
    return Object.keys(motionHistory.measures)
      .map((k) => describe(k, project))
      .filter((m): m is Measure => m !== null);
  }, [version, project]);

  const auto = useMemo(
    () => available.filter((m) => m.field === "extension" || (m.field === "pressure" && m.unit === "bar") || m.field === "rpm").slice(0, AUTO_MAX).map((m) => m.key),
    [available],
  );
  const selected = chosen ?? auto;

  const data = useMemo(() => {
    void version;
    const tt = motionHistory.t;
    const end = tt[tt.length - 1] ?? 0;
    const start = Math.max(0, end - WINDOW);
    const first = Math.max(0, tt.findIndex((v) => v >= start));
    const time = tt.slice(first);
    const lanes = selected
      .map((k) => available.find((m) => m.key === k))
      .filter((m): m is Measure => !!m)
      .map((m) => {
        const values = (motionHistory.measures[m.key] ?? []).slice(first).map((v) => v * m.scale);
        const [lo, hi] = niceRange(Math.min(...values), Math.max(...values));
        return { m, values, lo, hi };
      });
    return { time, lanes, start, end: Math.max(end, start + 1) };
  }, [version, selected, available]);

  if (!simulating && available.length === 0) {
    return (
      <div ref={ref}>
        <p className="text-muted">{t("charts.empty")}</p>
      </div>
    );
  }

  const plotW = Math.max(100, width - LABEL_W - RIGHT - 210);
  const height = TOP + data.lanes.length * (LANE_H + GAP) + BOTTOM;
  const x = (time: number) => LABEL_W + ((time - data.start) / (data.end - data.start)) * plotW;
  const y = (lane: number, v: number, lo: number, hi: number) => TOP + lane * (LANE_H + GAP) + (1 - (v - lo) / (hi - lo)) * LANE_H;
  const span = data.end - data.start;
  const tickStep = span > 10 ? 2 : span > 4 ? 1 : 0.5;
  const ticks: number[] = [];
  for (let v = Math.ceil(data.start / tickStep) * tickStep; v <= data.end + 1e-9; v += tickStep) ticks.push(v);
  const hoverIndex =
    hover === null || data.time.length === 0
      ? null
      : data.time.reduce((best, v, i) => (Math.abs(v - hover) < Math.abs(data.time[best] - hover) ? i : best), 0);

  return (
    <div ref={ref} className="flex gap-3" data-testid="charts">
      <fieldset className="w-48 shrink-0 space-y-0.5 text-xs" aria-label={t("charts.pick")}>
        <legend className="mb-1 font-semibold text-muted">{t("charts.pick")}</legend>
        {available.map((m) => (
          <label key={m.key} className="flex cursor-pointer items-center gap-1.5 rounded px-1 hover:bg-hover">
            <input type="checkbox" checked={selected.includes(m.key)} onChange={() => useCharts.getState().toggle(m.key, selected)} />
            <span className="truncate">
              <span className="font-semibold">{m.label}</span> · {m.quantity}
            </span>
          </label>
        ))}
      </fieldset>
      <div className="relative min-w-0 flex-1">
        {data.lanes.length === 0 ? (
          <p className="text-muted">{t("charts.none")}</p>
        ) : (
          <svg
            width={LABEL_W + plotW + RIGHT}
            height={height}
            role="img"
            aria-label={t("charts.aria")}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - r.left;
              setHover(px < LABEL_W ? null : data.start + ((px - LABEL_W) / plotW) * span);
            }}
            onPointerLeave={() => setHover(null)}
          >
            {data.lanes.map(({ m, values, lo, hi }, r) => {
              const d = values.map((v, i) => `${i ? "L" : "M"}${x(data.time[i]).toFixed(1)} ${y(r, v, lo, hi).toFixed(1)}`).join(" ");
              const current = values[values.length - 1];
              return (
                <g key={m.key}>
                  <text className="chart-label" x={4} y={y(r, hi, lo, hi) + 10} fontSize={11} fontWeight={600}>
                    {m.label}
                  </text>
                  <text className="chart-text" x={4} y={y(r, hi, lo, hi) + 22} fontSize={9}>
                    {m.quantity} [{m.unit}]
                  </text>
                  {current !== undefined && (
                    <text className="chart-label" x={4} y={y(r, hi, lo, hi) + 36} fontSize={11}>
                      {fmt(current)}
                    </text>
                  )}
                  <text className="chart-text" x={LABEL_W - 4} y={y(r, hi, lo, hi) + 8} fontSize={9} textAnchor="end">
                    {fmt(hi)}
                  </text>
                  <text className="chart-text" x={LABEL_W - 4} y={y(r, lo, lo, hi)} fontSize={9} textAnchor="end">
                    {fmt(lo)}
                  </text>
                  <rect className="chart-grid" fill="none" x={LABEL_W} y={y(r, hi, lo, hi)} width={plotW} height={LANE_H} />
                  {lo < 0 && hi > 0 && <line className="chart-grid" x1={LABEL_W} x2={LABEL_W + plotW} y1={y(r, 0, lo, hi)} y2={y(r, 0, lo, hi)} strokeDasharray="3 3" />}
                  <path className={clsx("chart-line", `chart-series-${r % 4}`)} d={d} />
                </g>
              );
            })}
            {ticks.map((v) => (
              <text key={v} className="chart-text" x={x(v)} y={height - 4} fontSize={9} textAnchor="middle">
                {v.toLocaleString(getLocale())} s
              </text>
            ))}
            {hoverIndex !== null && (
              <line className="chart-crosshair" x1={x(data.time[hoverIndex])} x2={x(data.time[hoverIndex])} y1={TOP} y2={height - BOTTOM} />
            )}
          </svg>
        )}
        {hoverIndex !== null && data.lanes.length > 0 && (
          <div
            className="pointer-events-none absolute top-1 rounded-md border border-line bg-panel px-2 py-1 text-xs shadow"
            style={{ left: Math.min(x(data.time[hoverIndex]) + 8, LABEL_W + plotW - 150) }}
          >
            <div className="text-muted tabular-nums">t = {fmt(data.time[hoverIndex])} s</div>
            {data.lanes.map(({ m, values }) => (
              <div key={m.key} className="tabular-nums">
                <span className="font-semibold">{m.label}</span> {m.quantity}: {fmt(values[hoverIndex] ?? 0)} {m.unit}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
