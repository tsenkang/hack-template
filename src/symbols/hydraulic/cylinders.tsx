import { makeCylinderDef } from "../cylinder";

/** Cilindro hidráulico de simples ação (retorno por mola ou pelo peso da carga). */
export const hydCylinderSingle = makeCylinderDef({
  type: "hyd.cylinder.single-acting",
  domain: "hydraulic",
  category: "hyd-actuators",
  singleActing: true,
  defaults: { piston: 40, rod: 22, stroke: 200, maxPressure: 210 },
  keywords: ["atuador", "simples efeito", "macaco", "elevador"],
});

/** Cilindro hidráulico de dupla ação (diferencial). */
export const hydCylinderDouble = makeCylinderDef({
  type: "hyd.cylinder.double-acting",
  domain: "hydraulic",
  category: "hyd-actuators",
  singleActing: false,
  defaults: { piston: 40, rod: 22, stroke: 200, maxPressure: 210 },
  keywords: ["atuador", "duplo efeito", "diferencial"],
});

/** Cilindro hidráulico com amortecimento de fim de curso. */
export const hydCylinderCushioned = makeCylinderDef({
  type: "hyd.cylinder.cushioned",
  domain: "hydraulic",
  category: "hyd-actuators",
  singleActing: false,
  variant: "cushioned",
  defaults: { piston: 50, rod: 28, stroke: 300, maxPressure: 210 },
  keywords: ["atuador", "amortecimento", "fim de curso suave"],
});

/** Cilindro hidráulico de haste dupla (mesma velocidade nos dois sentidos). */
export const hydCylinderThroughRod = makeCylinderDef({
  type: "hyd.cylinder.through-rod",
  domain: "hydraulic",
  category: "hyd-actuators",
  singleActing: false,
  variant: "through-rod",
  defaults: { piston: 40, rod: 22, stroke: 200, maxPressure: 210 },
  keywords: ["haste dupla", "haste passante", "direção"],
});
