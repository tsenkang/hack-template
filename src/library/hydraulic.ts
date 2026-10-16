/** Circuitos prontos de hidráulica e eletro-hidráulica. */
import { Builder } from "./builder";
import { press } from "./scenario";
import type { LibraryCircuit } from "./types";

const DA = "hyd.cylinder.double-acting";
const J = "hyd.junction";
const TANK = "hyd.tank";
const V43L = "hyd.valve.4-3-closed.lever";
const V42L = "hyd.valve.4-2.lever-detent";

/**
 * Unidade hidráulica: motobomba + tanque + válvula de alívio + manômetro.
 * Devolve a junção da linha de pressão (conector "1" livre, em cima).
 */
function powerUnit(b: Builder, x = 140, y = 300, relief = 100) {
  const pump = b.add("hyd.pump.fixed", x, y, { label: "P1" });
  const tank = b.add(TANK, x + 30, y + 100);
  const j = b.add(J, x + 40, y - 60);
  const rv = b.add("hyd.valve.relief", x - 120, y - 70, { label: "V0", params: { setPressure: relief } });
  const rvTank = b.add(TANK, x - 110, y - 160);
  const gauge = b.add("hyd.gauge.pressure", x + 100, y - 110, { label: "M1" });
  b.wire(pump, "S", tank, "T").wire(pump, "P", j, "3").wire(j, "4", rv, "P").wire(rv, "T", rvTank, "T").wire(j, "2", gauge, "1");
  return { pump, j };
}

/** Cilindro A1 e válvula direcional V1 (4/3 ou 4/2), com retorno ao tanque. */
function actuator(b: Builder, valveType: string, params: Record<string, number | string> = {}, valveParams: Record<string, number | string> = {}) {
  const wide = valveType.includes("4-3") || valveType.includes("proportional") || valveType.includes("servo");
  const cyl = b.add(DA, 200, 0, { label: "A1", params });
  const valve = b.add(valveType, wide ? 100 : 140, 140, { label: "V1", params: valveParams });
  const tank = b.add(TANK, wide ? 300 : 320, 240);
  b.wire(valve, "T", tank, "T");
  return { cyl, valve };
}

const hold = (target: string, side: "left" | "right", t: number, d: number) => press(target, t, d, side);

export const HYDRAULIC: LibraryCircuit[] = [
  {
    id: "h-relief",
    area: "hydraulic",
    level: 1,
    title: "Unidade hidráulica e válvula de alívio",
    summary: "A bomba manda óleo para uma linha fechada: a pressão sobe até a válvula de alívio abrir em 100 bar.",
    steps: [
      "Inicie a simulação. Sem consumidor, o óleo da bomba não tem para onde ir.",
      "A pressão sobe até o ajuste da válvula de alívio V0 (100 bar), que abre e devolve o óleo ao tanque.",
      "Mude o ajuste de V0 e veja o manômetro M1 acompanhar. Sem a alívio, a pressão subiria até quebrar algo.",
    ],
    build() {
      const b = new Builder(this.title);
      powerUnit(b);
      return b.build();
    },
  },
  {
    id: "h-lever-da",
    area: "hydraulic",
    level: 1,
    title: "Cilindro hidráulico com 4/3 de alavanca",
    summary: "Comando manual: alavanca para um lado avança, para o outro recua; solta, o cilindro para e fica travado.",
    steps: [
      "Segure a alavanca para a esquerda: P→A e B→T, a haste avança.",
      "Solte no meio do curso: as molas centralizam a válvula (centro fechado) e a haste fica parada, travada pelo óleo.",
      "Enquanto o cilindro está parado, a bomba descarrega pela alívio a 100 bar: energia virando calor.",
      "Segure para a direita para recuar. O retorno é mais rápido: a área do lado da haste é menor.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, V43L);
      const { j } = powerUnit(b);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", valve, "B").wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [...hold("V1", "left", 0.2, 2), ...hold("V1", "right", 2.8, 2)], duration: 5.5, expect: "A1+ A1-" },
  },
  {
    id: "h-meter-out",
    area: "hydraulic",
    level: 1,
    title: "Controle de velocidade na saída (meter-out)",
    summary: "O estrangulador unidirecional limita o óleo que sai do lado da haste: o avanço fica lento e controlado.",
    steps: [
      "Clique na alavanca de V1 (com trava): a haste avança devagar.",
      "O óleo que sai da câmara da haste passa pelo estrangulamento de V2. Na volta passa livre pela retenção.",
      "No gráfico, veja a pressão do lado da haste maior que a do lado do êmbolo (intensificação de pressão).",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, V42L);
      const thr = b.add("hyd.throttle.one-way", 330, 60, { label: "V2", params: { opening: 30 } });
      const { j } = powerUnit(b);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", thr, "1").wire(thr, "2", valve, "B").wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 4, 0.1)], duration: 7, expect: "A1+ A1-" },
  },
  {
    id: "h-compensated",
    area: "hydraulic",
    level: 2,
    title: "Velocidade constante com reguladora compensada",
    summary: "A reguladora compensada mantém 5 l/min para o cilindro, mesmo mudando a carga. A retenção em paralelo libera o retorno.",
    steps: [
      "Clique na alavanca de V1: a haste avança com 5 l/min, devagar.",
      "Mude a “Carga” do cilindro com a simulação rodando: a velocidade quase não muda.",
      "Troque a reguladora por um estrangulador ajustável e repita: agora a carga muda a velocidade.",
      "Na volta o óleo passa pela retenção V3, sem restrição.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, V42L);
      const j1 = b.add(J, 210, 110);
      const j2 = b.add(J, 100, 60);
      const fc = b.add("hyd.flow.compensated", 20, 90, { label: "V2", params: { flowSetting: 5 } });
      const ck = b.add("hyd.check", 20, 30, { label: "V3" });
      const { j } = powerUnit(b);
      b.wire(valve, "A", j1, "3").wire(j1, "4", fc, "1").wire(fc, "2", j2, "3");
      b.wire(j2, "1", cyl, "A").wire(j2, "4", ck, "1").wire(ck, "2", j1, "1");
      b.wire(cyl, "B", valve, "B").wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 4, 0.1)], duration: 6.5, expect: "A1+ A1-" },
  },
  {
    id: "h-motor",
    area: "hydraulic",
    level: 1,
    title: "Motor hidráulico reversível",
    summary: "A 4/3 escolhe o sentido de giro; a rotação depende da vazão da bomba e do deslocamento do motor.",
    steps: [
      "Segure a alavanca para um lado: o motor gira. Marque “Rotação” no gráfico.",
      "Rotação ≈ vazão ÷ deslocamento. Aumente o “Torque de carga”: a pressão sobe, a rotação quase não muda.",
      "Com torque acima do que a alívio permite, o motor para e o óleo vai todo para o tanque.",
    ],
    build() {
      const b = new Builder(this.title);
      const m = b.add("hyd.motor", 220, 0, { label: "A1" });
      const valve = b.add(V43L, 100, 140, { label: "V1" });
      const tank = b.add(TANK, 300, 240);
      const { j } = powerUnit(b);
      b.wire(m, "1", valve, "A").wire(m, "2", valve, "B").wire(valve, "T", tank, "T").wire(j, "1", valve, "P");
      return b.build();
    },
  },
  {
    id: "h-accumulator",
    area: "hydraulic",
    level: 2,
    title: "Acumulador como reserva de energia",
    summary: "Com a válvula fechada o acumulador carrega; ao comandar, a bomba e o acumulador juntos movem o cilindro mais rápido.",
    steps: [
      "Inicie e espere: o acumulador enche até a pressão da alívio (veja M2).",
      "Segure a alavanca de V1: o cilindro avança com a vazão da bomba MAIS a do acumulador.",
      "A retenção V2 impede que o acumulador descarregue de volta pela bomba.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, V43L);
      const ck = b.add("hyd.check", 220, 230, { label: "V2" });
      const ja = b.add(J, 340, 210);
      const acc = b.add("hyd.accumulator", 420, 160);
      const m2 = b.add("hyd.gauge.pressure", 400, 260, { label: "M2" });
      const { j } = powerUnit(b, 80, 360);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", valve, "B");
      b.wire(j, "1", ck, "1").wire(ck, "2", ja, "4").wire(ja, "1", valve, "P").wire(ja, "2", acc, "1").wire(ja, "3", m2, "1");
      return b.build();
    },
    scenario: { actions: [...hold("V1", "left", 1.5, 2), ...hold("V1", "right", 4, 2)], duration: 6.5, expect: "A1+ A1-" },
  },
  {
    id: "h-pilot-check",
    area: "hydraulic",
    level: 2,
    title: "Carga travada com retenção pilotada",
    summary: "Uma carga puxa a haste. A retenção pilotada V2 trava o cilindro; ela só abre com pressão na linha B (piloto X).",
    steps: [
      "A 4/3 tem centro flutuante (A e B ao tanque). Sem a retenção pilotada, a carga puxaria a haste para fora.",
      "Segure o solenoide da esquerda de V1 (clique): a haste avança, passando livre pela retenção.",
      "Solte: a retenção fecha e a carga fica parada.",
      "Segure o da direita: a pressão em B pilota X, abre a retenção e a haste recua.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, "hyd.valve.4-3-float.solenoid", { load: -2000 });
      const pc = b.add("hyd.check.pilot", 60, 60, { label: "V2" });
      const jb = b.add(J, 330, 100);
      const { j } = powerUnit(b);
      b.wire(valve, "A", pc, "A").wire(pc, "B", cyl, "A");
      b.wire(valve, "B", jb, "3").wire(jb, "1", cyl, "B").wire(jb, "4", pc, "X");
      b.wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [...hold("V1", "left", 0.2, 2.5), ...hold("V1", "right", 3.2, 2.5)], duration: 6, expect: "A1+ A1-" },
  },
  {
    id: "h-sequence",
    area: "hydraulic",
    level: 2,
    title: "Fixar e furar: dois cilindros com válvula de sequência",
    summary: "A1 (fixação) avança primeiro; só quando ele aperta a peça e a pressão passa de 60 bar a válvula de sequência libera A2 (furação).",
    steps: [
      "Clique na alavanca de V1: A1 avança com pouca pressão.",
      "A1 encosta na peça e para; a pressão sobe. Acima de 60 bar, V2 abre e A2 avança.",
      "Na volta os dois recuam juntos; o óleo de A2 volta pela retenção V3, em paralelo com V2.",
    ],
    build() {
      const b = new Builder(this.title);
      const A1 = b.add(DA, 0, 0, { label: "A1" });
      const A2 = b.add(DA, 380, 0, { label: "A2" });
      const valve = b.add(V42L, 140, 260, { label: "V1" });
      const tank = b.add(TANK, 320, 360);
      const ja = b.add(J, 0, 190);
      const jb = b.add(J, 260, 120);
      const seq = b.add("hyd.valve.sequence", 300, 160, { label: "V2", params: { setPressure: 60 } });
      const j2 = b.add(J, 380, 100);
      const ck = b.add("hyd.check", 440, 200, { label: "V3" });
      const { j } = powerUnit(b, 140, 520);
      b.wire(valve, "A", ja, "2").wire(ja, "1", A1, "A").wire(ja, "3", seq, "P");
      b.wire(seq, "A", j2, "3").wire(j2, "1", A2, "A").wire(j2, "2", ck, "1").wire(ck, "2", ja, "4");
      b.wire(valve, "B", jb, "3").wire(jb, "1", A1, "B").wire(jb, "2", A2, "B");
      b.wire(valve, "T", tank, "T").wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 5, 0.1)], duration: 8, expect: "A1+ A2+ A1- A2-" },
  },
  {
    id: "h-reducing",
    area: "hydraulic",
    level: 2,
    title: "Pressão reduzida para fixação",
    summary: "A redutora V2 limita em 40 bar a pressão do cilindro de fixação, mesmo com o sistema em 100 bar.",
    steps: [
      "Compare os manômetros: M1 (sistema) e M2 (depois da redutora).",
      "Comande o cilindro pela alavanca de V1. Com a haste parada no fim, M2 fica em 40 bar.",
      "Mude o ajuste de V2: a força máxima da fixação muda junto.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, V42L);
      const red = b.add("hyd.valve.reducing", 20, 200, { label: "V2", params: { setPressure: 40 } });
      const jr = b.add(J, 40, 160);
      const m2 = b.add("hyd.gauge.pressure", 0, 100, { label: "M2" });
      const { j } = powerUnit(b, 180, 380);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", valve, "B");
      b.wire(j, "1", red, "P").wire(red, "A", jr, "3").wire(jr, "1", m2, "1").wire(jr, "2", valve, "P");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 3, 0.1)], duration: 5.5, expect: "A1+ A1-" },
  },
  {
    id: "h-counterbalance",
    area: "hydraulic",
    level: 3,
    title: "Carga suspensa com válvula de contrabalanço",
    summary: "A carga ajuda a descer a haste. A contrabalanço V2 segura o óleo do lado da haste: a descida só acontece empurrada pela bomba, sem disparar.",
    steps: [
      "A carga (−3000 N) puxa a haste para fora. A contrabalanço V2 está ajustada acima da pressão que a carga gera.",
      "Segure a alavanca para a esquerda: a bomba pressuriza o lado do êmbolo e a pressão do lado da haste passa do ajuste: a haste desce controlada.",
      "Na subida (direita) o óleo passa livre pela retenção interna de V2.",
      "Baixe o ajuste de V2 abaixo da pressão da carga e veja a haste descer sozinha.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, V43L, { load: -3000 });
      const cb = b.add("hyd.valve.counterbalance", 330, 60, { label: "V2", params: { setPressure: 60 } });
      const { j } = powerUnit(b, 140, 300, 120);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", cb, "A").wire(cb, "B", valve, "B").wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [...hold("V1", "left", 0.2, 2.5), ...hold("V1", "right", 3.2, 2.5)], duration: 6, expect: "A1+ A1-" },
  },
  {
    id: "h-proportional",
    area: "hydraulic",
    level: 3,
    title: "Válvula proporcional: velocidade pelo comando",
    summary: "O parâmetro “Comando” (−100% a 100%) abre a proporcional aos poucos: a velocidade segue o sinal.",
    steps: [
      "A simulação começa com comando 40%: a haste avança devagar.",
      "Com a simulação rodando, selecione V1 e mude o comando para 100%, depois para −60%.",
      "Marque a velocidade no gráfico: ela acompanha o comando quase em linha reta.",
    ],
    build() {
      const b = new Builder(this.title);
      const { cyl, valve } = actuator(b, "hyd.valve.proportional", {}, { command: 40 });
      const { j } = powerUnit(b);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", valve, "B").wire(j, "1", valve, "P");
      return b.build();
    },
    scenario: { actions: [], duration: 4, expect: "A1+" },
  },
];

const COIL = "elec.solenoid.coil";

export const ELECTROHYDRAULIC: LibraryCircuit[] = [
  {
    id: "eh-tandem",
    area: "electrohydraulic",
    level: 2,
    title: "Eletro-hidráulica: 4/3 centro tandem",
    summary: "S1 avança e S2 recua enquanto apertados. No centro tandem a bomba descarrega direto no tanque, com pressão baixa.",
    steps: [
      "Com os botões soltos, veja M1: perto de zero. O centro tandem liga P ao T e a bomba trabalha “folgada”.",
      "Segure S1: Y1 energiza, P→A, a haste avança. Solte: a haste para (A e B bloqueados).",
      "Segure S2 para recuar. Compare com o centro fechado, em que a bomba fica na pressão da alívio.",
    ],
    build() {
      const b = new Builder(this.title, "Hidráulica");
      const { cyl, valve } = actuator(b, "hyd.valve.4-3-tandem.solenoid", {}, { solenoidLeft: "Y1", solenoidRight: "Y2" });
      const { j } = powerUnit(b);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", valve, "B").wire(j, "1", valve, "P");
      b.tab("Comando elétrico");
      const plus = b.add("elec.supply.24v", -80, 0);
      const zero = b.add("elec.supply.0v", -80, 300);
      const s1 = b.add("elec.pushbutton.no", 0, 60, { label: "S1" });
      const s2 = b.add("elec.pushbutton.no", 90, 60, { label: "S2" });
      const y1 = b.add(COIL, 0, 180, { label: "Y1" });
      const y2 = b.add(COIL, 90, 180, { label: "Y2" });
      b.fan(plus, "+", [[s1, "1"], [s2, "1"]]).wire(s1, "2", y1, "A1").wire(s2, "2", y2, "A1").fan(zero, "0", [[y1, "A2"], [y2, "A2"]]);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 2.5), ...press("S2", 3.2, 2.5)], duration: 6, expect: "A1+ A1-" },
  },
  {
    id: "eh-auto-return",
    area: "electrohydraulic",
    level: 2,
    title: "Eletro-hidráulica: selo com retorno por fim de curso",
    summary: "Um toque em S1 sela o relé K1 e avança; o fim de curso S2 (NF) abre o selo no fim e a mola da válvula faz recuar.",
    steps: [
      "Toque S1: K1 energiza e se sela pelo próprio contato.",
      "O contato de K1 liga Y1: a 4/2 comuta e a haste avança.",
      "No fim do curso, S2 (NF, acionado pela haste) abre: K1 cai, Y1 desliga e a mola faz a haste voltar.",
    ],
    build() {
      const b = new Builder(this.title, "Hidráulica");
      const { cyl, valve } = actuator(b, "hyd.valve.4-2.solenoid-spring", {}, { solenoidLeft: "Y1" });
      const { j } = powerUnit(b);
      b.wire(cyl, "A", valve, "A").wire(cyl, "B", valve, "B").wire(j, "1", valve, "P");
      b.tab("Comando elétrico");
      const plus = b.add("elec.supply.24v", -80, 0);
      const zero = b.add("elec.supply.0v", -80, 400);
      const s2 = b.add("elec.limit.nc", 0, 60, { label: "S2", params: { cylinder: "A1", position: 100 } });
      const s1 = b.add("elec.pushbutton.no", 0, 150, { label: "S1" });
      const k1s = b.add("elec.relay.contact-no", 90, 150, { label: "K1" });
      const k1 = b.add("elec.relay.coil", 0, 260, { label: "K1" });
      const k1b = b.add("elec.relay.contact-no", 200, 60, { label: "K1" });
      const y1 = b.add(COIL, 200, 260, { label: "Y1" });
      b.wire(plus, "+", s2, "1").wire(s2, "2", s1, "1").wire(s2, "2", k1s, "1").wire(s1, "2", k1, "A1").wire(k1s, "2", k1, "A1").wire(k1, "A2", zero, "0");
      b.wire(plus, "+", k1b, "1").wire(k1b, "2", y1, "A1").wire(y1, "A2", zero, "0");
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 5, expect: "A1+ A1-" },
  },
];
