/** Mensagens entre a tela e o Web Worker da simulação. */
import type { SimCircuit, SimCommand, SimSnapshot } from "@/engine/core/sim-types";

export type ToWorker =
  | { type: "load"; circuit: SimCircuit }
  | { type: "run" }
  | { type: "pause" }
  | { type: "step"; seconds: number }
  | { type: "speed"; value: number }
  | { type: "command"; cmd: SimCommand };

export type FromWorker =
  | { type: "snapshot"; snapshot: SimSnapshot; /** true se o computador não acompanha a velocidade pedida */ lagging: boolean }
  | { type: "error"; message: string };
