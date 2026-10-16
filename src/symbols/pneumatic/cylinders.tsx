import { makeCylinderDef } from "../cylinder";

/** Cilindro de simples ação com retorno por mola. */
export const cylinderSingle = makeCylinderDef({
  type: "pneu.cylinder.single-acting",
  domain: "pneumatic",
  category: "pneu-actuators",
  singleActing: true,
  defaults: { piston: 25, rod: 10, stroke: 50, maxPressure: 10 },
  keywords: ["atuador", "mola", "simples efeito"],
});

/** Cilindro de dupla ação. */
export const cylinderDouble = makeCylinderDef({
  type: "pneu.cylinder.double-acting",
  domain: "pneumatic",
  category: "pneu-actuators",
  singleActing: false,
  defaults: { piston: 32, rod: 12, stroke: 100, maxPressure: 10 },
  keywords: ["atuador", "duplo efeito"],
});
