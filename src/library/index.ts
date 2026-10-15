/** Biblioteca de circuitos prontos (40+), agrupada por área. */
import { ELECTRO, PLC } from "./electro";
import { ELECTROHYDRAULIC, HYDRAULIC } from "./hydraulic";
import { PNEUMATIC } from "./pneumatic";
import type { LibraryCircuit } from "./types";

export const CIRCUITS: readonly LibraryCircuit[] = [...PNEUMATIC, ...ELECTRO, ...PLC, ...HYDRAULIC, ...ELECTROHYDRAULIC];

export function getCircuit(id: string) {
  return CIRCUITS.find((c) => c.id === id);
}
