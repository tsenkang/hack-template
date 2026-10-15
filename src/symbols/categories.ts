import type { Domain } from "@/engine/core/types";

/** Categorias da biblioteca, na ordem em que aparecem. O nome vem do i18n (`categories.<id>`). */
export const CATEGORIES = [
  { id: "pneu-supply", domain: "pneumatic" },
  { id: "pneu-actuators", domain: "pneumatic" },
  { id: "pneu-directional", domain: "pneumatic" },
  { id: "pneu-flow-check", domain: "pneumatic" },
  { id: "pneu-pressure", domain: "pneumatic" },
  { id: "pneu-signal", domain: "pneumatic" },
  { id: "hyd-supply", domain: "hydraulic" },
  { id: "hyd-actuators", domain: "hydraulic" },
  { id: "hyd-valves", domain: "hydraulic" },
  { id: "elec-supply", domain: "electric" },
  { id: "elec-switches", domain: "electric" },
  { id: "elec-outputs", domain: "electric" },
] as const satisfies readonly { id: string; domain: Domain }[];

export type CategoryId = (typeof CATEGORIES)[number]["id"];
