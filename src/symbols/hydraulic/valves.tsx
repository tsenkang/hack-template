import { makeValveDef } from "../valve";

/** 4/2 com solenoide e mola: em repouso P→B e A→T. */
export const hydValve42solenoid = makeValveDef({
  type: "hyd.valve.4-2.solenoid-spring",
  domain: "hydraulic",
  category: "hyd-valves",
  ports: [
    { id: "A", x: 10, side: "top" },
    { id: "B", x: 30, side: "top" },
    { id: "P", x: 10, side: "bottom" },
    { id: "T", x: 30, side: "bottom" },
  ],
  squares: [
    { flows: [["P", "A"], ["B", "T"]], blocked: [] },
    { flows: [["P", "B"], ["A", "T"]], blocked: [] },
  ],
  restIndex: 1,
  left: "solenoid",
  right: "spring",
  keywords: ["direcional", "eletroválvula", "solenoide"],
});
