/** Válvulas direcionais hidráulicas (2/2, 3/2, 4/2, 4/3 com quatro centros) e proporcionais. */
import { Arrow } from "../draw";
import type { ComponentDef, SymbolProps } from "../types";
import { makeValveDef, type ValvePort, type ValveSquare } from "../valve";

const PORTS_4: ValvePort[] = [
  { id: "A", x: 10, side: "top" },
  { id: "B", x: 30, side: "top" },
  { id: "P", x: 10, side: "bottom" },
  { id: "T", x: 30, side: "bottom" },
];

/** Posições externas da 4/x: à esquerda P→A e B→T; à direita P→B e A→T (cruzado). */
const SIDE_A: ValveSquare = { flows: [["P", "A"], ["B", "T"]], blocked: [] };
const SIDE_B: ValveSquare = { flows: [["P", "B"], ["A", "T"]], blocked: [] };

const base = { domain: "hydraulic", category: "hyd-valves" } as const;

/** 4/2 com solenoide e mola: em repouso P→B e A→T. */
export const hydValve42solenoid = makeValveDef({
  ...base,
  type: "hyd.valve.4-2.solenoid-spring",
  ports: PORTS_4,
  squares: [SIDE_A, SIDE_B],
  restIndex: 1,
  left: "solenoid",
  right: "spring",
  keywords: ["direcional", "eletroválvula", "solenoide", "4/2"],
});

export const hydValve42lever = makeValveDef({
  ...base,
  type: "hyd.valve.4-2.lever-detent",
  ports: PORTS_4,
  squares: [SIDE_A, SIDE_B],
  restIndex: 1,
  left: "lever-detent",
  right: "detent",
  keywords: ["direcional", "alavanca", "trava", "manual", "4/2"],
});

export const hydValve22button = makeValveDef({
  ...base,
  type: "hyd.valve.2-2.button-spring",
  ports: [
    { id: "A", x: 20, side: "top" },
    { id: "P", x: 20, side: "bottom" },
  ],
  squares: [
    { flows: [["P", "A"]], blocked: [] },
    { flows: [], blocked: ["P", "A"] },
  ],
  restIndex: 1,
  left: "button",
  right: "spring",
  keywords: ["2/2", "bloqueio", "registro"],
});

export const hydValve32solenoid = makeValveDef({
  ...base,
  type: "hyd.valve.3-2.solenoid-spring",
  ports: [
    { id: "A", x: 10, side: "top" },
    { id: "P", x: 10, side: "bottom" },
    { id: "T", x: 30, side: "bottom" },
  ],
  squares: [
    { flows: [["P", "A"]], blocked: ["T"] },
    { flows: [["A", "T"]], blocked: ["P"] },
  ],
  restIndex: 1,
  left: "solenoid",
  right: "spring",
  keywords: ["3/2", "simples ação", "solenoide"],
});

/** 4/3 centrada por molas, acionada por solenoides, com o centro escolhido. */
function valve43(type: string, center: ValveSquare, keywords: string[]) {
  return makeValveDef({
    ...base,
    type,
    ports: PORTS_4,
    squares: [SIDE_A, center, SIDE_B],
    restIndex: 1,
    left: "solenoid",
    right: "solenoid",
    springCentered: true,
    keywords: ["4/3", "três posições", "solenoide", ...keywords],
  });
}

export const hydValve43closed = valve43("hyd.valve.4-3-closed.solenoid", { flows: [], blocked: ["A", "B", "P", "T"] }, [
  "centro fechado",
  "parada",
]);
export const hydValve43open = valve43(
  "hyd.valve.4-3-open.solenoid",
  { flows: [["P", "T"], ["A", "T"], ["B", "T"]], blocked: [] },
  ["centro aberto", "todas ligadas"],
);
export const hydValve43tandem = valve43("hyd.valve.4-3-tandem.solenoid", { flows: [["P", "T"]], blocked: ["A", "B"] }, [
  "centro tandem",
  "bomba aliviada",
  "economia",
]);
export const hydValve43float = valve43("hyd.valve.4-3-float.solenoid", { flows: [["A", "T"], ["B", "T"]], blocked: ["P"] }, [
  "centro flutuante",
  "centro em H",
  "cilindro solto",
]);

/** 4/3 manual: alavanca dos dois lados, centrada por molas (centro fechado). */
export const hydValve43lever = makeValveDef({
  ...base,
  type: "hyd.valve.4-3-closed.lever",
  ports: PORTS_4,
  squares: [SIDE_A, { flows: [], blocked: ["A", "B", "P", "T"] }, SIDE_B],
  restIndex: 1,
  left: "lever",
  right: "lever",
  springCentered: true,
  keywords: ["4/3", "alavanca", "manual", "comando de máquina"],
});

/**
 * Válvula proporcional (ou servoválvula) 4/3: o desenho é o de uma 4/3 de centro fechado,
 * com as linhas paralelas que indicam posicionamento contínuo; o motor é próprio.
 */
function proportional(type: string, servo: boolean, keywords: string[]): ComponentDef {
  const def = makeValveDef({
    ...base,
    type,
    ports: PORTS_4,
    squares: [SIDE_A, { flows: [], blocked: ["A", "B", "P", "T"] }, SIDE_B],
    restIndex: 1,
    left: "solenoid",
    right: "solenoid",
    springCentered: true,
    keywords: ["proporcional", ...keywords],
  });
  const Valve = def.Symbol;
  function ProportionalSymbol(props: SymbolProps) {
    return (
      <g>
        <Valve {...props} />
        {/* linhas paralelas acima e abaixo: posicionamento contínuo */}
        <path className="sym" d={`M50 6 H${def.width - 50} M50 54 H${def.width - 50}`} />
        {/* seta de proporcional atravessando os solenoides */}
        <Arrow from={[14, 40]} to={[36, 20]} head={3} />
        <Arrow from={[def.width - 36, 40]} to={[def.width - 14, 20]} head={3} />
      </g>
    );
  }
  ProportionalSymbol.displayName = `Proportional(${type})`;
  return {
    ...def,
    labelPrefix: "V",
    params: [
      { key: "command", type: "number", unit: "%", default: 0, min: -100, max: 100, step: 5 },
      { key: "nominalFlow", type: "number", unit: "l/min", default: 30, min: 1, max: 1000 },
    ],
    interactive: false,
    sim: { kind: "proportional-valve", servo },
    Symbol: ProportionalSymbol,
  };
}

export const hydProportional = proportional("hyd.valve.proportional", false, ["controle contínuo", "velocidade"]);
export const hydServo = proportional("hyd.valve.servo", true, ["servoválvula", "malha fechada", "precisão"]);
