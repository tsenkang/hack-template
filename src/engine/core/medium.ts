/**
 * O "meio" de uma rede de fluido: como volume, pressão e conteúdo se relacionam.
 *  - Ar (gás ideal, isotérmico): conteúdo = massa = p·V/(R·T).
 *  - Óleo (quase incompressível): conteúdo = volume equivalente = V·(1 + (p − patm)/β).
 */
import { P_ATM, RT } from "../pneumatic/flow";

export interface Medium {
  /** Capacidade do nó [conteúdo/Pa]: quanto "cabe" a mais por pascal. */
  capacity(volume: number): number;
  content(p: number, volume: number): number;
  pressure(content: number, volume: number): number;
  /** Rigidez da "mola" de fluido numa câmara [N/m] (para escolher os subpassos da mecânica). */
  stiffness(p: number, area: number, volume: number): number;
  /** Menor pressão absoluta aceita [Pa] e maior passo do Newton [Pa]. */
  minPressure: number;
  maxDelta: number;
  /** Volume de cada conector e de cada linha [m³]. */
  portVolume: number;
  wireVolume: number;
}

export const AIR: Medium = {
  capacity: (v) => v / RT,
  content: (p, v) => (p * v) / RT,
  pressure: (c, v) => (c * RT) / v,
  stiffness: (p, a, v) => (p * a * a) / v,
  minPressure: 1e3,
  maxDelta: 3e5,
  portVolume: 0.5e-6,
  wireVolume: 5e-6, // ≈ 0,4 m de mangueira de 4 mm
};

/** Módulo de compressibilidade efetivo do óleo com mangueiras [Pa]. */
export const BULK_MODULUS = 1.0e9;

export const OIL: Medium = {
  capacity: (v) => v / BULK_MODULUS,
  content: (p, v) => v * (1 + (p - P_ATM) / BULK_MODULUS),
  pressure: (c, v) => P_ATM + BULK_MODULUS * (c / v - 1),
  stiffness: (_p, a, v) => (BULK_MODULUS * a * a) / v,
  // abaixo de ~0,1 bar absoluto o óleo cavita: a pressão não cai mais
  minPressure: 0.1e5,
  maxDelta: 100e5,
  portVolume: 2e-6,
  wireVolume: 2e-5, // ≈ 0,5 m de mangueira de 1/4"
};
