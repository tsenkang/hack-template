/**
 * Vazão de ar através de um orifício, pelo modelo da norma ISO 6358.
 *
 * C = condutância sônica [m³/(s·Pa)], b = razão crítica de pressão.
 * Acima de b o escoamento é subsônico; abaixo, o ar atinge a velocidade do
 * som e a vazão deixa de depender da pressão de saída ("vazão bloqueada").
 */

/** Pressão atmosférica [Pa]. */
export const P_ATM = 101_325;
/** Constante do ar × temperatura ambiente (293 K) [J/kg]. */
export const RT = 287 * 293;
/** Densidade do ar nas condições de referência ANR [kg/m³]. */
export const RHO_ANR = 1.185;
/** Razão crítica típica de válvulas pneumáticas. */
export const B_DEFAULT = 0.3;
/** 1 bar em Pa. */
export const BAR = 1e5;

/**
 * Perto de Δp = 0 a curva da ISO 6358 fica vertical (derivada infinita),
 * o que atrapalha o solver. Acima desta razão usamos uma reta até zero.
 */
const R_LINEAR = 0.995;
const PHI_AT_LINEAR = (b: number) => Math.sqrt(1 - ((R_LINEAR - b) / (1 - b)) ** 2);

/** Vazão mássica [kg/s] de `pUp` para `pDown`, com pUp ≥ pDown. */
function forwardFlow(C: number, b: number, pUp: number, pDown: number): number {
  if (pUp <= 0) return 0;
  const r = pDown / pUp;
  const choked = C * pUp * RHO_ANR;
  if (r <= b) return choked;
  if (r < R_LINEAR) return choked * Math.sqrt(1 - ((r - b) / (1 - b)) ** 2);
  return (choked * PHI_AT_LINEAR(b) * (1 - r)) / (1 - R_LINEAR);
}

/** Vazão mássica [kg/s] de a para b (negativa quando o ar vai de b para a). */
export function orificeFlow(C: number, pa: number, pb: number, b = B_DEFAULT): number {
  if (C <= 0) return 0;
  return pa >= pb ? forwardFlow(C, b, pa, pb) : -forwardFlow(C, b, pb, pa);
}

/**
 * Converte vazão nominal (l/min ANR, a 6 bar com queda de 1 bar — como nos catálogos)
 * em condutância sônica C.
 */
export function conductanceFromNominal(qnLmin: number, b = B_DEFAULT): number {
  const p1 = 6 * BAR + P_ATM;
  const p2 = 5 * BAR + P_ATM;
  const phi = Math.sqrt(1 - ((p2 / p1 - b) / (1 - b)) ** 2);
  return qnLmin / 60_000 / (p1 * phi);
}

/** kg/s → l/min nas condições ANR (unidade usada na tela). */
export const massToLmin = (kgPerS: number) => (kgPerS / RHO_ANR) * 60_000;

/** Pa absoluto → bar manométrico (o que o manômetro mostra). */
export const toBarGauge = (pAbs: number) => (pAbs - P_ATM) / BAR;
export const fromBarGauge = (bar: number) => bar * BAR + P_ATM;
