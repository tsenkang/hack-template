import { makeCylinderDef } from "../cylinder";

/** Cilindro hidráulico de dupla ação (diferencial). */
export const hydCylinderDouble = makeCylinderDef({
  type: "hyd.cylinder.double-acting",
  domain: "hydraulic",
  category: "hyd-actuators",
  singleActing: false,
  defaults: { piston: 40, rod: 22, stroke: 200, maxPressure: 210 },
  keywords: ["atuador", "duplo efeito", "diferencial"],
});
