/**
 * Executa um roteiro (ações com hora marcada) num projeto e registra a ordem em
 * que os cilindros chegam aos fins de curso. Roda o motor direto, sem Worker.
 */
import { compileProject } from "@/engine/core/compile";
import { DT, Simulation } from "@/engine/core/simulation";
import type { Project } from "@/engine/core/types";
import { getDef } from "@/symbols/registry";
import type { Scenario } from "./types";

const lookup = (type: string) => {
  const def = getDef(type);
  return def && { sim: def.sim, ports: def.ports };
};

export interface ScenarioResult {
  /** Movimentos na ordem, ex.: ["A1+", "A1-"]. */
  sequence: string[];
  /** Rótulos usados no roteiro que não existem no projeto. */
  missing: string[];
  ok: boolean;
}

/** Tempo de "aquecimento" antes das ações: câmaras e linhas enchem. */
const WARMUP = 0.5;

export function runScenario(project: Project, scenario: Scenario): ScenarioResult {
  const comps = project.circuits.flatMap((c) => c.components);
  const byLabel = new Map(comps.filter((c) => c.label).map((c) => [c.label, c.id] as const));
  const missing = [...new Set(scenario.actions.map((a) => a.target).filter((l) => !byLabel.has(l)))];
  const sim = new Simulation(compileProject(project, lookup));
  const cylinders = comps.filter((c) => getDef(c.type)?.sim?.kind === "cylinder");
  const last = new Map<string, number>();
  const sequence: string[] = [];
  const actions = [...scenario.actions].sort((a, b) => a.t - b.t);
  let next = 0;

  sim.run(WARMUP);
  for (const c of cylinders) last.set(c.id, sim.snapshot().components[c.id]?.extension ?? 0);
  const start = sim.time;
  const steps = Math.round(scenario.duration / DT);
  for (let i = 0; i <= steps; i++) {
    const now = sim.time - start;
    while (next < actions.length && actions[next].t <= now + 1e-9) {
      const a = actions[next++];
      const id = byLabel.get(a.target);
      if (id) sim.command({ type: "actuate", id, side: a.side ?? "left", active: a.active });
    }
    sim.step();
    if (i % 5 !== 0) continue;
    const snap = sim.snapshot();
    for (const c of cylinders) {
      const e = snap.components[c.id]?.extension ?? 0;
      const prev = last.get(c.id) ?? 0;
      if (e >= 0.99 && prev < 0.99) sequence.push(`${c.label}+`);
      if (e <= 0.01 && prev > 0.01) sequence.push(`${c.label}-`);
      last.set(c.id, e);
    }
  }
  const expected = scenario.expect.split(/\s+/).filter(Boolean);
  const ok = missing.length === 0 && expected.length === sequence.length && expected.every((s, i) => s === sequence[i]);
  return { sequence, missing, ok };
}

/** Clique rápido num botão: aperta em `t` e solta `hold` segundos depois. */
export function press(target: string, t: number, hold = 0.2, side: "left" | "right" = "left") {
  return [
    { t, target, side, active: true },
    { t: t + hold, target, side, active: false },
  ];
}

/** Sequência curta para mostrar: "A1+ A1- A1+ A1- A1+ A1-" → "(A1+ A1-) × 3". */
export function compactSequence(seq: string): string {
  const tokens = seq.split(/\s+/).filter(Boolean);
  for (let p = 1; p <= tokens.length / 3; p++) {
    if (tokens.length % p !== 0) continue;
    if (tokens.every((x, i) => x === tokens[i % p])) return `(${tokens.slice(0, p).join(" ")}) × ${tokens.length / p}`;
  }
  return seq;
}
