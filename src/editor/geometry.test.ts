import { describe, expect, it } from "vitest";
import { alignRects, fitRect, localToWorld, rotateAroundCenter, rotatedSize, snap, svgTransform, zoomAt } from "./geometry";
import type { ComponentInstance } from "@/engine/core/types";

const def = { width: 100, height: 40 };
const inst = (over: Partial<ComponentInstance> = {}): ComponentInstance => ({
  id: "a",
  type: "x",
  x: 0,
  y: 0,
  rotation: 0,
  mirrored: false,
  label: "",
  params: {},
  ...over,
});

describe("grade", () => {
  it("arredonda para o múltiplo mais próximo", () => {
    expect(snap(14)).toBe(10);
    expect(snap(15)).toBe(20);
    expect(snap(-6)).toBe(-10);
  });
});

describe("giro e espelhamento", () => {
  it("90° e 270° trocam largura e altura", () => {
    expect(rotatedSize(90, def)).toEqual({ w: 40, h: 100 });
    expect(rotatedSize(180, def)).toEqual({ w: 100, h: 40 });
  });

  it("leva o canto (100,0) para o lugar certo em cada rotação", () => {
    const p = { x: 100, y: 0 };
    expect(localToWorld(inst(), def, p)).toEqual({ x: 100, y: 0 });
    expect(localToWorld(inst({ rotation: 90 }), def, p)).toEqual({ x: 40, y: 100 });
    expect(localToWorld(inst({ rotation: 180 }), def, p)).toEqual({ x: 0, y: 40 });
    expect(localToWorld(inst({ rotation: 270 }), def, p)).toEqual({ x: 0, y: 0 });
  });

  it("espelha antes de girar e soma a posição", () => {
    expect(localToWorld(inst({ mirrored: true, x: 10, y: 20 }), def, { x: 0, y: 0 })).toEqual({ x: 110, y: 20 });
  });

  it("a matriz SVG bate com localToWorld", () => {
    const i = inst({ rotation: 90, mirrored: true, x: 30, y: 50 });
    const m = svgTransform(i, def).match(/-?[\d.]+/g)!.map(Number);
    const p = { x: 70, y: 10 };
    const viaMatrix = { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
    expect(viaMatrix).toEqual(localToWorld(i, def, p));
  });

  it("girar mantém o centro no lugar e a peça na grade", () => {
    const r = rotateAroundCenter(inst({ x: 100, y: 100 }), def);
    expect(r).toEqual({ rotation: 90, x: 130, y: 70 });
  });
});

describe("alinhamento", () => {
  const rects = [
    { x: 0, y: 0, w: 20, h: 20 },
    { x: 50, y: 30, w: 40, h: 10 },
  ];
  it("à esquerda e embaixo", () => {
    expect(alignRects(rects, "left").map((p) => p.x)).toEqual([0, 0]);
    expect(alignRects(rects, "bottom").map((p) => p.y)).toEqual([20, 30]);
  });
});

describe("viewport", () => {
  it("zoom mantém o ponto sob o cursor", () => {
    const v = zoomAt({ x: 0, y: 0, zoom: 1 }, { x: 200, y: 100 }, 2);
    expect(v).toEqual({ x: -200, y: -100, zoom: 2 });
  });
  it("ver tudo centraliza o retângulo", () => {
    const v = fitRect({ x: 0, y: 0, w: 100, h: 100 }, { w: 400, h: 400 }, 0, 10);
    expect(v.zoom).toBe(4);
    expect(v.x).toBe(0);
  });
});
