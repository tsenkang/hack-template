/**
 * Exercícios criados pelo professor: salvos neste navegador (localStorage) e
 * compartilhados como arquivo .json, que o aluno importa.
 */
import type { Project } from "@/engine/core/types";
import type { Scenario } from "@/library/types";
import { download, safeFileName } from "./export";

export const EXERCISE_FORMAT = "fluxolab-exercise";
const KEY = "fluxolab:exercises";

export interface CustomExercise {
  id: string;
  title: string;
  statement: string;
  requirements: string[];
  hints: string[];
  scenario: Scenario;
  start: Project;
  solution?: Project;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

export function parseExercise(data: unknown): CustomExercise | null {
  if (!isObj(data) || data.format !== EXERCISE_FORMAT || !isObj(data.exercise)) return null;
  const e = data.exercise;
  const sc = e.scenario;
  if (typeof e.id !== "string" || typeof e.title !== "string" || typeof e.statement !== "string") return null;
  if (!isObj(sc) || !Array.isArray(sc.actions) || typeof sc.duration !== "number" || typeof sc.expect !== "string") return null;
  if (!isObj(e.start) || !Array.isArray((e.start as Record<string, unknown>).circuits)) return null;
  return {
    id: e.id,
    title: e.title,
    statement: e.statement,
    requirements: Array.isArray(e.requirements) ? e.requirements.filter((x): x is string => typeof x === "string") : [],
    hints: Array.isArray(e.hints) ? e.hints.filter((x): x is string => typeof x === "string") : [],
    scenario: sc as unknown as Scenario,
    start: e.start as unknown as Project,
    solution: isObj(e.solution) ? (e.solution as unknown as Project) : undefined,
  };
}

export function loadCustomExercises(): CustomExercise[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw.map((x) => parseExercise({ format: EXERCISE_FORMAT, exercise: x })).filter((x): x is CustomExercise => !!x) : [];
  } catch {
    return [];
  }
}

export function saveCustomExercises(list: CustomExercise[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // sem armazenamento: fica só nesta sessão
  }
}

/** Baixa o exercício para enviar aos alunos. `withSolution` = false tira a solução do arquivo. */
export function exportExercise(ex: CustomExercise, withSolution: boolean) {
  const exercise = withSolution ? ex : { ...ex, solution: undefined };
  const text = JSON.stringify({ format: EXERCISE_FORMAT, version: 1, exercise }, null, 2);
  download(`${safeFileName(ex.title)}.exercicio.json`, new Blob([text], { type: "application/json" }));
}
