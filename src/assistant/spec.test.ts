import { describe, expect, it } from "vitest";
import { CIRCUITS } from "@/library";
import { partCatalog } from "./catalog";
import { buildFromSpec, projectToSpec, reportText } from "./spec";

describe("assistente: montagem a partir da descrição", () => {
  it("todo circuito pronto, descrito no formato da ferramenta, volta a montar e passa no teste", () => {
    for (const c of CIRCUITS) {
      const spec = projectToSpec(c.build(), { test: c.scenario });
      const r = buildFromSpec(JSON.parse(JSON.stringify(spec)));
      expect(r.structural, c.id).toEqual([]);
      expect(r.ok, `${c.id}: ${reportText(r, (d) => d.code)}`).toBe(true);
    }
  });

  it("aponta peça inexistente, porta errada e ligação mal escrita, sem quebrar", () => {
    const r = buildFromSpec({
      tabs: [
        {
          parts: [
            { ref: "a", type: "pneu.cylinder.single-acting", x: 0, y: 0, label: "A1" },
            { ref: "x", type: "pneu.nao.existe", x: 0, y: 0 },
          ],
          wires: [
            { from: "a:Z", to: "a:A" },
            { from: "semdoispontos", to: "a:A" },
            { from: "b:1", to: "a:A" },
          ],
        },
      ],
      test: { actions: [{ t: 0.1, target: "S1", active: true }], duration: 1, expect: "A1+" },
    });
    expect(r.ok).toBe(false);
    expect(r.structural.join("\n")).toMatch(/não existe no catálogo/);
    expect(r.structural.join("\n")).toMatch(/não tem a porta "Z"/);
    expect(r.structural.join("\n")).toMatch(/formato "ref:porta"/);
    expect(r.test?.missing).toEqual(["S1"]);
  });

  it("o catálogo lista todas as peças com conectores", () => {
    const text = partCatalog();
    expect(text).toContain("pneu.valve.5-2.pilot-pilot");
    expect(text).toContain("portas: 4@80,0");
    expect(text.split("\n").length).toBeGreaterThanOrEqual(118);
  });
});
