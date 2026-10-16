/**
 * Circuito pronto ou exercício aberto agora, e o resultado da última correção.
 * Os textos (roteiro, enunciado) aparecem no painel da esquerda.
 */
import { create } from "zustand";
import { createId } from "@/engine/core/ids";
import type { Project } from "@/engine/core/types";
import { getCircuit } from "@/library";
import { EXERCISES, type Exercise } from "@/library/exercises";
import { runScenario, type ScenarioResult } from "@/library/scenario";
import { loadCustomExercises, saveCustomExercises, type CustomExercise } from "@/persistence/exercise-file";
import { saveProject } from "@/persistence/storage";
import { useEditor } from "./editor-store";
import { useSim } from "./sim-store";

/** Exercício como a tela usa: embutido ou criado pelo professor. */
export interface LessonExercise extends Omit<Exercise, "level"> {
  level?: 1 | 2 | 3;
  custom: boolean;
}

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function fromCustom(c: CustomExercise): LessonExercise {
  return {
    ...c,
    custom: true,
    start: () => ({ ...clone(c.start), id: createId("p") }),
    solution: c.solution ? () => ({ ...clone(c.solution!), id: createId("p") }) : undefined,
  };
}

export const builtInExercises = (): LessonExercise[] => EXERCISES.map((e) => ({ ...e, custom: false }));

interface LessonState {
  circuitId: string | null;
  exercise: LessonExercise | null;
  result: ScenarioResult | null;
  checking: boolean;
  custom: CustomExercise[];
  openCircuit(id: string): Promise<void>;
  openExercise(ex: LessonExercise): Promise<void>;
  showSolution(): Promise<void>;
  close(): void;
  check(): void;
  addCustom(ex: CustomExercise): void;
  removeCustom(id: string): void;
}

/** Guarda o projeto atual (ele continua em "Abrir") e abre outro no lugar. */
async function replaceProject(project: Project) {
  useSim.getState().stop();
  await saveProject(useEditor.getState().project).catch(() => undefined);
  useEditor.getState().loadProject(project);
}

export const useLesson = create<LessonState>()((set, get) => ({
  circuitId: null,
  exercise: null,
  result: null,
  checking: false,
  custom: typeof window === "undefined" ? [] : loadCustomExercises(),

  async openCircuit(id) {
    const c = getCircuit(id);
    if (!c) return;
    await replaceProject(c.build());
    set({ circuitId: id, exercise: null, result: null });
  },
  async openExercise(ex) {
    await replaceProject(ex.start());
    set({ exercise: ex, circuitId: null, result: null });
  },
  async showSolution() {
    const sol = get().exercise?.solution;
    if (sol) await replaceProject(sol());
  },
  close() {
    set({ circuitId: null, exercise: null, result: null });
  },
  check() {
    const ex = get().exercise;
    if (!ex) return;
    set({ checking: true });
    // deixa a tela mostrar "conferindo…" antes do cálculo (roda no navegador, alguns décimos de segundo)
    setTimeout(() => {
      let result: ScenarioResult;
      try {
        result = runScenario(useEditor.getState().project, ex.scenario);
      } catch {
        result = { sequence: [], missing: [], ok: false };
      }
      set({ result, checking: false });
    }, 30);
  },
  addCustom(ex) {
    const custom = [...get().custom.filter((c) => c.id !== ex.id), ex];
    saveCustomExercises(custom);
    set({ custom });
  },
  removeCustom(id) {
    const custom = get().custom.filter((c) => c.id !== id);
    saveCustomExercises(custom);
    set({ custom });
  },
}));
