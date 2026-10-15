/**
 * Solver da rede de ar: análise nodal com integração implícita (Euler para trás)
 * e Newton-Raphson.
 *
 * Cada rede (conjunto de conectores ligados) é um nó com volume V e pressão p.
 * Cada orifício é um ramo com vazão mássica m(pa, pb). Para cada nó:
 *
 *     V/(R·T) · (p − p_anterior)/dt = Σ vazões que entram
 *
 * Os nós 0..n−1 são incógnitas; os nós ≥ n têm pressão fixa (atmosfera, fontes).
 */
import { RT } from "../pneumatic/flow";
import { solveDense } from "./dense";

export interface Branch {
  a: number;
  b: number;
  /** Vazão mássica [kg/s] de a para b. */
  flow(pa: number, pb: number): number;
  /** Conector do lado a / b (para contabilizar a vazão em cada conector). */
  portA?: string;
  portB?: string;
}

const MAX_ITER = 10;
const TOL_PA = 0.5;
/** Maior variação de pressão aceita por iteração (evita "pulos" do Newton). */
const MAX_DELTA = 3e5;
const MIN_PRESSURE = 1e3;

export interface NetworkWork {
  J: Float64Array;
  F: Float64Array;
  prev: Float64Array;
  trial: Float64Array;
  trialF: Float64Array;
}

export function createWork(n: number): NetworkWork {
  return {
    J: new Float64Array(n * n),
    F: new Float64Array(n),
    prev: new Float64Array(n),
    trial: new Float64Array(0),
    trialF: new Float64Array(n),
  };
}

const deriv = (f: (x: number) => number, x: number) => {
  const h = Math.max(5, Math.abs(x) * 1e-5);
  return (f(x + h) - f(x - h)) / (2 * h);
};

/** Resíduo de cada nó: acúmulo − vazão que entra. Devolve a norma (soma dos quadrados). */
function residual(
  p: Float64Array,
  prev: Float64Array,
  volumes: Float64Array,
  n: number,
  branches: readonly Branch[],
  dt: number,
  F: Float64Array,
): number {
  for (let i = 0; i < n; i++) F[i] = (volumes[i] / (RT * dt)) * (p[i] - prev[i]);
  for (const br of branches) {
    const m = br.flow(p[br.a], p[br.b]);
    if (br.a < n) F[br.a] += m;
    if (br.b < n) F[br.b] -= m;
  }
  let norm = 0;
  for (let i = 0; i < n; i++) norm += F[i] * F[i];
  return norm;
}

/**
 * Avança a rede um passo `dt`, atualizando `p` (pressões absolutas) no lugar.
 * Devolve a vazão final de cada ramo, na mesma ordem de `branches`.
 *
 * Newton com busca linear: se o passo completo piora o resíduo, ele é reduzido
 * pela metade até melhorar. Isso evita que reguladores e retenções (que abrem e
 * fecham numa faixa estreita de pressão) façam o Newton ficar "pulando".
 */
export function stepNetwork(
  p: Float64Array,
  volumes: Float64Array,
  n: number,
  branches: readonly Branch[],
  dt: number,
  work: NetworkWork,
): Float64Array {
  const { J, F, prev, trialF } = work;
  if (work.trial.length !== p.length) work.trial = new Float64Array(p.length);
  const trial = work.trial;
  for (let i = 0; i < n; i++) prev[i] = p[i];

  let norm = residual(p, prev, volumes, n, branches, dt, F);
  for (let iter = 0; iter < MAX_ITER && n > 0; iter++) {
    J.fill(0);
    for (let i = 0; i < n; i++) J[i * n + i] = volumes[i] / (RT * dt);
    for (const br of branches) {
      const pa = p[br.a];
      const pb = p[br.b];
      const dma = br.a < n ? deriv((x) => br.flow(x, pb), pa) : 0;
      const dmb = br.b < n ? deriv((x) => br.flow(pa, x), pb) : 0;
      if (br.a < n) {
        J[br.a * n + br.a] += dma;
        if (br.b < n) J[br.a * n + br.b] += dmb;
      }
      if (br.b < n) {
        J[br.b * n + br.b] -= dmb;
        if (br.a < n) J[br.b * n + br.a] -= dma;
      }
    }
    // Δ = −J⁻¹·F (a solução fica em F)
    for (let i = 0; i < n; i++) F[i] = -F[i];
    if (!solveDense(J, F, n)) break;

    let maxDelta = 0;
    for (let i = 0; i < n; i++) maxDelta = Math.max(maxDelta, Math.abs(F[i]));
    let alpha = maxDelta > MAX_DELTA ? MAX_DELTA / maxDelta : 1;
    trial.set(p);
    let trialNorm = Infinity;
    for (let tries = 0; tries < 12; tries++) {
      for (let i = 0; i < n; i++) trial[i] = Math.max(MIN_PRESSURE, p[i] + F[i] * alpha);
      trialNorm = residual(trial, prev, volumes, n, branches, dt, trialF);
      if (trialNorm < norm || alpha * maxDelta < TOL_PA) break;
      alpha /= 2;
    }
    for (let i = 0; i < n; i++) p[i] = trial[i];
    F.set(trialF);
    norm = trialNorm;
    if (alpha * maxDelta < TOL_PA) break;
  }

  const flows = new Float64Array(branches.length);
  branches.forEach((br, k) => (flows[k] = br.flow(p[br.a], p[br.b])));
  return flows;
}
