/**
 * Roteamento automático das linhas: caminho só com segmentos horizontais e
 * verticais (90°), desviando das peças, com poucas curvas.
 *
 * Busca A* numa grade de 10 em 10 unidades. O estado inclui a direção de
 * chegada, para penalizar cada curva e preferir traçados "limpos".
 */
import type { Point } from "@/engine/core/types";
import { GRID } from "@/symbols/types";
import type { Rect } from "./geometry";

export type Dir = 0 | 1 | 2 | 3; // 0 = direita, 1 = baixo, 2 = esquerda, 3 = cima
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const BEND_COST = 4;
const STUB = GRID;

/** Direção em que a linha sai de um conector, conforme o lado da peça em que ele fica. */
export function portExitDir(port: Point, bounds: Rect): Dir {
  const dTop = Math.abs(port.y - bounds.y);
  const dBottom = Math.abs(port.y - (bounds.y + bounds.h));
  const dLeft = Math.abs(port.x - bounds.x);
  const dRight = Math.abs(port.x - (bounds.x + bounds.w));
  const min = Math.min(dTop, dBottom, dLeft, dRight);
  if (min === dTop) return 3;
  if (min === dBottom) return 1;
  if (min === dLeft) return 2;
  return 0;
}

class MinHeap {
  private items: { f: number; k: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(f: number, k: number) {
    const a = this.items;
    a.push({ f, k });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].f <= a[i].f) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items;
    const top = a[0].k;
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

/** Remove pontos intermediários alinhados, deixando só as quinas. */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    if (out.length && out[out.length - 1].x === p.x && out[out.length - 1].y === p.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = out[out.length - 1];
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) out.pop();
    }
    out.push(p);
  }
  return out;
}

/** Traçado simples em "L" (usado quando a busca não acha caminho livre). */
function fallback(a: Point, b: Point): Point[] {
  return simplify([a, { x: b.x, y: a.y }, b]);
}

interface RouteInput {
  from: Point;
  fromDir: Dir;
  to: Point;
  toDir: Dir;
  obstacles: Rect[];
}

function search({ from, fromDir, to, toDir, obstacles }: RouteInput, margin: number): Point[] | null {
  const start = { x: from.x + DX[fromDir] * STUB, y: from.y + DY[fromDir] * STUB };
  const goal = { x: to.x + DX[toDir] * STUB, y: to.y + DY[toDir] * STUB };

  const minX = Math.min(start.x, goal.x) - margin;
  const minY = Math.min(start.y, goal.y) - margin;
  const cols = Math.round((Math.max(start.x, goal.x) + margin - minX) / GRID) + 1;
  const rows = Math.round((Math.max(start.y, goal.y) + margin - minY) / GRID) + 1;
  const cells = cols * rows;
  if (cells > 60_000) return null;

  // Células ocupadas por peças (incluindo a borda, para a linha não "colar" no símbolo).
  const blocked = new Uint8Array(cells);
  for (const r of obstacles) {
    const c0 = Math.max(0, Math.ceil((r.x - minX) / GRID));
    const c1 = Math.min(cols - 1, Math.floor((r.x + r.w - minX) / GRID));
    const r0 = Math.max(0, Math.ceil((r.y - minY) / GRID));
    const r1 = Math.min(rows - 1, Math.floor((r.y + r.h - minY) / GRID));
    for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) blocked[y * cols + x] = 1;
  }
  const col = (x: number) => Math.round((x - minX) / GRID);
  const row = (y: number) => Math.round((y - minY) / GRID);
  const sc = col(start.x);
  const sr = row(start.y);
  const gc = col(goal.x);
  const gr = row(goal.y);
  blocked[sr * cols + sc] = 0;
  blocked[gr * cols + gc] = 0;

  const g = new Float64Array(cells * 4).fill(Infinity);
  const came = new Int32Array(cells * 4).fill(-1);
  const heap = new MinHeap();
  const h = (c: number, r: number) => Math.abs(c - gc) + Math.abs(r - gr);
  const startState = (sr * cols + sc) * 4 + fromDir;
  g[startState] = 0;
  heap.push(h(sc, sr), startState);
  // A linha deve chegar ao conector de destino vindo de fora: direção oposta à de saída dele.
  const arriveDir = ((toDir + 2) % 4) as Dir;

  let end = -1;
  while (heap.size) {
    const state = heap.pop();
    const cell = state >> 2;
    const dir = state & 3;
    const c = cell % cols;
    const r = (cell - c) / cols;
    if (c === gc && r === gr) {
      end = state;
      break;
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (dir + 2) % 4) continue; // sem meia-volta
      const nc = c + DX[nd];
      const nr = r + DY[nd];
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ncell = nr * cols + nc;
      if (blocked[ncell]) continue;
      let cost = g[state] + 1 + (nd !== dir ? BEND_COST : 0);
      if (nc === gc && nr === gr && nd !== arriveDir) cost += BEND_COST;
      const ns = ncell * 4 + nd;
      if (cost < g[ns]) {
        g[ns] = cost;
        came[ns] = state;
        heap.push(cost + h(nc, nr), ns);
      }
    }
  }
  if (end < 0) return null;

  const path: Point[] = [];
  for (let s = end; s >= 0; s = came[s]) {
    const cell = s >> 2;
    const c = cell % cols;
    path.push({ x: minX + c * GRID, y: minY + ((cell - c) / cols) * GRID });
  }
  path.reverse();
  return simplify([from, ...path, to]);
}

/** Calcula o traçado ortogonal de uma linha entre dois conectores. */
export function routeOrthogonal(input: RouteInput): Point[] {
  return search(input, 60) ?? search(input, 240) ?? fallback(input.from, input.to);
}

/** Comprimento total de uma polilinha. */
export function polylineLength(points: Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) len += Math.abs(points[i].x - points[i - 1].x) + Math.abs(points[i].y - points[i - 1].y);
  return len;
}
