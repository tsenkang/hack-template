"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "@/engine/core/types";
import { t } from "@/i18n";
import { selectActiveCircuit, selectViewport, useEditor } from "@/store/editor-store";
import { getDef } from "@/symbols/registry";
import { GRID } from "@/symbols/types";
import { CanvasControls } from "./CanvasControls";
import { ComponentNode } from "./ComponentNode";
import {
  componentBounds,
  rectFromPoints,
  rectsIntersect,
  screenToWorld,
  snap,
  zoomAt,
  type Rect,
  type Viewport,
} from "./geometry";

/** Tipo MIME usado ao arrastar uma peça da biblioteca para o desenho. */
export const DND_MIME = "application/x-fluxolab-part";

type Drag =
  | { kind: "pan"; start: Point; origin: Viewport }
  | { kind: "move"; startWorld: Point; origins: Record<string, Point> }
  | { kind: "marquee"; startWorld: Point; base: string[] };

/** Área de desenho: grade, zoom, mover a tela, seleção, arrastar peças e soltar da biblioteca. */
export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const circuit = useEditor(selectActiveCircuit);
  const viewport = useEditor(selectViewport);
  const selection = useEditor((s) => s.selection);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const drag = useRef<Drag | null>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);

  const selected = useMemo(() => new Set(selection), [selection]);

  /** Ponto do evento em coordenadas da tela do SVG. */
  const local = useCallback((e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  // Tamanho da área de desenho (usado para "ver tudo" e para inserir no centro).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      useEditor.getState().setCanvasSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Roda do mouse = zoom no cursor (listener não-passivo para poder bloquear a rolagem da página).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useEditor.getState();
      const v = selectViewport(s);
      if (e.shiftKey) {
        s.setViewport({ ...v, x: v.x - e.deltaY, y: v.y - e.deltaX });
        return;
      }
      s.setViewport(zoomAt(v, local(e), Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [local]);

  // Barra de espaço segurada = modo "mão" para mover a tela.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => (e.target as HTMLElement)?.closest?.("input, textarea, select, [contenteditable]");
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !typing(e)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => e.code === "Space" && setSpaceHeld(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const startPan = (e: React.PointerEvent) => {
    drag.current = { kind: "pan", start: local(e), origin: selectViewport(useEditor.getState()) };
    setPanning(true);
  };

  const onComponentPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      // Espaço segurado ou botão do meio: deixa o evento subir para o fundo mover a tela.
      if (spaceHeld || e.button !== 0) return;
      e.stopPropagation();
      svgRef.current?.setPointerCapture(e.pointerId);
      const s = useEditor.getState();
      let ids = s.selection;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        s.toggleSelected(id);
        return;
      }
      if (!ids.includes(id)) {
        ids = [id];
        s.select(ids);
      }
      const comps = selectActiveCircuit(s).components.filter((c) => ids.includes(c.id));
      s.beginGesture();
      drag.current = {
        kind: "move",
        startWorld: screenToWorld(selectViewport(s), local(e)),
        origins: Object.fromEntries(comps.map((c) => [c.id, { x: c.x, y: c.y }])),
      };
    },
    [local, spaceHeld],
  );

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    if (e.pointerType === "touch") {
      touches.current.set(e.pointerId, local(e));
      if (touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        drag.current = null;
        return;
      }
    }
    // Botão do meio, espaço segurado ou um dedo no vazio = mover a tela.
    if (e.button === 1 || spaceHeld || e.pointerType === "touch") {
      startPan(e);
      return;
    }
    if (e.button !== 0) return;
    const s = useEditor.getState();
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    if (!additive) s.select([]);
    drag.current = {
      kind: "marquee",
      startWorld: screenToWorld(selectViewport(s), local(e)),
      base: additive ? s.selection : [],
    };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const s = useEditor.getState();
    if (e.pointerType === "touch" && touches.current.has(e.pointerId)) {
      touches.current.set(e.pointerId, local(e));
      if (pinch.current && touches.current.size === 2) {
        const [a, b] = [...touches.current.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const v = selectViewport(s);
        const zoomed = zoomAt(v, mid, dist / pinch.current.dist);
        s.setViewport({ ...zoomed, x: zoomed.x + mid.x - pinch.current.mid.x, y: zoomed.y + mid.y - pinch.current.mid.y });
        pinch.current = { dist, mid };
        return;
      }
    }
    const d = drag.current;
    if (!d) return;
    const p = local(e);
    if (d.kind === "pan") {
      s.setViewport({ ...d.origin, x: d.origin.x + p.x - d.start.x, y: d.origin.y + p.y - d.start.y });
    } else if (d.kind === "move") {
      const w = screenToWorld(selectViewport(s), p);
      const round = (v: number) => (s.snapEnabled ? snap(v) : Math.round(v));
      const dx = round(w.x - d.startWorld.x);
      const dy = round(w.y - d.startWorld.y);
      s.setPositions(
        Object.fromEntries(Object.entries(d.origins).map(([id, o]) => [id, { x: o.x + dx, y: o.y + dy }])),
      );
    } else {
      const rect = rectFromPoints(d.startWorld, screenToWorld(selectViewport(s), p));
      setMarquee(rect);
      const hits = selectActiveCircuit(s)
        .components.filter((c) => {
          const def = getDef(c.type);
          return def && rectsIntersect(rect, componentBounds(c, def));
        })
        .map((c) => c.id);
      s.select([...new Set([...d.base, ...hits])]);
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    touches.current.delete(e.pointerId);
    if (touches.current.size < 2) pinch.current = null;
    if (drag.current?.kind === "move") useEditor.getState().endGesture();
    drag.current = null;
    setMarquee(null);
    setPanning(false);
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DND_MIME);
    if (!type) return;
    e.preventDefault();
    const s = useEditor.getState();
    s.addComponent(type, screenToWorld(selectViewport(s), local(e)));
    svgRef.current?.focus();
  };

  const minor = GRID * viewport.zoom;
  const major = minor * 5;
  const cursor = panning ? "grabbing" : spaceHeld ? "grab" : "default";

  return (
    <div className="relative h-full w-full overflow-hidden bg-canvas">
      <svg
        ref={svgRef}
        className="block h-full w-full touch-none select-none outline-none"
        style={{ cursor }}
        tabIndex={0}
        role="application"
        aria-label={t("canvas.ariaLabel")}
        data-testid="canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes(DND_MIME)) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={onDrop}
        onContextMenu={(e) => e.preventDefault()}
      >
        <defs>
          <pattern id="grid-minor" width={minor} height={minor} patternUnits="userSpaceOnUse" x={viewport.x} y={viewport.y}>
            <circle cx={0.5} cy={0.5} r={0.7} className="grid-dot" />
          </pattern>
          <pattern id="grid-major" width={major} height={major} patternUnits="userSpaceOnUse" x={viewport.x} y={viewport.y}>
            <path d={`M ${major} 0 L 0 0 0 ${major}`} className="grid-line" />
          </pattern>
        </defs>
        {minor >= 6 && <rect width="100%" height="100%" fill="url(#grid-minor)" />}
        <rect width="100%" height="100%" fill="url(#grid-major)" />

        <g id="circuit-content" transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
          {circuit.components.map((comp) => (
            <ComponentNode
              key={comp.id}
              comp={comp}
              selected={selected.has(comp.id)}
              onPointerDown={onComponentPointerDown}
            />
          ))}
          {marquee && (
            <rect
              className="marquee"
              data-export-ignore
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
            />
          )}
        </g>
      </svg>

      {circuit.components.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
          <p className="text-lg font-medium text-fg">{t("canvas.emptyTitle")}</p>
          <p className="max-w-md text-sm text-muted">{t("canvas.emptyHint")}</p>
        </div>
      )}

      <CanvasControls snapEnabled={snapEnabled} />
    </div>
  );
}
