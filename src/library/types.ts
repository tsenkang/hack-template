/** Tipos da biblioteca de circuitos prontos e dos exercícios. */
import type { Project } from "@/engine/core/types";

export type LibraryArea = "pneumatic" | "electropneumatic" | "hydraulic" | "electrohydraulic" | "plc";

/** Ação do roteiro de teste: acionar (ou soltar) a peça com o rótulo `target` no instante `t` [s]. */
export interface ScenarioAction {
  t: number;
  target: string;
  side?: "left" | "right";
  active: boolean;
}

/**
 * Roteiro automático: aplica as ações e registra a ordem dos movimentos dos
 * cilindros ("A1+ A2+ A2- A1-"). Serve para conferir os circuitos prontos e
 * para corrigir os exercícios.
 */
export interface Scenario {
  actions: ScenarioAction[];
  /** Tempo total simulado [s]. */
  duration: number;
  /** Sequência esperada dos cilindros, separada por espaços. */
  expect: string;
}

export interface LibraryCircuit {
  id: string;
  area: LibraryArea;
  /** 1 = básico, 2 = intermediário, 3 = avançado. */
  level: 1 | 2 | 3;
  title: string;
  summary: string;
  /** Explicação passo a passo (o que fazer e o que observar). */
  steps: string[];
  build(): Project;
  scenario?: Scenario;
}
