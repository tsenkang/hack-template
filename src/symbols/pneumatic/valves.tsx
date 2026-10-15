import { makeValveDef, type ValvePort } from "../valve";

const PORTS_3_2: ValvePort[] = [
  { id: "2", x: 10, side: "top" },
  { id: "1", x: 10, side: "bottom" },
  { id: "3", x: 30, side: "bottom" },
];

const PORTS_5_2: ValvePort[] = [
  { id: "4", x: 10, side: "top" },
  { id: "2", x: 30, side: "top" },
  { id: "5", x: 10, side: "bottom" },
  { id: "1", x: 20, side: "bottom" },
  { id: "3", x: 30, side: "bottom" },
];

/** 3/2 NF: em repouso a via 1 está bloqueada e 2 escapa por 3. */
const SQUARES_3_2_NC = [
  { flows: [["1", "2"]], blocked: ["3"] },
  { flows: [["2", "3"]], blocked: ["1"] },
] as const;

/** 3/2 NA: em repouso a via 1 alimenta 2. */
const SQUARES_3_2_NO = [
  { flows: [["2", "3"]], blocked: ["1"] },
  { flows: [["1", "2"]], blocked: ["3"] },
] as const;

/** 5/2: à esquerda 1→4 e 2→3; à direita 1→2 e 4→5. */
const SQUARES_5_2 = [
  { flows: [["1", "4"], ["2", "3"]], blocked: [] },
  { flows: [["1", "2"], ["4", "5"]], blocked: [] },
] as const;

export const valve32ncButton = makeValveDef({
  type: "pneu.valve.3-2-nc.button-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_3_2,
  squares: SQUARES_3_2_NC,
  restIndex: 1,
  left: "button",
  right: "spring",
  keywords: ["botão", "normalmente fechada", "nf", "start"],
});

export const valve32noButton = makeValveDef({
  type: "pneu.valve.3-2-no.button-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_3_2,
  squares: SQUARES_3_2_NO,
  restIndex: 1,
  left: "button",
  right: "spring",
  keywords: ["botão", "normalmente aberta", "na"],
});

export const valve32ncRoller = makeValveDef({
  type: "pneu.valve.3-2-nc.roller-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_3_2,
  squares: SQUARES_3_2_NC,
  restIndex: 1,
  left: "roller",
  right: "spring",
  keywords: ["rolete", "fim de curso", "sensor"],
});

export const valve32ncLever = makeValveDef({
  type: "pneu.valve.3-2-nc.lever-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_3_2,
  squares: SQUARES_3_2_NC,
  restIndex: 1,
  left: "lever",
  right: "spring",
  keywords: ["alavanca", "manual"],
});

export const valve32ncPilot = makeValveDef({
  type: "pneu.valve.3-2-nc.pilot-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_3_2,
  squares: SQUARES_3_2_NC,
  restIndex: 1,
  left: "pilot",
  right: "spring",
  pilotIds: { left: "12" },
  keywords: ["piloto", "comando indireto", "amplificadora"],
});

export const valve52pilot = makeValveDef({
  type: "pneu.valve.5-2.pilot-pilot",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_5_2,
  squares: SQUARES_5_2,
  restIndex: 1,
  left: "pilot",
  right: "pilot",
  pilotIds: { left: "14", right: "12" },
  keywords: ["memória", "biestável", "duplo piloto"],
});

export const valve52pilotSpring = makeValveDef({
  type: "pneu.valve.5-2.pilot-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_5_2,
  squares: SQUARES_5_2,
  restIndex: 1,
  left: "pilot",
  right: "spring",
  pilotIds: { left: "14" },
  keywords: ["monoestável", "piloto"],
});

export const valve52solenoidSpring = makeValveDef({
  type: "pneu.valve.5-2.solenoid-spring",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_5_2,
  squares: SQUARES_5_2,
  restIndex: 1,
  left: "solenoid",
  right: "spring",
  keywords: ["solenoide", "eletroválvula", "bobina", "eletropneumática"],
});

export const valve52solenoidSolenoid = makeValveDef({
  type: "pneu.valve.5-2.solenoid-solenoid",
  domain: "pneumatic",
  category: "pneu-directional",
  ports: PORTS_5_2,
  squares: SQUARES_5_2,
  restIndex: 1,
  left: "solenoid",
  right: "solenoid",
  keywords: ["solenoide", "eletroválvula", "duplo solenoide", "memória"],
});
