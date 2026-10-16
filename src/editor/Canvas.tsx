"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Point } from "@/engine/core/types";
import { t } from "@/i18n";
import { selectActiveCircuit, selectViewport, useEditor } from "@/store/editor-store";
import { useUi } from "@/store/ui-store";
import { StartPanel } from "./StartPanel";
import { useSim } from "@/store/sim-store";
import { MANUAL_ACTUATORS } from "@/engine/core/sim-types";
import { getDef } from "@/symbols/registry";
import { GRID } from "@/symbols/types";
import { CanvasControls } from "./CanvasControls";
import { DiagnosticMarkers } from "./DiagnosticMarkers";
import { LadderAnnotations } from "./LadderAnnotations";
import { ComponentNode } from "./ComponentNode";
import {
  componentBounds,
  localToWorld,
  rectFromPoints,
  rectsIntersect,
  screenToWorld,
  snap,
  zoomAt,
  type Rect,
  type Viewport,
} from "./geometry";
import { routeOrthogonal, simplify } from "./routing";
import { WireView } from "./WireView";
import {
  allPorts,
  canConnect,
  hitWire,
  planInsertOnWire,
  pointsToPath,
  portInfo,
  routeAll,
  wireNets,
  type PortInfo,
} from "./wires";

/** Tipo MIME usado ao arrastar uma peça da biblioteca para o desenho. */
export const DND_MIME = "application/x-fluxolab-part";

/** Distância (em pixels da tela) para "grudar" a linha num conector. */
const PORT_SNAP_PX = 16;

type Drag =
  | { kind: "pan"; start: Point; origin: Viewport }
  | { kind: "move"; startWorld: Point; origins: Record<string, Point> }
  | { kind: "marquee"; startWorld: Point; base: string[] }
  | { kind: "wire"; from: PortInfo };

interface WirePreview {
  points: Point[];
  target: PortInfo | null;
}

const portKey = (p: { componentId: string; portId: string }) => `${p.componentId}:${p.portId}`;

/** Abaixo deste zoom os textos ficam com menos de ~4 px: são escondidos (ilegíveis e caros de desenhar). */
const LOD_TEXT_ZOOM = 0.42;

/** Área de desenho: grade, zoom, mover a tela, seleção, ligar linhas e operar peças na simulação. */
export function Canvas() {
  const svgRef = useRef<SVGSVGElement>(null);
  const circuit = useEditor(selectActiveCircuit);
  const viewport = useEditor(selectViewport);
  const selection = useEditor((s) => s.selection);
  const snapEnabled = useEditor((s) => s.snapEnabled);
  const simulating = useSim((s) => s.status !== "stopped");
  const presenting = useUi((st) => st.presenting);
  // Projeto inteiro vazio (só esta aba, sem peças): mostra a tela inicial com os caminhos.
  const onlyEmptyTab = useEditor((s) => s.project.circuits.every((c) => c.components.length === 0));
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [wirePreview, setWirePreview] = useState<WirePreview | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const drag = useRef<Drag | null>(null);
  const held = useRef<{ id: string; side: "left" | "right" } | null>(null);
  const touches = useRef(new Map<number, Point>());
  const pinch = useRef<{ dist: number; mid: Point } | null>(null);

  const selected = useMemo(() => new Set(selection), [selection]);
  const routes = useMemo(() => routeAll(circuit), [circuit]);
  const canvasSize = useEditor((s) => s.canvasSize);
  /**
   * Peças e linhas fora da área visível não acompanham a simulação (não são redesenhadas
   * a cada quadro). Com o zoom aproximado, só o que aparece na tela gasta tempo.
   */
  const visible = useMemo(() => {
    const margin = 80;
    const x0 = (-viewport.x - margin) / viewport.zoom;
    const y0 = (-viewport.y - margin) / viewport.zoom;
    const x1 = (canvasSize.w - viewport.x + margin) / viewport.zoom;
    const y1 = (canvasSize.h - viewport.y + margin) / viewport.zoom;
    const inside = (b: { x: number; y: number; w: number; h: number }) => b.x <= x1 && b.x + b.w >= x0 && b.y <= y1 && b.y + b.h >= y0;
    const ids = new Set<string>();
    for (const c of circuit.components) {
      const def = getDef(c.type);
      if (def && inside(componentBounds(c, def))) ids.add(c.id);
    }
    for (const [id, pts] of routes) {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const bx = Math.min(...xs);
      const by = Math.min(...ys);
      if (inside({ x: bx, y: by, w: Math.max(...xs) - bx, h: Math.max(...ys) - by })) ids.add(id);
    }
    return ids;
  }, [circuit, routes, viewport, canvasSize]);

  /** Conectores com linha, conectores soltos por peça, pontos de junção e linhas de piloto. */
  const topology = useMemo(() => {
    const ends = new Map<string, number>();
    for (const w of circuit.connections) {
      for (const k of [portKey(w.from), portKey(w.to)]) ends.set(k, (ends.get(k) ?? 0) + 1);
    }
    const openPorts = new Map<string, string>();
    const junctions: Point[] = [];
    const pilotWires = new Set<string>();
    const wireDomain = new Map<string, "pneumatic" | "hydraulic" | "electric">();
    for (const comp of circuit.components) {
      const def = getDef(comp.type);
      if (!def) continue;
      openPorts.set(comp.id, def.ports.filter((p) => !ends.has(`${comp.id}:${p.id}`)).map((p) => p.id).join(","));
      for (const p of def.ports) if ((ends.get(`${comp.id}:${p.id}`) ?? 0) >= 2) junctions.push(localToWorld(comp, def, p));
    }
    const kindOf = new Map<string, string>(
      circuit.components.flatMap((c) => (getDef(c.type)?.ports ?? []).map((p) => [`${c.id}:${p.id}`, p.kind] as const)),
    );
    for (const w of circuit.connections) {
      if (kindOf.get(portKey(w.from)) === "pilot" || kindOf.get(portKey(w.to)) === "pilot") pilotWires.add(w.id);
      const kind = kindOf.get(portKey(w.from));
      wireDomain.set(w.id, kind === "electric" ? "electric" : kind === "hydraulic" || kind === "hydraulic-pilot" ? "hydraulic" : "pneumatic");
      if (kind === "hydraulic-pilot" || kindOf.get(portKey(w.to)) === "hydraulic-pilot") pilotWires.add(w.id);
    }
    return { openPorts, junctions, pilotWires, wireDomain, nets: wireNets(circuit) };
  }, [circuit]);

  /** Rastro do sinal: com uma linha selecionada, destaca todas as linhas ligadas a ela. */
  const traced = useMemo(() => {
    const nets = new Set(selection.map((id) => topology.nets.get(id)).filter(Boolean));
    if (nets.size === 0) return new Set<string>();
    return new Set(circuit.connections.filter((w) => nets.has(topology.nets.get(w.id))).map((w) => w.id));
  }, [selection, topology, circuit]);

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

  /** Durante a simulação: aperta o acionamento manual mais próximo do clique. */
  const actuate = useCallback(
    (e: React.PointerEvent, id: string): boolean => {
      const s = useEditor.getState();
      const comp = selectActiveCircuit(s).components.find((c) => c.id === id);
      const def = comp && getDef(comp.type);
      if (!comp || !def?.interactive) return false;
      let side: "left" | "right" = "left";
      if (def.sim?.kind === "valve") {
        const leftManual = MANUAL_ACTUATORS.includes(def.sim.left);
        const rightManual = MANUAL_ACTUATORS.includes(def.sim.right);
        if (leftManual && rightManual) {
          const click = screenToWorld(selectViewport(s), local(e));
          const l = localToWorld(comp, def, { x: 15, y: def.height / 2 });
          const r = localToWorld(comp, def, { x: def.width - 15, y: def.height / 2 });
          side = Math.hypot(click.x - l.x, click.y - l.y) <= Math.hypot(click.x - r.x, click.y - r.y) ? "left" : "right";
        } else side = leftManual ? "left" : "right";
      } else {
        // Outras peças (ex.: seletora de 3 posições): o lado é o lado do clique.
        const click = screenToWorld(selectViewport(s), local(e));
        const b = componentBounds(comp, def);
        side = click.x < b.x + b.w / 2 ? "left" : "right";
      }
      useSim.getState().actuate(id, side, true);
      held.current = { id, side };
      return true;
    },
    [local],
  );

  const onComponentPointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      // Espaço segurado ou botão do meio: deixa o evento subir para o fundo mover a tela.
      if (spaceHeld || e.button !== 0) return;
      if (useSim.getState().status !== "stopped") {
        // Na simulação: aciona botões/alavancas; nas outras peças, só seleciona (para ajustar parâmetros).
        e.stopPropagation();
        svgRef.current?.setPointerCapture(e.pointerId);
        if (!actuate(e, id)) useEditor.getState().select([id]);
        return;
      }
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
    [local, spaceHeld, actuate],
  );

  const onPortPointerDown = useCallback(
    (e: React.PointerEvent, componentId: string, portId: string) => {
      if (spaceHeld || e.button !== 0) return;
      const comp = selectActiveCircuit(useEditor.getState()).components.find((c) => c.id === componentId);
      const from = comp && portInfo(comp, portId);
      if (!from) return;
      e.stopPropagation();
      svgRef.current?.setPointerCapture(e.pointerId);
      drag.current = { kind: "wire", from };
      setWirePreview({ points: [from.pos, from.pos], target: null });
    },
    [spaceHeld],
  );

  const onWirePointerDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (spaceHeld || e.button !== 0 || useSim.getState().status !== "stopped") return;
      e.stopPropagation();
      const s = useEditor.getState();
      if (e.shiftKey || e.ctrlKey || e.metaKey) s.toggleSelected(id);
      else s.select([id]);
    },
    [spaceHeld],
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
    // Botão do meio, espaço segurado, um dedo no vazio ou simulação rodando = mover a tela.
    if (simulating) useEditor.getState().select([]);
    if (e.button === 1 || spaceHeld || e.pointerType === "touch" || simulating) {
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

  /** Conector compatível mais próximo do ponto (para "grudar" a linha). */
  const nearestPort = (world: Point, from: PortInfo): PortInfo | null => {
    const s = useEditor.getState();
    const radius = PORT_SNAP_PX / selectViewport(s).zoom;
    let best: PortInfo | null = null;
    let bestDist = radius;
    for (const p of allPorts(selectActiveCircuit(s))) {
      if (p.ref.componentId === from.ref.componentId && p.ref.portId === from.ref.portId) continue;
      if (!canConnect(from.kind, p.kind)) continue;
      const d = Math.hypot(p.pos.x - world.x, p.pos.y - world.y);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
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
    } else if (d.kind === "wire") {
      const w = screenToWorld(selectViewport(s), p);
      const target = nearestPort(w, d.from);
      const obstacles = selectActiveCircuit(s).components.flatMap((c) => {
        const def = getDef(c.type);
        return def ? [componentBounds(c, def)] : [];
      });
      const stub = {
        x: d.from.pos.x + [GRID, 0, -GRID, 0][d.from.dir],
        y: d.from.pos.y + [0, GRID, 0, -GRID][d.from.dir],
      };
      const points = target
        ? routeOrthogonal({ from: d.from.pos, fromDir: d.from.dir, to: target.pos, toDir: target.dir, obstacles })
        : simplify([d.from.pos, stub, { x: w.x, y: stub.y }, w]);
      setWirePreview({ points, target });
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
    const d = drag.current;
    if (d?.kind === "move") useEditor.getState().endGesture();
    if (d?.kind === "wire" && wirePreview?.target) useEditor.getState().addConnection(d.from.ref, wirePreview.target.ref);
    if (held.current) {
      useSim.getState().actuate(held.current.id, held.current.side, false);
      held.current = null;
    }
    drag.current = null;
    setMarquee(null);
    setWirePreview(null);
    setPanning(false);
  };

  const onDrop = (e: React.DragEvent) => {
    const type = e.dataTransfer.getData(DND_MIME);
    if (!type || simulating) return;
    e.preventDefault();
    const s = useEditor.getState();
    const world = screenToWorld(selectViewport(s), local(e));
    // Soltou em cima de uma linha: a peça entra no meio dela (a linha vira duas).
    const hit = hitWire(routes, world, 10 / selectViewport(s).zoom);
    const def = getDef(type);
    const wire = hit && circuit.connections.find((w) => w.id === hit.wireId);
    const fromComp = wire && circuit.components.find((c) => c.id === wire.from.componentId);
    const from = fromComp && portInfo(fromComp, wire.from.portId);
    const plan = hit && def && from ? planInsertOnWire(def, hit, from.pos, from.kind) : null;
    if (plan && wire) s.insertOnWire(type, plan, wire.id, plan.ports);
    else s.addComponent(type, world);
    svgRef.current?.focus();
  };

  const minor = GRID * viewport.zoom;
  const major = minor * 5;
  const cursor = panning ? "grabbing" : spaceHeld ? "grab" : "default";

  return (
    <div className={`relative h-full w-full overflow-hidden bg-canvas ${presenting ? "presenting" : ""}`}>
      <svg
        ref={svgRef}
        className={`block h-full w-full touch-none select-none outline-none ${wirePreview ? "wiring" : ""} ${simulating ? "simulating" : ""} ${viewport.zoom < LOD_TEXT_ZOOM ? "lod-low" : ""}`}
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
          if (e.dataTransfer.types.includes(DND_MIME) && !simulating) {
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
          <g className="wires">
            {circuit.connections.map((w) => {
              const points = routes.get(w.id);
              return points ? (
                <WireView
                  key={w.id}
                  id={w.id}
                  points={points}
                  selected={selected.has(w.id)}
                  traced={traced.has(w.id)}
                  pilot={topology.pilotWires.has(w.id)}
                  domain={topology.wireDomain.get(w.id) ?? "pneumatic"}
                  live={visible.has(w.id)}
                  onPointerDown={onWirePointerDown}
                />
              ) : null;
            })}
          </g>
          {circuit.components.map((comp) => (
            <ComponentNode
              key={comp.id}
              comp={comp}
              selected={selected.has(comp.id)}
              openPorts={topology.openPorts.get(comp.id) ?? ""}
              simulating={simulating}
              live={visible.has(comp.id)}
              onPointerDown={onComponentPointerDown}
              onPortPointerDown={onPortPointerDown}
            />
          ))}
          <LadderAnnotations />
          <DiagnosticMarkers />
          {topology.junctions.map((p) => (
            <circle key={`${p.x},${p.y}`} className="junction-dot" cx={p.x} cy={p.y} r={2.6} />
          ))}
          {wirePreview && (
            <g data-export-ignore>
              <path className="wire-preview" d={pointsToPath(wirePreview.points)} />
              {wirePreview.target && (
                <circle className="port-target" cx={wirePreview.target.pos.x} cy={wirePreview.target.pos.y} r={6} />
              )}
            </g>
          )}
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

      {circuit.components.length === 0 &&
        (onlyEmptyTab ? (
          <StartPanel />
        ) : (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <p className="text-lg font-medium text-fg">{t("canvas.emptyTitle")}</p>
            <p className="max-w-md text-sm text-muted">{t("canvas.emptyHint")}</p>
          </div>
        ))}

      <CanvasControls snapEnabled={snapEnabled} zoomOnly={simulating} />
    </div>
  );
}
