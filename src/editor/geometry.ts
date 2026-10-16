/**
 * Geometria do editor: grade, giro/espelhamento das peças, caixas e alinhamento.
 * Funções puras (sem React), testadas em geometry.test.ts.
 */
import type { ComponentInstance, Point, Rotation } from "@/engine/core/types";
import { GRID } from "@/symbols/types";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Tamanho mínimo necessário de uma definição de peça para os cálculos de geometria. */
export interface Footprint {
  width: number;
  height: number;
}

export function snap(value: number, grid = GRID): number {
  return Math.round(value / grid) * grid;
}

/** Tamanho ocupado pela peça já girada (90° e 270° trocam largura e altura). */
export function rotatedSize(rotation: Rotation, def: Footprint): { w: number; h: number } {
  return rotation === 90 || rotation === 270 ? { w: def.height, h: def.width } : { w: def.width, h: def.height };
}

/**
 * Leva um ponto do desenho original da peça (0..width, 0..height) para o mundo.
 * Ordem: espelha na horizontal → gira no sentido horário → posiciona em (x, y).
 * (x, y) é sempre o canto superior esquerdo da peça já girada.
 */
export function localToWorld(inst: Pick<ComponentInstance, "x" | "y" | "rotation" | "mirrored">, def: Footprint, p: Point): Point {
  const { width: w, height: h } = def;
  const px = inst.mirrored ? w - p.x : p.x;
  const py = p.y;
  let rx: number;
  let ry: number;
  switch (inst.rotation) {
    case 0:
      [rx, ry] = [px, py];
      break;
    case 90:
      [rx, ry] = [h - py, px];
      break;
    case 180:
      [rx, ry] = [w - px, h - py];
      break;
    case 270:
      [rx, ry] = [py, w - px];
      break;
  }
  return { x: inst.x + rx, y: inst.y + ry };
}

/** Mesma transformação de `localToWorld`, no formato `matrix(a b c d e f)` do SVG. */
export function svgTransform(inst: Pick<ComponentInstance, "x" | "y" | "rotation" | "mirrored">, def: Footprint): string {
  const o = localToWorld(inst, def, { x: 0, y: 0 });
  const ex = localToWorld(inst, def, { x: 1, y: 0 });
  const ey = localToWorld(inst, def, { x: 0, y: 1 });
  return `matrix(${ex.x - o.x} ${ex.y - o.y} ${ey.x - o.x} ${ey.y - o.y} ${o.x} ${o.y})`;
}

export function componentBounds(inst: Pick<ComponentInstance, "x" | "y" | "rotation">, def: Footprint): Rect {
  const { w, h } = rotatedSize(inst.rotation, def);
  return { x: inst.x, y: inst.y, w, h };
}

/** Próxima rotação (+90°), mantendo o centro da peça no lugar e alinhado à grade. */
export function rotateAroundCenter(inst: ComponentInstance, def: Footprint): Pick<ComponentInstance, "x" | "y" | "rotation"> {
  const before = rotatedSize(inst.rotation, def);
  const rotation = ((inst.rotation + 90) % 360) as Rotation;
  const after = rotatedSize(rotation, def);
  const cx = inst.x + before.w / 2;
  const cy = inst.y + before.h / 2;
  return { rotation, x: snap(cx - after.w / 2), y: snap(cy - after.h / 2) };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export function unionRects(rects: Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

/** Retângulo normalizado entre dois pontos (para a seleção por arraste). */
export function rectFromPoints(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export type AlignMode = "left" | "centerH" | "right" | "top" | "centerV" | "bottom";

/** Calcula as novas posições (x, y) para alinhar as caixas. Retorna na mesma ordem. */
export function alignRects(rects: Rect[], mode: AlignMode): Point[] {
  const all = unionRects(rects);
  if (!all) return [];
  return rects.map((r) => {
    switch (mode) {
      case "left":
        return { x: all.x, y: r.y };
      case "right":
        return { x: all.x + all.w - r.w, y: r.y };
      case "centerH":
        return { x: snap(all.x + all.w / 2 - r.w / 2), y: r.y };
      case "top":
        return { x: r.x, y: all.y };
      case "bottom":
        return { x: r.x, y: all.y + all.h - r.h };
      case "centerV":
        return { x: r.x, y: snap(all.y + all.h / 2 - r.h / 2) };
    }
  });
}

/** Viewport da área de desenho: tela = mundo × zoom + deslocamento. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 6;

export function screenToWorld(v: Viewport, p: Point): Point {
  return { x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom };
}

/** Zoom mantendo fixo o ponto da tela `anchor` (normalmente o cursor). */
export function zoomAt(v: Viewport, anchor: Point, factor: number): Viewport {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * factor));
  const world = screenToWorld(v, anchor);
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}

/** Viewport que mostra o retângulo inteiro dentro de uma tela de tamanho `size`. */
export function fitRect(rect: Rect, size: { w: number; h: number }, padding = 40, maxZoom = 2): Viewport {
  const zoom = Math.min(
    maxZoom,
    Math.max(MIN_ZOOM, Math.min((size.w - 2 * padding) / Math.max(rect.w, 1), (size.h - 2 * padding) / Math.max(rect.h, 1))),
  );
  return {
    zoom,
    x: size.w / 2 - (rect.x + rect.w / 2) * zoom,
    y: size.h / 2 - (rect.y + rect.h / 2) * zoom,
  };
}
