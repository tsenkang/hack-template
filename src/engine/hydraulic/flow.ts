/**
 * Vazão de óleo por um orifício (escoamento turbulento): Q ∝ √Δp.
 * Cada peça é descrita pela vazão nominal que deixa passar com uma queda de
 * pressão nominal, como nos catálogos (ex.: 30 l/min com Δp de 5 bar).
 * Perto de Δp = 0 a curva vira uma reta (escoamento laminar), o que também
 * mantém o solver estável.
 */
import { BAR } from "../pneumatic/flow";

/** Abaixo desta queda de pressão o escoamento é tratado como laminar (linear). */
const LINEAR_BELOW = 0.2 * BAR;

/** Vazão [m³/s] de a para b (negativa no sentido contrário). */
export function oilFlow(qnLmin: number, pa: number, pb: number, dpNominalBar = 5): number {
  if (qnLmin <= 0) return 0;
  const qn = qnLmin / 60_000;
  const dpn = dpNominalBar * BAR;
  const dp = pa - pb;
  const abs = Math.abs(dp);
  if (abs < LINEAR_BELOW) return qn * Math.sqrt(LINEAR_BELOW / dpn) * (dp / LINEAR_BELOW);
  return Math.sign(dp) * qn * Math.sqrt(abs / dpn);
}

/** m³/s → l/min. */
export const toLmin = (q: number) => q * 60_000;
