/**
 * Resolve A·x = b por eliminação de Gauss com pivotamento parcial.
 * A (n×n, linha a linha) e b são sobrescritos; a solução fica em b.
 * Para os circuitos didáticos (dezenas de redes) uma matriz densa é rápida o bastante.
 */
export function solveDense(A: Float64Array, b: Float64Array, n: number): boolean {
  for (let col = 0; col < n; col++) {
    let pivot = col;
    let best = Math.abs(A[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > best) {
        best = v;
        pivot = r;
      }
    }
    if (best < 1e-300) return false;
    if (pivot !== col) {
      for (let k = col; k < n; k++) {
        const tmp = A[col * n + k];
        A[col * n + k] = A[pivot * n + k];
        A[pivot * n + k] = tmp;
      }
      const tb = b[col];
      b[col] = b[pivot];
      b[pivot] = tb;
    }
    const d = A[col * n + col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / d;
      if (f === 0) continue;
      for (let k = col; k < n; k++) A[r * n + k] -= f * A[col * n + k];
      b[r] -= f * b[col];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r * n + k] * b[k];
    b[r] = s / A[r * n + r];
  }
  return true;
}
