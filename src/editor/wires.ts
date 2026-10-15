/** Posição dos conectores no mundo e traçado de todas as linhas de um circuito. */
import type { Circuit, ComponentInstance, Point, PortRef } from "@/engine/core/types";
import { getDef } from "@/symbols/registry";
import type { PortKind } from "@/symbols/types";
import { componentBounds, localToWorld, snap, type Rect } from "./geometry";
import { portExitDir, routeOrthogonal, type Dir } from "./routing";

export interface PortInfo {
  ref: PortRef;
  pos: Point;
  dir: Dir;
  kind: PortKind;
}

export function portInfo(comp: ComponentInstance, portId: string): PortInfo | null {
  const def = getDef(comp.type);
  const port = def?.ports.find((p) => p.id === portId);
  if (!def || !port) return null;
  const pos = localToWorld(comp, def, port);
  return { ref: { componentId: comp.id, portId }, pos, dir: portExitDir(pos, componentBounds(comp, def)), kind: port.kind };
}

/** Todos os conectores do circuito (para achar o mais próximo do cursor ao ligar). */
export function allPorts(circuit: Circuit): PortInfo[] {
  return circuit.components.flatMap((c) =>
    (getDef(c.type)?.ports ?? []).map((p) => portInfo(c, p.id)).filter((p): p is PortInfo => p !== null),
  );
}

/** Que tipos de conector podem ser ligados entre si. Piloto é linha pneumática de comando. */
export function canConnect(a: PortKind, b: PortKind): boolean {
  const family = (k: PortKind) => (k === "pilot" ? "pneumatic" : k);
  return family(a) === family(b);
}

/** Cache dos traçados: só recalcula a linha se as pontas ou as peças por perto mudaram. */
const cache = new Map<string, { key: string; points: Point[] }>();

export function routeAll(circuit: Circuit): Map<string, Point[]> {
  const byId = new Map(circuit.components.map((c) => [c.id, c]));
  const obstacles: Rect[] = circuit.components.flatMap((c) => {
    const def = getDef(c.type);
    return def ? [componentBounds(c, def)] : [];
  });
  const obstacleKey = obstacles.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(";");
  const routes = new Map<string, Point[]>();

  for (const w of circuit.connections) {
    const a = byId.get(w.from.componentId);
    const b = byId.get(w.to.componentId);
    const pa = a && portInfo(a, w.from.portId);
    const pb = b && portInfo(b, w.to.portId);
    if (!pa || !pb) continue;
    const key = `${pa.pos.x},${pa.pos.y},${pa.dir}|${pb.pos.x},${pb.pos.y},${pb.dir}|${obstacleKey}`;
    const hit = cache.get(w.id);
    if (hit && hit.key === key) {
      routes.set(w.id, hit.points);
      continue;
    }
    const points = routeOrthogonal({ from: pa.pos, fromDir: pa.dir, to: pb.pos, toDir: pb.dir, obstacles });
    cache.set(w.id, { key, points });
    routes.set(w.id, points);
  }
  return routes;
}

export const pointsToPath = (points: Point[]) => points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");

/** Peças cujos conectores são todos o mesmo ponto (a linha "atravessa" a peça). */
const SHARED_POINT_TYPES = new Set(["pneu.junction", "pneu.reservoir"]);

/**
 * Rede de cada linha: linhas ligadas pelo mesmo conector (ou por um ponto de ligação)
 * ficam na mesma rede. Usado para o "rastro do sinal".
 */
export function wireNets(circuit: Circuit): Map<string, string> {
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k) ?? k;
    if (p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  for (const c of circuit.components) {
    if (!SHARED_POINT_TYPES.has(c.type)) continue;
    const ports = getDef(c.type)?.ports ?? [];
    for (const p of ports.slice(1)) union(`${c.id}:${ports[0].id}`, `${c.id}:${p.id}`);
  }
  for (const w of circuit.connections) union(`${w.from.componentId}:${w.from.portId}`, `${w.to.componentId}:${w.to.portId}`);
  return new Map(circuit.connections.map((w) => [w.id, find(`${w.from.componentId}:${w.from.portId}`)]));
}

/** Ponto mais próximo de `p` num segmento horizontal/vertical, e a distância até ele. */
function nearestOnSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { point: q, dist: Math.hypot(p.x - q.x, p.y - q.y), vertical: dx === 0 };
}

/** Linha (e trecho) mais próxima de um ponto, se estiver a menos de `tolerance`. */
export function hitWire(routes: Map<string, Point[]>, p: Point, tolerance: number) {
  let best: { wireId: string; point: Point; vertical: boolean; dist: number } | null = null;
  for (const [wireId, pts] of routes) {
    for (let i = 1; i < pts.length; i++) {
      const hit = nearestOnSegment(p, pts[i - 1], pts[i]);
      if (hit.dist <= tolerance && (!best || hit.dist < best.dist)) best = { wireId, ...hit };
    }
  }
  return best;
}

export interface InsertPlan {
  x: number;
  y: number;
  rotation: 0 | 90;
  /** Conector que fica ligado à ponta `from` da linha, e o que fica ligado à ponta `to`. */
  ports: [string, string];
}

/**
 * Como encaixar uma peça no meio de uma linha: escolhe dois conectores alinhados
 * com o trecho (girando a peça 90° se precisar) e posiciona a peça para que o meio
 * entre eles caia em cima da linha.
 */
export function planInsertOnWire(
  def: { width: number; height: number; ports: readonly { id: string; x: number; y: number; kind: PortKind }[] },
  hit: { point: Point; vertical: boolean },
  fromPos: Point,
  wireKind: PortKind,
): InsertPlan | null {
  const fluid = def.ports.filter((p) => p.kind !== "pilot" && canConnect(p.kind, wireKind));
  if (fluid.length < 2) return null;
  for (const rotation of [0, 90] as const) {
    const at = (p: Point) => localToWorld({ x: 0, y: 0, rotation, mirrored: false }, def, p);
    for (let i = 0; i < fluid.length; i++) {
      for (let j = i + 1; j < fluid.length; j++) {
        const a = at(fluid[i]);
        const b = at(fluid[j]);
        const aligned = hit.vertical ? a.x === b.x : a.y === b.y;
        if (!aligned) continue;
        const x = snap(hit.point.x - (a.x + b.x) / 2);
        const y = snap(hit.point.y - (a.y + b.y) / 2);
        const da = Math.hypot(a.x + x - fromPos.x, a.y + y - fromPos.y);
        const db = Math.hypot(b.x + x - fromPos.x, b.y + y - fromPos.y);
        return { x, y, rotation, ports: da <= db ? [fluid[i].id, fluid[j].id] : [fluid[j].id, fluid[i].id] };
      }
    }
  }
  return null;
}
