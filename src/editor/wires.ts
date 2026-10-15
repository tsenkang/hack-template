/** Posição dos conectores no mundo e traçado de todas as linhas de um circuito. */
import type { Circuit, ComponentInstance, Point, PortRef } from "@/engine/core/types";
import { getDef } from "@/symbols/registry";
import type { PortKind } from "@/symbols/types";
import { componentBounds, localToWorld, type Rect } from "./geometry";
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
