/**
 * Registro de todas as peças disponíveis na biblioteca.
 * Para adicionar uma peça nova: crie o arquivo do símbolo e inclua-o na lista abaixo.
 */
import * as electricOutputs from "./electric/outputs";
import * as electricProtection from "./electric/protection";
import * as electricSupply from "./electric/supply";
import * as electricSwitches from "./electric/switches";
import * as hydCylinders from "./hydraulic/cylinders";
import { pumpFixed } from "./hydraulic/pump";
import { reliefValve } from "./hydraulic/relief-valve";
import { tank } from "./hydraulic/tank";
import * as hydValves from "./hydraulic/valves";
import * as pneuActuatorsExtra from "./pneumatic/actuators-extra";
import { airSource } from "./pneumatic/air-source";
import { checkValve } from "./pneumatic/check-valve";
import * as pneuCylinders from "./pneumatic/cylinders";
import { flowControlOneWay } from "./pneumatic/flow-control";
import { junction } from "./pneumatic/junction";
import * as pneuLogic from "./pneumatic/logic-valves";
import * as pneuPressure from "./pneumatic/pressure-valves";
import { pressureGauge } from "./pneumatic/pressure-gauge";
import { serviceUnit } from "./pneumatic/service-unit";
import * as pneuSignal from "./pneumatic/signal";
import { silencer } from "./pneumatic/silencer";
import * as pneuSupplyExtra from "./pneumatic/supply-extra";
import * as pneuValves from "./pneumatic/valves";
import type { ComponentDef, ParamDef } from "./types";
import type { ParamValue } from "@/engine/core/types";

export const COMPONENT_DEFS: readonly ComponentDef[] = [
  airSource,
  ...Object.values(pneuSupplyExtra),
  serviceUnit,
  pressureGauge,
  silencer,
  junction,
  ...Object.values(pneuCylinders),
  ...Object.values(pneuActuatorsExtra),
  ...Object.values(pneuValves),
  checkValve,
  flowControlOneWay,
  ...Object.values(pneuLogic),
  ...Object.values(pneuPressure),
  ...Object.values(pneuSignal),
  pumpFixed,
  tank,
  ...Object.values(hydCylinders),
  reliefValve,
  ...Object.values(hydValves),
  ...Object.values(electricSupply),
  ...Object.values(electricSwitches),
  ...Object.values(electricOutputs),
  ...Object.values(electricProtection),
];

const BY_TYPE = new Map(COMPONENT_DEFS.map((d) => [d.type, d]));

export function getDef(type: string): ComponentDef | undefined {
  return BY_TYPE.get(type);
}

/** Valores iniciais dos parâmetros de uma peça nova. */
export function defaultParams(def: ComponentDef): Record<string, ParamValue> {
  return Object.fromEntries(def.params.map((p: ParamDef) => [p.key, p.default]));
}
