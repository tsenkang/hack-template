/** Programas de exemplo para o CLP (o professor carrega e os alunos estudam/modificam). */
import type { PlcProgram } from "@/engine/logic/plc";

export const PLC_EXAMPLES: { id: string; program: PlcProgram }[] = [
  {
    id: "seal",
    program: {
      rungs: [{ condition: "(I0 | Q0) & I1", coil: "out", target: "Q0", comment: "selo: I0 liga, I1 (NF) desliga" }],
      steps: [],
      transitions: [],
    },
  },
  {
    id: "timer",
    program: {
      rungs: [
        { condition: "I0", coil: "ton", target: "T0", preset: 3 },
        { condition: "T0", coil: "out", target: "Q0" },
      ],
      steps: [],
      transitions: [],
    },
  },
  {
    id: "counter",
    program: {
      rungs: [
        { condition: "I0", coil: "ctu", target: "C0", preset: 3 },
        { condition: "C0", coil: "out", target: "Q0" },
        { condition: "I1", coil: "ctr", target: "C0" },
      ],
      steps: [],
      transitions: [],
    },
  },
  {
    id: "abba",
    program: {
      rungs: [],
      steps: [
        { n: 0, initial: true, actions: "" },
        { n: 1, actions: "Q0" },
        { n: 2, actions: "Q2" },
        { n: 3, actions: "Q3" },
        { n: 4, actions: "Q1" },
      ],
      transitions: [
        { from: [0], to: [1], condition: "I0 & I1 & I3" },
        { from: [1], to: [2], condition: "I2" },
        { from: [2], to: [3], condition: "I4" },
        { from: [3], to: [4], condition: "I3" },
        { from: [4], to: [0], condition: "I1" },
      ],
    },
  },
];
