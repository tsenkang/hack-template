import { makeCylinderDef } from "../cylinder";
import type { ComponentDef, SymbolProps } from "../types";

export const cylinderCushioned = makeCylinderDef({
  type: "pneu.cylinder.cushioned",
  domain: "pneumatic",
  category: "pneu-actuators",
  singleActing: false,
  variant: "cushioned",
  defaults: { piston: 40, rod: 16, stroke: 160, maxPressure: 10 },
  keywords: ["amortecimento", "colchão de ar", "dupla ação"],
});

export const cylinderThroughRod = makeCylinderDef({
  type: "pneu.cylinder.through-rod",
  domain: "pneumatic",
  category: "pneu-actuators",
  singleActing: false,
  variant: "through-rod",
  defaults: { piston: 32, rod: 12, stroke: 100, maxPressure: 10 },
  keywords: ["haste dupla", "haste passante", "duas hastes"],
});

export const cylinderRodless = makeCylinderDef({
  type: "pneu.cylinder.rodless",
  domain: "pneumatic",
  category: "pneu-actuators",
  singleActing: false,
  variant: "rodless",
  defaults: { piston: 25, rod: 3, stroke: 300, maxPressure: 8 },
  keywords: ["sem haste", "carro", "rodless", "acoplamento magnético"],
});

export const gripper = makeCylinderDef({
  type: "pneu.gripper",
  domain: "pneumatic",
  category: "pneu-actuators",
  singleActing: false,
  variant: "gripper",
  defaults: { piston: 16, rod: 6, stroke: 10, maxPressure: 8 },
  keywords: ["garra", "pinça", "gripper", "pegador"],
});

function MotorSymbol({ state }: SymbolProps) {
  const angle = ((state?.angle ?? 0) * Math.PI) / 180;
  return (
    <g>
      <path className="sym" d="M30 0 V12 M30 38 V50" />
      <circle className="sym sym-bg" cx={30} cy={25} r={13} />
      {/* triângulos vazados apontando para dentro: motor pneumático, dois sentidos */}
      <polygon className="sym sym-bg" points="30,20 26,13 34,13" />
      <polygon className="sym sym-bg" points="30,30 26,37 34,37" />
      {/* eixo e marca que gira */}
      <path className="sym" d="M43 23 H54 M43 27 H54" />
      <line className="sym" x1={30} y1={25} x2={30 + 7 * Math.cos(angle)} y2={25 + 7 * Math.sin(angle)} />
      {state?.rpm !== undefined && Math.abs(state.rpm) > 1 && (
        <text className="sym-text" x={58} y={44} fontSize={8}>
          {Math.round(Math.abs(state.rpm))} rpm
        </text>
      )}
    </g>
  );
}

/** Motor pneumático: gira para um lado com ar em 1 e para o outro com ar em 2. */
export const airMotor: ComponentDef = {
  type: "pneu.motor",
  domain: "pneumatic",
  category: "pneu-actuators",
  labelPrefix: "A",
  width: 60,
  height: 50,
  ports: [
    { id: "1", x: 30, y: 50, kind: "pneumatic" },
    { id: "2", x: 30, y: 0, kind: "pneumatic" },
  ],
  params: [
    { key: "displacement", type: "number", unit: "cm³/rot", default: 20, min: 1, max: 1000 },
    { key: "nominalFlow", type: "number", unit: "l/min", default: 300, min: 10, max: 5000, step: 10 },
  ],
  keywords: ["motor", "rotativo", "parafusadeira"],
  sim: { kind: "air-motor" },
  Symbol: MotorSymbol,
};

/** Gerador de vácuo (ejetor Venturi): ar em 1 gera vácuo em 2 e sai por 3. */
export const vacuumGenerator: ComponentDef = {
  type: "pneu.vacuum.generator",
  domain: "pneumatic",
  category: "pneu-actuators",
  labelPrefix: "V",
  width: 60,
  height: 40,
  ports: [
    { id: "1", x: 0, y: 30, kind: "pneumatic" },
    { id: "2", x: 30, y: 0, kind: "pneumatic" },
    { id: "3", x: 60, y: 30, kind: "pneumatic", exhaust: true },
  ],
  params: [],
  keywords: ["vácuo", "ejetor", "venturi"],
  sim: { kind: "vacuum-generator" },
  Symbol: () => (
    <g>
      <path className="sym" d="M0 30 H10 M50 30 H60 M30 0 V20" />
      <rect className="sym sym-bg" x={10} y={20} width={40} height={20} />
      {/* bocal convergente-divergente */}
      <path className="sym" d="M12 24 L26 29 L34 29 L48 24 M12 36 L26 31 L34 31 L48 36" />
    </g>
  ),
};

/** Ventosa: segura a peça quando há vácuo suficiente. */
export const suctionCup: ComponentDef = {
  type: "pneu.vacuum.cup",
  domain: "pneumatic",
  category: "pneu-actuators",
  labelPrefix: "A",
  width: 40,
  height: 30,
  ports: [{ id: "1", x: 20, y: 0, kind: "pneumatic" }],
  params: [],
  keywords: ["ventosa", "vácuo", "pega"],
  sim: { kind: "suction-cup" },
  Symbol: ({ state }) => (
    <g>
      <line className="sym" x1={20} y1={0} x2={20} y2={12} />
      <path className="sym sym-bg" d="M14 12 H26 L32 24 H8 Z" />
      {/* peça presa pela ventosa */}
      {state?.holding && <rect className="sym-solid" x={4} y={25} width={32} height={4} />}
    </g>
  ),
};
