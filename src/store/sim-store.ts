/**
 * Estado da simulação na tela: controla o Web Worker e guarda o último estado recebido.
 * Enquanto a simulação não está parada, o desenho fica travado para edição.
 */
import { create } from "zustand";
import { compileProject } from "@/engine/core/compile";
import type { ComponentSimState, SimCommand, SimSnapshot, WireSimState } from "@/engine/core/sim-types";
import type { ParamValue } from "@/engine/core/types";
import { getDef } from "@/symbols/registry";
import type { FromWorker, ToWorker } from "@/worker/protocol";
import { useEditor } from "./editor-store";
import { toast } from "./toast-store";

export type SimStatus = "stopped" | "running" | "paused";

/**
 * Histórico do avanço de cada cilindro, para o diagrama de fases.
 * Fica fora do estado do Zustand (muda a cada quadro); a tela observa `historyVersion`.
 */
export interface MotionHistory {
  t: number[];
  series: Record<string, number[]>;
}
export const motionHistory: MotionHistory = { t: [], series: {} };
/** Intervalo mínimo entre amostras [s de simulação] e tamanho máximo do histórico. */
const SAMPLE_DT = 0.01;
const HISTORY_MAX = 6000;

function recordHistory(snap: SimSnapshot) {
  const h = motionHistory;
  const last = h.t[h.t.length - 1];
  if (last !== undefined && snap.time - last < SAMPLE_DT) return false;
  h.t.push(snap.time);
  for (const [id, st] of Object.entries(snap.components)) {
    if (st.extension === undefined) continue;
    (h.series[id] ??= new Array(h.t.length - 1).fill(st.extension)).push(st.extension);
  }
  if (h.t.length > HISTORY_MAX) {
    h.t.splice(0, h.t.length - HISTORY_MAX);
    for (const s of Object.values(h.series)) s.splice(0, s.length - HISTORY_MAX);
  }
  return true;
}

function clearHistory() {
  motionHistory.t = [];
  motionHistory.series = {};
}

/** Quanto o botão "avançar um passo" anda no tempo [s]. */
export const STEP_SECONDS = 0.01;
export const SPEEDS = [0.1, 0.25, 0.5, 1, 2, 5, 10] as const;

interface SimState {
  status: SimStatus;
  speed: number;
  snapshot: SimSnapshot | null;
  lagging: boolean;
  /** Muda quando o histórico do diagrama de fases ganha amostras novas. */
  historyVersion: number;
  start(): void;
  pause(): void;
  stop(): void;
  step(): void;
  setSpeed(speed: number): void;
  actuate(id: string, side: "left" | "right", active: boolean): void;
  setParam(id: string, key: string, value: ParamValue): void;
}

let worker: Worker | null = null;

const send = (msg: ToWorker) => worker?.postMessage(msg);

const lookup = (type: string) => {
  const def = getDef(type);
  return def && { sim: def.sim, ports: def.ports };
};

/** Compara estados arredondando, para não redesenhar peças que não mudaram de verdade. */
const close = (a: number | undefined, b: number | undefined, eps: number) =>
  a === b || (a !== undefined && b !== undefined && Math.abs(a - b) < eps);

function sameComponent(a: ComponentSimState, b: ComponentSimState) {
  return (
    close(a.spool, b.spool, 1e-3) &&
    close(a.extension, b.extension, 1e-4) &&
    close(a.pressure, b.pressure, 0.01) &&
    a.pressed?.left === b.pressed?.left &&
    a.pressed?.right === b.pressed?.right
  );
}

const sameWire = (a: WireSimState, b: WireSimState) => close(a.p, b.p, 0.02) && close(a.q, b.q, 1);

/** Reaproveita os objetos do quadro anterior quando nada mudou (o React pula esses itens). */
function stabilize(prev: SimSnapshot | null, next: SimSnapshot): SimSnapshot {
  if (!prev) return next;
  for (const [id, st] of Object.entries(next.components)) {
    const old = prev.components[id];
    if (old && sameComponent(old, st)) next.components[id] = old;
  }
  for (const [id, st] of Object.entries(next.wires)) {
    const old = prev.wires[id];
    if (old && sameWire(old, st)) next.wires[id] = old;
  }
  // Avisos só mudam de identidade quando a lista muda (valores arredondados).
  const sig = (s: SimSnapshot) => s.warnings.map((w) => `${w.componentId}${w.code}${w.port}${Math.round(w.value ?? 0)}`).join("|");
  if (sig(prev) === sig(next)) next.warnings = prev.warnings;
  return next;
}

export const useSim = create<SimState>()((set, get) => {
  const boot = () => {
    worker?.terminate();
    worker = new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      if (msg.type === "snapshot") {
        if (get().status === "stopped") return;
        const grew = recordHistory(msg.snapshot);
        set({
          snapshot: stabilize(get().snapshot, msg.snapshot),
          lagging: msg.lagging,
          ...(grew ? { historyVersion: get().historyVersion + 1 } : {}),
        });
      } else {
        toast(msg.message, "error");
        get().stop();
      }
    };
    send({ type: "load", circuit: compileProject(useEditor.getState().project, lookup) });
    send({ type: "speed", value: get().speed });
  };

  return {
    status: "stopped",
    speed: 1,
    snapshot: null,
    lagging: false,
    historyVersion: 0,

    start() {
      const { status } = get();
      if (status === "running") return;
      if (status === "stopped") {
        clearHistory();
        useEditor.getState().select([]);
        boot();
      }
      send({ type: "run" });
      set({ status: "running" });
    },
    pause() {
      if (get().status !== "running") return;
      send({ type: "pause" });
      set({ status: "paused" });
    },
    stop() {
      worker?.terminate();
      worker = null;
      set({ status: "stopped", snapshot: null, lagging: false });
    },
    step() {
      if (get().status === "stopped") {
        clearHistory();
        useEditor.getState().select([]);
        boot();
      }
      send({ type: "step", seconds: STEP_SECONDS });
      set({ status: "paused" });
    },
    setSpeed(speed) {
      send({ type: "speed", value: speed });
      set({ speed });
    },
    actuate(id, side, active) {
      const cmd: SimCommand = { type: "actuate", id, side, active };
      send({ type: "command", cmd });
    },
    setParam(id, key, value) {
      send({ type: "command", cmd: { type: "param", id, key, value } });
    },
  };
});

export const isSimulating = () => useSim.getState().status !== "stopped";
