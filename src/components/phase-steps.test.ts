import { describe, expect, it } from "vitest";
import { stepStarts } from "./phase-steps";

describe("passos do diagrama de fases", () => {
  it("A+ e depois B+: dois passos", () => {
    const t = [0, 1, 2, 3, 4, 5, 6];
    const a = [0, 0.5, 1, 1, 1, 1, 1];
    const b = [0, 0, 0, 0, 0.5, 1, 1];
    expect(stepStarts(t, [a, b])).toEqual([0, 3]);
  });
});
