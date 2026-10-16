import { describe, expect, it } from "vitest";
import { polylineLength, portExitDir, routeOrthogonal, simplify } from "./routing";

const isOrthogonal = (pts: { x: number; y: number }[]) =>
  pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y);

describe("roteamento ortogonal", () => {
  it("direção de saída pelo lado da peça", () => {
    const box = { x: 0, y: 0, w: 100, h: 60 };
    expect(portExitDir({ x: 10, y: 60 }, box)).toBe(1);
    expect(portExitDir({ x: 0, y: 30 }, box)).toBe(2);
    expect(portExitDir({ x: 40, y: 0 }, box)).toBe(3);
  });

  it("liga em linha reta quando não há nada no caminho", () => {
    const pts = routeOrthogonal({ from: { x: 0, y: 0 }, fromDir: 1, to: { x: 0, y: 100 }, toDir: 3, obstacles: [] });
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 100 },
    ]);
  });

  it("só usa trechos de 90° e desvia de uma peça no meio", () => {
    const obstacle = { x: -30, y: 40, w: 60, h: 20 };
    const pts = routeOrthogonal({ from: { x: 0, y: 0 }, fromDir: 1, to: { x: 0, y: 100 }, toDir: 3, obstacles: [obstacle] });
    expect(isOrthogonal(pts)).toBe(true);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      // nenhum trecho atravessa o interior da peça
      const crossesX = Math.min(a.x, b.x) < obstacle.x + obstacle.w && Math.max(a.x, b.x) > obstacle.x;
      const crossesY = Math.min(a.y, b.y) < obstacle.y + obstacle.h && Math.max(a.y, b.y) > obstacle.y;
      expect(crossesX && crossesY).toBe(false);
    }
    expect(polylineLength(pts)).toBeGreaterThan(100);
  });

  it("remove pontos alinhados", () => {
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ]);
  });
});
