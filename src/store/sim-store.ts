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
import { useUi } from "./ui-store";

export type SimStatus = "stopped" | "running" | "paused";

/**
 * Histórico do avanço de cada cilindro, para o diagrama de fases.
 * Fica fora do estado do Zustand (muda a cada quadro); a tela observa `historyVersion`.
 */
export interface MotionHistory {
  t: number[];
  /** Avanço (0…1) de cada cilindro, pelo id da peça. */
  series: Record<string, number[]>;
  /** Grandezas para os gráficos, chave "id:campo" (ex.: "k12:pressure"). */
  measures: Record<string, number[]>;
}
export const motionHistory: MotionHistory = { t: [], series: {}, measures: {} };
/** Campos numéricos das peças que viram gráfico. */
export const MEASURE_FIELDS = ["extension", "velocity", "pressure", "flow", "rpm"] as const;
export type MeasureField = (typeof MEASURE_FIELDS)[number];
/** Intervalo mínimo entre amostras [s de simulação] e tamanho máximo do histórico. */
const SAMPLE_DT = 0.01;
const HISTORY_MAX = 6000;

function push(map: Record<string, number[]>, key: string, length: number, value: number) {
  (map[key] ??= new Array(length).fill(value)).push(value);
}

function recordHistory(snap: SimSnapshot) {
  const h = motionHistory;
  const last = h.t[h.t.length - 1];
  if (last !== undefined && snap.time - last < SAMPLE_DT) return false;
  const n = h.t.length;
  h.t.push(snap.time);
  for (const [id, st] of Object.entries(snap.components)) {
    if (st.extension !== undefined) push(h.series, id, n, st.extension);
    for (const f of MEASURE_FIELDS) {
      const v = st[f];
      if (typeof v === "number") push(h.measures, `${id}:${f}`, n, v);
    }
  }
  if (h.t.length > HISTORY_MAX) {
    const cut = h.t.length - HISTORY_MAX;
    h.t.splice(0, cut);
    for (const s of Object.values(h.series)) s.splice(0, s.length - HISTORY_MAX);
    for (const s of Object.values(h.measures)) s.splice(0, s.length - HISTORY_MAX);
  }
  return true;
}

/** Acionamentos feitos durante a simulação (para o professor gravar o roteiro de um exercício). */
export interface LoggedAction {
  t: number;
  id: string;
  side: "left" | "right";
  active: boolean;
}
export const actionLog: LoggedAction[] = [];

/** Ordem dos movimentos dos cilindros no histórico ("A1+", "A1-"…), como no roteiro automático. */
export function sequenceFromHistory(labels: Map<string, string>): string[] {
  const events: { t: number; name: string }[] = [];
  for (const [id, values] of Object.entries(motionHistory.series)) {
    const label = labels.get(id);
    if (!label) continue;
    let prev = values[0] ?? 0;
    for (let i = 1; i < values.length; i++) {
      const e = values[i];
      if (e >= 0.99 && prev < 0.99) events.push({ t: motionHistory.t[i], name: `${label}+` });
      if (e <= 0.01 && prev > 0.01) events.push({ t: motionHistory.t[i], name: `${label}-` });
      prev = e;
    }
  }
  return events.sort((a, b) => a.t - b.t).map((e) => e.name);
}

function clearHistory() {
  actionLog.length = 0;
  motionHistory.t = [];
  motionHistory.series = {};
  motionHistory.measures = {};
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

/** Tolerância por campo numérico; os demais campos (booleanos, objetos) comparam exatamente. */
const TOLERANCE: Partial<Record<keyof ComponentSimState, number>> = {
  spool: 1e-3,
  extension: 1e-4,
  velocity: 1e-3,
  pressure: 0.01,
  charge: 0.005,
  angle: 1,
  rpm: 1,
};

function sameComponent(a: ComponentSimState, b: ComponentSimState) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof ComponentSimState>;
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    if (typeof x === "number" || typeof y === "number") {
      if (!close(x as number | undefined, y as number | undefined, TOLERANCE[k] ?? 0)) return false;
    } else if (typeof x !== "object" || typeof y !== "object" || x === null || y === null) {
      if (x !== y) return false;
    } else if (k === "pressed") {
      const [p, q] = [x as { left: boolean; right: boolean }, y as { left: boolean; right: boolean }];
      if (p.left !== q.left || p.right !== q.right) return false;
    } else if (JSON.stringify(x) !== JSON.stringify(y)) return false;
  }
  return true;
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

let pending: { snapshot: SimSnapshot; lagging: boolean; grew: boolean } | null = null;
let frameRequest: number | null = null;
let latestPorts: SimSnapshot["ports"] = {};

export const useSim = create<SimState>()((set, get) => {
  const applyPending = () => {
    frameRequest = null;
    const p = pending;
    pending = null;
    if (!p || get().status === "stopped") return;
    set({
      snapshot: stabilize(get().snapshot, p.snapshot),
      lagging: p.lagging,
      ...(p.grew ? { historyVersion: get().historyVersion + 1 } : {}),
    });
  };
  const boot = () => {
    worker?.terminate();
    // Versões empacotadas de outro jeito (ex.: página de teste num arquivo só) podem fornecer o próprio Worker.
    const custom = (globalThis as { __fluxolabWorker?: () => Worker }).__fluxolabWorker;
    worker = custom ? custom() : new Worker(new URL("../worker/sim.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data;
      if (msg.type === "snapshot") {
        if (get().status === "stopped") return;
        const grew = recordHistory(msg.snapshot);
        if (msg.noPorts) msg.snapshot.ports = latestPorts;
        else latestPorts = msg.snapshot.ports;
        // Junta as mensagens que chegam entre dois quadros da tela: a tela desenha só a mais nova.
        pending = { snapshot: msg.snapshot, lagging: msg.lagging, grew: grew || (pending?.grew ?? false) };
        if (frameRequest === null) frameRequest = requestAnimationFrame(applyPending);
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
        // Durante a simulação, o painel de baixo mostra o diagrama de fases (se a pessoa estava na lista de peças).
        if (useUi.getState().bottomTab === "parts") useUi.getState().setBottomTab("phases");
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
      pending = null;
      latestPorts = {};
      if (frameRequest !== null) cancelAnimationFrame(frameRequest);
      frameRequest = null;
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
      actionLog.push({ t: get().snapshot?.time ?? 0, id, side, active });
      const cmd: SimCommand = { type: "actuate", id, side, active };
      send({ type: "command", cmd });
    },
    setParam(id, key, value) {
      send({ type: "command", cmd: { type: "param", id, key, value } });
    },
  };
});

export const isSimulating = () => useSim.getState().status !== "stopped";
