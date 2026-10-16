/// <reference lib="webworker" />
/**
 * Web Worker da simulação: roda o motor fora da linha principal, para a tela
 * nunca travar. A cada quadro (~60 por segundo) avança o tempo simulado
 * (tempo real × velocidade) e devolve o estado para a tela desenhar.
 */
import { DT, Simulation } from "@/engine/core/simulation";
import type { FromWorker, ToWorker } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const FRAME_MS = 1000 / 60;
/** Tempo máximo de cálculo por quadro; acima disso a simulação fica mais lenta que o pedido. */
const BUDGET_MS = 12;

let sim: Simulation | null = null;
let speed = 1;
let timer: ReturnType<typeof setInterval> | null = null;
let lastWall = 0;
let debt = 0;

const post = (msg: FromWorker) => self.postMessage(msg);
/** A pressão de cada conector (modo Explique) vai a cada PORTS_EVERY quadros. */
const PORTS_EVERY = 6;
let frame = 0;
const publish = (lagging = false, full = true) => {
  if (!sim) return;
  const withPorts = full || ++frame % PORTS_EVERY === 0;
  post({ type: "snapshot", snapshot: sim.snapshot(withPorts), lagging, noPorts: !withPorts });
};

function tick() {
  if (!sim) return;
  const now = performance.now();
  debt += ((now - lastWall) / 1000) * speed;
  lastWall = now;
  const start = performance.now();
  while (debt >= DT && performance.now() - start < BUDGET_MS) {
    sim.step();
    debt -= DT;
  }
  const lagging = debt > 0.1 * speed + DT;
  if (lagging) debt = 0; // não acumula atraso infinito
  publish(lagging, false);
}

function stopTimer() {
  if (timer) clearInterval(timer);
  timer = null;
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    switch (msg.type) {
      case "load":
        stopTimer();
        sim = new Simulation(msg.circuit);
        publish();
        break;
      case "run":
        if (!timer) {
          lastWall = performance.now();
          debt = 0;
          timer = setInterval(tick, FRAME_MS);
        }
        break;
      case "pause":
        stopTimer();
        publish();
        break;
      case "step":
        if (sim) {
          stopTimer();
          sim.run(msg.seconds);
          publish();
        }
        break;
      case "speed":
        speed = msg.value;
        break;
      case "command":
        sim?.command(msg.cmd);
        if (!timer) publish();
        break;
    }
  } catch (err) {
    post({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
