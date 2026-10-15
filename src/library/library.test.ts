import { describe, expect, it } from "vitest";
import { checkProject } from "@/engine/diagnostics/static";
import { getDef } from "@/symbols/registry";
import { CIRCUITS } from ".";
import { runScenario } from "./scenario";
import { compileProject } from "@/engine/core/compile";
import { Simulation } from "@/engine/core/simulation";

const diagLookup = (type: string) => {
  const def = getDef(type);
  return def && { domain: def.domain, sim: def.sim, ports: def.ports };
};
const simLookup = (type: string) => {
  const def = getDef(type);
  return def && { sim: def.sim, ports: def.ports };
};

describe("biblioteca de circuitos prontos", () => {
  it("tem pelo menos 40 circuitos, com ids únicos", () => {
    expect(CIRCUITS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(CIRCUITS.map((c) => c.id)).size).toBe(CIRCUITS.length);
  });

  for (const c of CIRCUITS) {
    describe(c.id, () => {
      it("monta sem erros nem peças desconhecidas", () => {
        const project = c.build();
        for (const k of project.circuits.flatMap((x) => x.components)) expect(getDef(k.type), k.type).toBeDefined();
        const problems = checkProject(project, diagLookup).filter((d) => d.severity !== "info");
        expect(problems.map((d) => `${d.code} ${d.componentId ?? ""} ${d.port ?? ""}`)).toEqual([]);
        expect(c.steps.length).toBeGreaterThanOrEqual(3);
      });
      if (c.scenario) {
        it(`roteiro: ${c.scenario.expect}`, () => {
          const r = runScenario(c.build(), c.scenario!);
          expect(r.missing).toEqual([]);
          expect(r.sequence.join(" ")).toBe(c.scenario!.expect);
        });
      } else {
        it("simula 3 s sem travar", () => {
          const sim = new Simulation(compileProject(c.build(), simLookup));
          sim.run(3);
          const snap = sim.snapshot();
          for (const p of Object.values(snap.ports)) expect(Number.isFinite(p)).toBe(true);
        });
      }
    });
  }
});

describe("exercícios", () => {
  it("existem e a solução de cada um passa na correção automática", async () => {
    const { EXERCISES } = await import("./exercises");
    expect(EXERCISES.length).toBeGreaterThanOrEqual(10);
    for (const ex of EXERCISES) {
      const r = runScenario(ex.solution!(), ex.scenario);
      expect(r.ok, ex.id).toBe(true);
    }
  });

  it("o projeto inicial ainda não resolve o exercício", async () => {
    const { EXERCISES } = await import("./exercises");
    for (const ex of EXERCISES) {
      const start = ex.start();
      expect(start.circuits.flatMap((c) => c.components).length, ex.id).toBeGreaterThan(0);
      expect(runScenario(start, ex.scenario).ok, ex.id).toBe(false);
    }
  });
});
