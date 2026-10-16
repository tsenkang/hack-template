/** Circuitos prontos de eletropneumática e de CLP. */
import { serializeProgram, type PlcProgram } from "@/engine/logic/plc";
import { Builder } from "./builder";
import { press } from "./scenario";
import type { LibraryCircuit } from "./types";

const DA = "pneu.cylinder.double-acting";
const SRC = "pneu.source.air";
const NO = "elec.pushbutton.no";
const NC = "elec.pushbutton.nc";
const COIL = "elec.solenoid.coil";
const RELAY = "elec.relay.coil";
const K_NO = "elec.relay.contact-no";
const K_NC = "elec.relay.contact-nc";
const REED = "elec.sensor.reed";
const V_SS = "pneu.valve.5-2.solenoid-spring";
const V_DS = "pneu.valve.5-2.solenoid-solenoid";

/** Parte pneumática: um cilindro A1 e uma válvula de solenoide V1. */
function power(b: Builder, valveType: string, label = "A1", x = 160) {
  const cyl = b.add(DA, x + 40, 0, { label, params: { stroke: 100 } });
  const valve = b.add(valveType, x, 130, { label: "V1", params: { solenoidLeft: "Y1", ...(valveType === V_DS ? { solenoidRight: "Y2" } : {}) } });
  const src = b.add(SRC, x + 170, 260, { label: "P1" });
  b.wire(cyl, "A", valve, "4").wire(cyl, "B", valve, "2").wire(src, "1", valve, "1");
  return { cyl, valve, src };
}

/**
 * Esquema em escada: barramento +24 V em cima, 0 V embaixo, um "degrau" por coluna.
 * `rungs[i]` = peças de cima para baixo na coluna i (a última costuma ser a bobina).
 */
class Ladder {
  readonly plus: string;
  readonly zero: string;
  constructor(
    private readonly b: Builder,
    private readonly x0 = 0,
    private readonly bottom = 360,
  ) {
    this.plus = b.add("elec.supply.24v", x0 - 80, 0);
    this.zero = b.add("elec.supply.0v", x0 - 80, bottom);
  }
  /** Coloca uma peça na coluna `col`, linha `row` (0 = logo abaixo do +24 V). */
  at(type: string, col: number, row: number, label: string, params = {}) {
    return this.b.add(type, this.x0 + col * 90, 50 + row * 90, { label, params });
  }
  /** Liga a série de cima para baixo: +24 V → peças → 0 V. */
  series(parts: string[], fromPlus = true, toZero = true) {
    const ports = (id: string, end: "top" | "bottom") => this.terminal(id, end);
    if (fromPlus) this.b.wire(this.plus, "+", parts[0], ports(parts[0], "top"));
    for (let i = 1; i < parts.length; i++) this.b.wire(parts[i - 1], ports(parts[i - 1], "bottom"), parts[i], ports(parts[i], "top"));
    if (toZero) this.b.wire(parts[parts.length - 1], ports(parts[parts.length - 1], "bottom"), this.zero, "0");
  }
  private terminal(id: string, end: "top" | "bottom") {
    const comp = this.b.project.circuits.flatMap((c) => c.components).find((c) => c.id === id)!;
    if (comp.type.includes("coil") || comp.type.includes("timer") || comp.type.includes("counter")) return end === "top" ? "A1" : "A2";
    if (comp.type === "elec.lamp") return end === "top" ? "X1" : "X2";
    return end === "top" ? "1" : "2";
  }
}

export const ELECTRO: LibraryCircuit[] = [
  {
    id: "e-direct",
    area: "electropneumatic",
    level: 1,
    title: "Eletropneumática: comando direto",
    summary: "O botão S1 liga direto o solenoide Y1 da válvula V1.",
    steps: [
      "Abra a aba “Comando elétrico”: S1 liga o +24 V à bobina Y1.",
      "Segure S1: passa corrente (traços vermelhos animados), Y1 energiza e V1 avança o cilindro.",
      "Solte: Y1 desliga e a mola de V1 recolhe a haste.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_SS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at(NO, 0, 0, "S1"), l.at(COIL, 0, 2, "Y1")]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 1.5), duration: 3.5, expect: "A1+ A1-" },
  },
  {
    id: "e-indirect",
    area: "electropneumatic",
    level: 1,
    title: "Eletropneumática: comando indireto com relé",
    summary: "S1 energiza o relé K1; o contato de K1 liga o solenoide Y1.",
    steps: [
      "Degrau 1: S1 → bobina K1. Degrau 2: contato NA de K1 → solenoide Y1.",
      "Segure S1: K1 atraca e fecha o contato do degrau 2; Y1 energiza e a haste avança.",
      "O relé separa o comando (baixa corrente) da carga e permite usar um botão para várias saídas.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_SS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at(NO, 0, 0, "S1"), l.at(RELAY, 0, 2, "K1")]);
      l.series([l.at(K_NO, 1, 0, "K1"), l.at(COIL, 1, 2, "Y1")]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 1.5), duration: 3.5, expect: "A1+ A1-" },
  },
  {
    id: "e-seal",
    area: "electropneumatic",
    level: 1,
    title: "Selo (autorretenção) com liga e desliga",
    summary: "Um toque em S1 liga e o contato de K1 “sela” a bobina. S0 (NF) desliga.",
    steps: [
      "Toque S1: K1 energiza e o contato K1 em paralelo com S1 mantém a corrente mesmo depois de soltar.",
      "O contato K1 do degrau 2 mantém Y1 ligado: a haste fica avançada.",
      "Toque S0: o circuito abre, K1 cai e a haste recua. Em série com o selo, S0 tem prioridade.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_SS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      const s0 = l.at(NC, 0, 0, "S0");
      const s1 = l.at(NO, 0, 1, "S1");
      const k1s = l.at(K_NO, 1, 1, "K1");
      const k1 = l.at(RELAY, 0, 2, "K1");
      l.series([s0], true, false);
      b.wire(s0, "2", s1, "1").wire(s0, "2", k1s, "1").wire(s1, "2", k1, "A1").wire(k1s, "2", k1, "A1").wire(k1, "A2", l.zero, "0");
      l.series([l.at(K_NO, 2, 1, "K1"), l.at(COIL, 2, 2, "Y1")]);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 0.2), ...press("S0", 2.5, 0.2)], duration: 4.5, expect: "A1+ A1-" },
  },
  {
    id: "e-auto-return",
    area: "electropneumatic",
    level: 1,
    title: "Retorno automático por fim de curso elétrico",
    summary: "Válvula de duplo solenoide: S1 liga Y1 (avanço) e o fim de curso S2 liga Y2 (retorno).",
    steps: [
      "Toque S1: Y1 comuta V1, que fica na posição (memória) e a haste avança.",
      "No fim do curso a haste fecha o fim de curso S2, ligado ao cilindro A1 pelo rótulo.",
      "S2 energiza Y2 e a haste volta.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_DS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at(NO, 0, 0, "S1"), l.at(COIL, 0, 2, "Y1")]);
      l.series([l.at("elec.limit.no", 1, 0, "S2", { cylinder: "A1", position: 100 }), l.at(COIL, 1, 2, "Y2")]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 3, expect: "A1+ A1-" },
  },
  {
    id: "e-continuous",
    area: "electropneumatic",
    level: 2,
    title: "Ciclo contínuo com sensores magnéticos",
    summary: "Com o botão com trava S1 ligado, os sensores B1 (recuado) e B2 (avançado) fazem o cilindro ir e voltar.",
    steps: [
      "Ligue S1 (botão com trava). Com a haste recuada, B1 está fechado: Y1 energiza e a haste avança.",
      "No fim, B2 fecha e energiza Y2: a haste volta. Em B1, o ciclo recomeça.",
      "Desligue S1 para parar quando a haste voltar.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_DS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at("elec.pushbutton.latching", 0, 0, "S1"), l.at(REED, 0, 1, "B1", { cylinder: "A1", position: 0 }), l.at(COIL, 0, 2, "Y1")]);
      l.series([l.at(REED, 1, 1, "B2", { cylinder: "A1", position: 100 }), l.at(COIL, 1, 2, "Y2")]);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 0.1), ...press("S1", 1.5, 0.1)], duration: 3, expect: Array(8).fill("A1+ A1-").join(" ") },
  },
  {
    id: "e-timer",
    area: "electropneumatic",
    level: 2,
    title: "Retorno temporizado com relé de tempo",
    summary: "A haste avança e espera 2 s no fim do curso antes de voltar.",
    steps: [
      "Toque S1: Y1 avança a haste.",
      "No fim, o sensor B2 energiza o relé temporizado K1 (veja o tempo enchendo no símbolo).",
      "Depois de 2 s, o contato de K1 fecha e liga Y2: a haste volta.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_DS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at(NO, 0, 0, "S1"), l.at(COIL, 0, 2, "Y1")]);
      l.series([l.at(REED, 1, 0, "B2", { cylinder: "A1", position: 100 }), l.at("elec.timer.on-delay", 1, 2, "K1", { delay: 2 })]);
      l.series([l.at(K_NO, 2, 0, "K1"), l.at(COIL, 2, 2, "Y2")]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4.5, expect: "A1+ A1-" },
  },
  {
    id: "e-counter",
    area: "electropneumatic",
    level: 3,
    title: "Contagem de ciclos com contador elétrico",
    summary: "S1 inicia o ciclo contínuo; depois de 3 ciclos o contador C1 para a máquina. S2 zera o contador.",
    steps: [
      "Toque S1: K1 sela (degrau 1) e o ciclo contínuo começa (degraus 2 e 3).",
      "Cada vez que a haste chega em B2, o contador C1 soma um (degrau 4).",
      "Em 3, o contato NF de C1 abre o selo: K1 cai e o cilindro para recuado.",
      "Toque S2 para zerar o contador e S1 para outra série.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_DS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      const s1 = l.at(NO, 0, 0, "S1");
      const k1s = l.at(K_NO, 1, 0, "K1");
      const c1 = l.at(K_NC, 0, 1, "C1");
      const k1 = l.at(RELAY, 0, 2, "K1");
      b.fan(l.plus, "+", [[s1, "1"], [k1s, "1"]]);
      b.wire(s1, "2", c1, "1").wire(k1s, "2", c1, "1").wire(c1, "2", k1, "A1").wire(k1, "A2", l.zero, "0");
      l.series([l.at(K_NO, 2, 0, "K1"), l.at(REED, 2, 1, "B1", { cylinder: "A1", position: 0 }), l.at(COIL, 2, 2, "Y1")]);
      const b2 = l.at(REED, 3, 1, "B2", { cylinder: "A1", position: 100 });
      l.series([b2, l.at(COIL, 3, 2, "Y2")]);
      const cc = l.at("elec.counter.coil", 4, 2, "C1", { preset: 3 });
      b.wire(b2, "2", cc, "A1").wire(cc, "A2", l.zero, "0");
      l.series([l.at(NO, 5, 0, "S2"), l.at("elec.counter.reset", 5, 2, "C1")]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A1+ A1- A1+ A1- A1+ A1-" },
  },
  {
    id: "e-ab-ba",
    area: "electropneumatic",
    level: 2,
    title: "Eletropneumática: A+ B+ A− B−",
    summary: "Dois cilindros com válvulas de duplo solenoide e quatro sensores.",
    steps: [
      "S1 em série com b0 (B recuado) liga Y1: A avança.",
      "a1 liga Y3 (B+), b1 liga Y2 (A−), a0 liga Y4 (B−).",
      "Acompanhe no diagrama de fases e no rastro do sinal (clique num fio).",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      const A = b.add(DA, 0, 0, { label: "A", params: { stroke: 100 } });
      const B = b.add(DA, 320, 0, { label: "B", params: { stroke: 100 } });
      const VA = b.add(V_DS, -40, 130, { label: "VA", params: { solenoidLeft: "Y1", solenoidRight: "Y2" } });
      const VB = b.add(V_DS, 280, 130, { label: "VB", params: { solenoidLeft: "Y3", solenoidRight: "Y4" } });
      const src = b.add(SRC, 220, 260, { label: "P1" });
      b.wire(A, "A", VA, "4").wire(A, "B", VA, "2").wire(B, "A", VB, "4").wire(B, "B", VB, "2");
      b.fan(src, "1", [[VA, "1"], [VB, "1"]]);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at(NO, 0, 0, "S1"), l.at(REED, 0, 1, "b0", { cylinder: "B", position: 0 }), l.at(COIL, 0, 2, "Y1")]);
      l.series([l.at(REED, 1, 1, "a1", { cylinder: "A", position: 100 }), l.at(COIL, 1, 2, "Y3")]);
      l.series([l.at(REED, 2, 1, "b1", { cylinder: "B", position: 100 }), l.at(COIL, 2, 2, "Y2")]);
      l.series([l.at(REED, 3, 1, "a0", { cylinder: "A", position: 0 }), l.at(COIL, 3, 2, "Y4")]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A+ B+ A- B-" },
  },
  {
    id: "e-jog-53",
    area: "electropneumatic",
    level: 2,
    title: "Comando por impulso com 5/3 e emergência",
    summary: "S1 avança e S2 recua enquanto estão apertados; soltando, a 5/3 de centro fechado para o cilindro. S0 é a emergência.",
    steps: [
      "Segure S1: Y1 energiza e a haste avança. Solte no meio: a válvula centraliza e a haste para onde está.",
      "Segure S2 para recuar.",
      "Aperte a emergência S0: ela trava aberta e corta os dois degraus. Clique de novo para destravar.",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      const cyl = b.add(DA, 220, 0, { label: "A1", params: { stroke: 200 } });
      const v = b.add("pneu.valve.5-3-closed.solenoid", 100, 130, { label: "V1", params: { solenoidLeft: "Y1", solenoidRight: "Y2" } });
      const src = b.add(SRC, 330, 260, { label: "P1" });
      b.wire(cyl, "A", v, "4").wire(cyl, "B", v, "2").wire(src, "1", v, "1");
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      const s0 = l.at("elec.pushbutton.emergency", 0, 0, "S0");
      l.series([s0], true, false);
      const s1 = l.at(NO, 0, 1, "S1");
      const s2 = l.at(NO, 1, 1, "S2");
      b.wire(s0, "2", s1, "1").wire(s0, "2", s2, "1");
      l.series([s1, l.at(COIL, 0, 2, "Y1")], false);
      l.series([s2, l.at(COIL, 1, 2, "Y2")], false);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 2.5), ...press("S2", 3.2, 2.5)], duration: 6, expect: "A1+ A1-" },
  },
  {
    id: "e-pressure-switch",
    area: "electropneumatic",
    level: 2,
    title: "Retorno por pressostato",
    summary: "O pressostato B1 mede a pressão na câmara de avanço: quando a haste encosta e a pressão passa de 5 bar, Y2 liga.",
    steps: [
      "Toque S1: Y1 avança a haste.",
      "No fim do curso a pressão sobe. Acima de 5 bar o contato do pressostato B1 fecha.",
      "B1 energiza Y2 e a haste volta. Útil para prensar com força garantida.",
    ],
    build() {
      const b = new Builder(this.title);
      const cyl = b.add(DA, 200, 0, { label: "A1", params: { stroke: 100 } });
      const v = b.add(V_DS, 160, 160, { label: "V1", params: { solenoidLeft: "Y1", solenoidRight: "Y2" } });
      const j = b.add("pneu.junction", 180, 90);
      const src = b.add(SRC, 330, 290, { label: "P1" });
      const ps = b.add("elec.pressure-switch", 640, 140, { label: "B1", params: { setPressure: 5 } });
      b.wire(cyl, "A", j, "1").wire(j, "3", v, "4").wire(cyl, "B", v, "2").wire(src, "1", v, "1");
      b.wire(j, "2", ps, "P");
      const plus = b.add("elec.supply.24v", 480, 0);
      const zero = b.add("elec.supply.0v", 480, 330);
      const s1 = b.add(NO, 540, 140, { label: "S1" });
      const y1 = b.add(COIL, 540, 240, { label: "Y1" });
      const y2 = b.add(COIL, 640, 240, { label: "Y2" });
      b.fan(plus, "+", [[s1, "1"], [ps, "1"]]);
      b.wire(s1, "2", y1, "A1").wire(ps, "2", y2, "A1").fan(zero, "0", [[y1, "A2"], [y2, "A2"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 3, expect: "A1+ A1-" },
  },
  {
    id: "e-two-hand",
    area: "electropneumatic",
    level: 1,
    title: "Bimanual elétrico",
    summary: "S1 e S2 em série: o solenoide só liga com os dois botões apertados.",
    steps: [
      "Segure só S1: o circuito continua aberto em S2.",
      "Segure os dois: Y1 energiza e a haste avança.",
      "Solte qualquer um: a haste volta. (Bimanuais reais também exigem os dois apertados quase ao mesmo tempo.)",
    ],
    build() {
      const b = new Builder(this.title, "Pneumática");
      power(b, V_SS);
      b.tab("Comando elétrico");
      const l = new Ladder(b);
      l.series([l.at(NO, 0, 0, "S1"), l.at(NO, 0, 1, "S2"), l.at(COIL, 0, 2, "Y1")]);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 1), ...press("S1", 2, 1.5), ...press("S2", 2, 1.5)], duration: 5, expect: "A1+ A1-" },
  },
];

/** CLP ligado a sensores e solenoides: monta a parte elétrica com o CLP no meio. */
function plcCircuit(title: string, program: PlcProgram, inputs: { label: string; type: string; params?: Record<string, string | number> }[], outputs: string[]) {
  const b = new Builder(title, "Comando (CLP)");
  const plus = b.add("elec.supply.24v", -80, 0);
  const zero = b.add("elec.supply.0v", -80, 400);
  const plc = b.add("elec.plc", 0, 180, { label: "CLP1", params: { program: serializeProgram(program) } });
  b.wire(plus, "+", plc, "L+").wire(plc, "M", zero, "0");
  inputs.forEach((inp, k) => {
    const sw = b.add(inp.type, 20 + k * 20 + k * 40, 60, { label: inp.label, params: inp.params });
    b.wire(plus, "+", sw, "1").wire(sw, "2", plc, `I${k}`);
  });
  outputs.forEach((label, k) => {
    const y = b.add(COIL, 20 + k * 60, 300, { label });
    b.wire(plc, `Q${k}`, y, "A1").wire(y, "A2", zero, "0");
  });
  return b;
}

const ABBA: PlcProgram = {
  rungs: [],
  steps: [
    { n: 0, initial: true, actions: "" },
    { n: 1, actions: "Q0" },
    { n: 2, actions: "Q2" },
    { n: 3, actions: "Q3" },
    { n: 4, actions: "Q1" },
  ],
  transitions: [
    { from: [0], to: [1], condition: "I0 & I1 & I3" },
    { from: [1], to: [2], condition: "I2" },
    { from: [2], to: [3], condition: "I4" },
    { from: [3], to: [4], condition: "I3" },
    { from: [4], to: [0], condition: "I1" },
  ],
};

export const PLC: LibraryCircuit[] = [
  {
    id: "c-seal",
    area: "plc",
    level: 1,
    title: "CLP: selo em ladder",
    summary: "O selo do comando elétrico, agora como programa: Q0 = (I0 OU Q0) E I1.",
    steps: [
      "Dê dois cliques no CLP para abrir o programa (aba Ladder).",
      "S1 (NA) entra em I0 e S0 (NF) em I1. A saída Q0 liga o solenoide Y1.",
      "Toque S1: Q0 liga e se mantém pelo próprio contato Q0. Toque S0: I1 abre e Q0 desliga.",
      "Repare que a lógica do selo saiu dos fios e foi para o programa.",
    ],
    build() {
      const b = plcCircuit(
        this.title,
        { rungs: [{ condition: "(I0 | Q0) & I1", coil: "out", target: "Q0" }], steps: [], transitions: [] },
        [
          { label: "S1", type: NO },
          { label: "S0", type: NC },
        ],
        ["Y1"],
      );
      b.tab("Pneumática");
      power(b, V_SS);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 0.2), ...press("S0", 2.5, 0.2)], duration: 4.5, expect: "A1+ A1-" },
  },
  {
    id: "c-grafcet-abba",
    area: "plc",
    level: 3,
    title: "CLP: GRAFCET A+ B+ B− A−",
    summary: "A sequência que precisava de rolete escamoteável ou cascata fica simples em GRAFCET: uma etapa por movimento.",
    steps: [
      "Abra o programa (dois cliques no CLP) e vá na aba GRAFCET: etapas 0 a 4.",
      "Etapa 0 espera partida I0 com A e B recuados (I1, I3). Cada etapa liga um solenoide; cada transição espera o sensor do fim do movimento.",
      "Durante a simulação as etapas ativas ficam coloridas no desenho do GRAFCET e no símbolo do CLP.",
      "Sinal preso não existe aqui: só a etapa ativa comanda as saídas.",
    ],
    build() {
      const b = plcCircuit(
        this.title,
        ABBA,
        [
          { label: "S1", type: NO },
          { label: "a0", type: REED, params: { cylinder: "A", position: 0 } },
          { label: "a1", type: REED, params: { cylinder: "A", position: 100 } },
          { label: "b0", type: REED, params: { cylinder: "B", position: 0 } },
          { label: "b1", type: REED, params: { cylinder: "B", position: 100 } },
        ],
        ["Y1", "Y2", "Y3", "Y4"],
      );
      b.tab("Pneumática");
      const A = b.add(DA, 0, 0, { label: "A", params: { stroke: 100 } });
      const B = b.add(DA, 320, 0, { label: "B", params: { stroke: 100 } });
      const VA = b.add(V_DS, -40, 130, { label: "VA", params: { solenoidLeft: "Y1", solenoidRight: "Y2" } });
      const VB = b.add(V_DS, 280, 130, { label: "VB", params: { solenoidLeft: "Y3", solenoidRight: "Y4" } });
      const src = b.add(SRC, 220, 260, { label: "P1" });
      b.wire(A, "A", VA, "4").wire(A, "B", VA, "2").wire(B, "A", VB, "4").wire(B, "B", VB, "2");
      b.fan(src, "1", [[VA, "1"], [VB, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A+ B+ B- A-" },
  },
  {
    id: "c-grafcet-timer",
    area: "plc",
    level: 2,
    title: "CLP: GRAFCET com temporização",
    summary: "A haste avança, a etapa 2 espera 2 s (transição 2s/X2) e a haste volta.",
    steps: [
      "Etapa 1 liga Q0 (Y1, avanço). Quando a1 (I2) fecha, a etapa 2 fica ativa sem nenhuma ação.",
      "A transição 2s/X2 só passa quando a etapa 2 está ativa há 2 segundos.",
      "A etapa 3 liga Q1 (Y2, retorno) até a0 (I1) fechar e o GRAFCET voltar à etapa inicial.",
    ],
    build() {
      const b = plcCircuit(
        this.title,
        {
          rungs: [],
          steps: [
            { n: 0, initial: true, actions: "" },
            { n: 1, actions: "Q0" },
            { n: 2, actions: "" },
            { n: 3, actions: "Q1" },
          ],
          transitions: [
            { from: [0], to: [1], condition: "I0 & I1" },
            { from: [1], to: [2], condition: "I2" },
            { from: [2], to: [3], condition: "2s/X2" },
            { from: [3], to: [0], condition: "I1" },
          ],
        },
        [
          { label: "S1", type: NO },
          { label: "a0", type: REED, params: { cylinder: "A1", position: 0 } },
          { label: "a1", type: REED, params: { cylinder: "A1", position: 100 } },
        ],
        ["Y1", "Y2"],
      );
      b.tab("Pneumática");
      power(b, V_DS);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A1+ A1-" },
  },
  {
    id: "c-ladder-counter",
    area: "plc",
    level: 2,
    title: "CLP: ciclo contínuo com contador (ladder)",
    summary: "S1 liga a memória M0; o ciclo se repete até o contador C0 chegar a 3. S2 zera o contador.",
    steps: [
      "Degrau 1: M0 = (I0 OU M0) E NÃO C0 — o selo da máquina, cortado pelo contador.",
      "Degraus 2 e 3: avanço com M0 e a0; retorno com a1.",
      "Degrau 4: CTU conta as chegadas em a1. Degrau 5: S2 (I3) zera o contador.",
      "Toque S1 e conte os ciclos no diagrama de fases.",
    ],
    build() {
      const b = plcCircuit(
        this.title,
        {
          rungs: [
            { condition: "(I0 | M0) & !C0", coil: "out", target: "M0" },
            { condition: "M0 & I1", coil: "out", target: "Q0" },
            { condition: "I2", coil: "out", target: "Q1" },
            { condition: "I2", coil: "ctu", target: "C0", preset: 3 },
            { condition: "I3", coil: "ctr", target: "C0" },
          ],
          steps: [],
          transitions: [],
        },
        [
          { label: "S1", type: NO },
          { label: "a0", type: REED, params: { cylinder: "A1", position: 0 } },
          { label: "a1", type: REED, params: { cylinder: "A1", position: 100 } },
          { label: "S2", type: NO },
        ],
        ["Y1", "Y2"],
      );
      b.tab("Pneumática");
      power(b, V_DS);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A1+ A1- A1+ A1- A1+ A1-" },
  },
];
