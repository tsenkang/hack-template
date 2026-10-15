/**
 * Passos do diagrama trajeto-passo: um novo passo começa sempre que algum cilindro
 * sai do repouso depois de todos terem parado numa posição final.
 */
export function stepStarts(t: number[], series: number[][], eps = 0.002): number[] {
  const starts: number[] = [];
  let allStill = true;
  for (let i = 1; i < t.length; i++) {
    const moving = series.some((s) => Math.abs(s[i] - s[i - 1]) > eps);
    if (moving && allStill) starts.push(t[i - 1]);
    allStill = !moving;
  }
  return starts;
}
