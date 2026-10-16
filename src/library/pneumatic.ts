/** Circuitos prontos de pneumática (comando manual e pneumático puro). */
import { Builder } from "./builder";
import { press } from "./scenario";
import type { LibraryCircuit } from "./types";

const DA = "pneu.cylinder.double-acting";
const SA = "pneu.cylinder.single-acting";
const SRC = "pneu.source.air";
const BTN = "pneu.valve.3-2-nc.button-spring";
const ROLLER = "pneu.valve.3-2-nc.roller-spring";
const V52PP = "pneu.valve.5-2.pilot-pilot";
const V52PS = "pneu.valve.5-2.pilot-spring";
const V52L = "pneu.valve.5-2.lever-detent";

/** Cilindro de dupla ação comandado por uma 5/2 (posições padrão). */
function cylinderAndValve(b: Builder, valveType: string, label = "A1", x = 160, params: Record<string, number | string> = {}) {
  const cyl = b.add(DA, x + 40, 0, { label, params: { stroke: 100, ...params } });
  const valve = b.add(valveType, x, 130, { label: "V1" });
  b.wire(cyl, "A", valve, "4");
  b.wire(cyl, "B", valve, "2");
  return { cyl, valve };
}

const twoStep = (target: string, at = 0.2, hold = 1.5) => press(target, at, hold);

export const PNEUMATIC: LibraryCircuit[] = [
  {
    id: "p-direct-sa",
    area: "pneumatic",
    level: 1,
    title: "Comando direto de cilindro de simples ação",
    summary: "Uma válvula 3/2 com botão alimenta o cilindro diretamente. É o circuito mais simples da pneumática.",
    steps: [
      "Inicie a simulação (F5). A fonte enche a linha até a válvula V1, que está fechada (NF).",
      "Segure o botão de V1: o ar passa de 1 para 2 e empurra a haste de A1 para fora.",
      "Solte o botão: a mola volta a válvula, a via 2 escapa por 3 e a mola do cilindro recolhe a haste.",
      "Observe no gráfico: a posição sobe enquanto o botão está apertado e desce quando é solto.",
    ],
    build() {
      const b = new Builder(this.title);
      const cyl = b.add(SA, 200, 0, { label: "A1" });
      const v = b.add(BTN, 130, 120, { label: "V1" });
      const src = b.add(SRC, 310, 250, { label: "P1" });
      b.wire(cyl, "A", v, "2").wire(src, "1", v, "1");
      return b.build();
    },
    scenario: { actions: twoStep("V1"), duration: 3.5, expect: "A1+ A1-" },
  },
  {
    id: "p-direct-da",
    area: "pneumatic",
    level: 1,
    title: "Comando direto de dupla ação com alavanca",
    summary: "Uma 5/2 com alavanca e trava comanda o cilindro de dupla ação: cada clique troca o sentido.",
    steps: [
      "Em repouso a válvula liga 1→2: o ar empurra a haste para dentro (câmara da frente cheia).",
      "Clique na alavanca de V1: ela trava na outra posição (1→4) e a haste avança.",
      "Clique de novo: volta para 1→2 e a haste recua. A trava é a “memória” do comando.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52L);
      const src = b.add(SRC, 330, 260, { label: "P1" });
      b.wire(src, "1", valve, "1");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 2.2, 0.1)], duration: 4, expect: "A1+ A1-" },
  },
  {
    id: "p-indirect",
    area: "pneumatic",
    level: 1,
    title: "Comando indireto (válvula piloto)",
    summary: "O botão S1 só manda um sinal de pilotagem; quem alimenta o cilindro é a 5/2 V1, de vazão maior.",
    steps: [
      "Segure S1: o ar chega ao piloto 14 de V1 (linha tracejada) e V1 liga 1→4: a haste avança.",
      "Solte S1: o piloto escapa, a mola volta V1 para 1→2 e a haste recua.",
      "Vantagem: o botão pode ser pequeno e ficar longe; a válvula grande fica perto do cilindro.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PS);
      const s1 = b.add(BTN, -60, 260, { label: "S1" });
      const src = b.add(SRC, 330, 380, { label: "P1" });
      b.wire(s1, "2", valve, "14").fan(src, "1", [[valve, "1"], [s1, "1"]]);
      return b.build();
    },
    scenario: { actions: twoStep("S1"), duration: 4, expect: "A1+ A1-" },
  },
  {
    id: "p-meter-out",
    area: "pneumatic",
    level: 1,
    title: "Controle de velocidade no escape",
    summary: "Duas reguladoras de vazão unidirecionais estrangulam o ar que sai do cilindro: o movimento fica lento e firme.",
    steps: [
      "Clique na alavanca de V1 e veja a haste avançar devagar.",
      "O ar entra livre pela retenção da reguladora, mas o ar que sai do outro lado passa pelo estrangulamento.",
      "Mude a “Abertura” das reguladoras (painel de propriedades) durante a simulação e compare a velocidade.",
      "No gráfico, a pressão do lado que escapa fica alta: é esse “colchão de ar” que segura o movimento.",
    ],
    build() {
      const b = new Builder(this.title);
      const cyl = b.add(DA, 200, 0, { label: "A1", params: { stroke: 100 } });
      const valve = b.add(V52L, 160, 220, { label: "V1" });
      const fA = b.add("pneu.flow-control.one-way", 130, 100, { label: "V2", params: { opening: 25 } });
      const fB = b.add("pneu.flow-control.one-way", 330, 100, { label: "V3", params: { opening: 25 } });
      const src = b.add(SRC, 330, 350, { label: "P1" });
      b.wire(cyl, "A", fA, "1").wire(fA, "2", valve, "4");
      b.wire(cyl, "B", fB, "1").wire(fB, "2", valve, "2");
      b.wire(src, "1", valve, "1");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 3, 0.1)], duration: 6, expect: "A1+ A1-" },
  },
  {
    id: "p-quick-exhaust",
    area: "pneumatic",
    level: 1,
    title: "Retorno rápido com válvula de escape rápido",
    summary: "O ar do cilindro sai direto pela válvula de escape rápido, sem passar pela válvula de comando.",
    steps: [
      "Segure o botão de V1: o ar passa pela escape rápido (1→2) e a haste avança.",
      "Solte: a pressão em 1 cai e a escape rápido abre o caminho 2→3, bem perto do cilindro.",
      "Compare no gráfico: a volta é mais rápida do que no comando direto sem a escape rápido.",
    ],
    build() {
      const b = new Builder(this.title);
      const cyl = b.add(SA, 200, 0, { label: "A1" });
      const qe = b.add("pneu.valve.quick-exhaust", 180, 90, { label: "V2" });
      const v = b.add(BTN, 160, 200, { label: "V1" });
      const src = b.add(SRC, 330, 320, { label: "P1" });
      b.wire(cyl, "A", qe, "2").wire(qe, "1", v, "2").wire(src, "1", v, "1");
      return b.build();
    },
    scenario: { actions: twoStep("V1"), duration: 3.5, expect: "A1+ A1-" },
  },
  {
    id: "p-or",
    area: "pneumatic",
    level: 1,
    title: "Comando de dois lugares (função OU)",
    summary: "Dois botões, S1 ou S2, comandam o mesmo cilindro pela válvula alternadora (OU).",
    steps: [
      "Segure S1: o sinal passa pela válvula OU até o piloto 14 de V1 e a haste avança.",
      "Solte e segure S2: o mesmo acontece. A esfera interna da OU impede que o ar escape pelo outro botão.",
      "Sem a OU (ligando os dois botões num T), o ar de um botão escaparia pelo escape do outro.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PS);
      const or = b.add("pneu.valve.or", -20, 210, { label: "V2" });
      const s1 = b.add(BTN, -200, 300, { label: "S1" });
      const s2 = b.add(BTN, 20, 300, { label: "S2" });
      const src = b.add(SRC, 330, 420, { label: "P1" });
      b.wire(s1, "2", or, "1a").wire(s2, "2", or, "1b").wire(or, "2", valve, "14");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s2, "1"]]);
      return b.build();
    },
    scenario: { actions: [...twoStep("S1"), ...twoStep("S2", 3.5)], duration: 7, expect: "A1+ A1- A1+ A1-" },
  },
  {
    id: "p-and",
    area: "pneumatic",
    level: 1,
    title: "Comando bimanual (função E)",
    summary: "Segurança: o cilindro só avança com S1 E S2 apertados ao mesmo tempo (as duas mãos longe da prensa).",
    steps: [
      "Segure só S1: nada acontece, a válvula E não deixa o sinal passar.",
      "Segure S1 e S2 juntos (Ctrl+clique não funciona: use dois cliques rápidos, um em cada, ou o roteiro do exercício).",
      "Com os dois sinais, a E libera o piloto de V1 e a haste avança. Soltando qualquer um, ela volta.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PS);
      const and = b.add("pneu.valve.and", -20, 210, { label: "V2" });
      const s1 = b.add(BTN, -200, 300, { label: "S1" });
      const s2 = b.add(BTN, 20, 300, { label: "S2" });
      const src = b.add(SRC, 330, 420, { label: "P1" });
      b.wire(s1, "2", and, "1a").wire(s2, "2", and, "1b").wire(and, "2", valve, "14");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s2, "1"]]);
      return b.build();
    },
    scenario: {
      actions: [...press("S1", 0.2, 1), ...press("S1", 2, 1.5), ...press("S2", 2, 1.5)],
      duration: 5,
      expect: "A1+ A1-",
    },
  },
  {
    id: "p-memory",
    area: "pneumatic",
    level: 1,
    title: "Memória pneumática (5/2 duplo piloto)",
    summary: "Um toque em S1 avança, um toque em S2 recua. A válvula de duplo piloto “lembra” do último sinal.",
    steps: [
      "Dê um toque em S1: V1 vai para 1→4 e fica lá mesmo depois de soltar o botão.",
      "Dê um toque em S2: V1 volta para 1→2 e a haste recua.",
      "Tente segurar os dois ao mesmo tempo: aparece o aviso de sinal preso.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PP);
      const s1 = b.add(BTN, -60, 260, { label: "S1" });
      const s2 = b.add(BTN, 340, 260, { label: "S2" });
      const src = b.add(SRC, 250, 400, { label: "P1" });
      b.wire(s1, "2", valve, "14").wire(s2, "2", valve, "12");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s2, "1"]]);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 0.2), ...press("S2", 2.5, 0.2)], duration: 5, expect: "A1+ A1-" },
  },
  {
    id: "p-auto-return",
    area: "pneumatic",
    level: 1,
    title: "Avanço por botão e retorno automático (rolete)",
    summary: "Um toque em S1 avança a haste; ao tocar o rolete S2 no fim do curso, ela volta sozinha.",
    steps: [
      "Dê um toque em S1: V1 memoriza o avanço.",
      "No fim do curso, a haste aciona o rolete S2 (posição 100%), que pilota o lado 12 de V1.",
      "V1 volta e a haste recua. O rolete fica no desenho separado do cilindro, ligado pelo rótulo A1.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PP);
      const s1 = b.add(BTN, -60, 260, { label: "S1" });
      const s2 = b.add(ROLLER, 340, 260, { label: "S2", params: { cylinder: "A1", position: 100 } });
      const src = b.add(SRC, 250, 400, { label: "P1" });
      b.wire(s1, "2", valve, "14").wire(s2, "2", valve, "12");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s2, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A1+ A1-" },
  },
  {
    id: "p-continuous",
    area: "pneumatic",
    level: 2,
    title: "Ciclo contínuo com chave liga/desliga",
    summary: "Com a chave S1 ligada, o cilindro vai e volta sem parar entre os roletes S2 (recuado) e S3 (avançado).",
    steps: [
      "Clique em S1 (alavanca com trava): o ar passa por S1 e pelo rolete S2, que está acionado (haste recuada).",
      "V1 avança a haste. No fim, o rolete S3 pilota o retorno.",
      "Ao voltar, a haste aciona S2 de novo e o ciclo recomeça. Desligue S1 para parar no fim do ciclo.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PP);
      const s1 = b.add("pneu.valve.3-2-nc.lever-detent", -60, 380, { label: "S1" });
      const s2 = b.add(ROLLER, -60, 250, { label: "S2", params: { cylinder: "A1", position: 0 } });
      const s3 = b.add(ROLLER, 340, 250, { label: "S3", params: { cylinder: "A1", position: 100 } });
      const src = b.add(SRC, 250, 420, { label: "P1" });
      b.wire(s1, "2", s2, "1").wire(s2, "2", valve, "14").wire(s3, "2", valve, "12");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s3, "1"]]);
      return b.build();
    },
    scenario: { actions: [...press("S1", 0.2, 0.1), ...press("S1", 2.3, 0.1)], duration: 5, expect: Array(10).fill("A1+ A1-").join(" ") },
  },
  {
    id: "p-pressure-return",
    area: "pneumatic",
    level: 2,
    title: "Retorno por pressão (válvula de sequência)",
    summary: "Prensa: a haste só volta depois de apertar a peça, quando a pressão na câmara passa de 5 bar.",
    steps: [
      "Toque S1: a haste avança. Durante o movimento a pressão em A fica baixa.",
      "No fim do curso a haste para e a pressão sobe até a da rede.",
      "Acima de 5 bar a válvula de sequência V2 comuta e pilota o retorno de V1.",
      "Aumente a “Carga” do cilindro e veja como a pressão no avanço muda.",
    ],
    build() {
      const b = new Builder(this.title);
      const cyl = b.add(DA, 200, 0, { label: "A1", params: { stroke: 100 } });
      const valve = b.add(V52PP, 160, 160, { label: "V1" });
      const j = b.add("pneu.junction", 180, 90);
      const seq = b.add("pneu.valve.sequence", 380, 260, { label: "V2", params: { switchPressure: 5 } });
      const s1 = b.add(BTN, -60, 280, { label: "S1" });
      const src = b.add(SRC, 250, 420, { label: "P1" });
      b.wire(cyl, "A", j, "1").wire(j, "3", valve, "4").wire(j, "4", seq, "12");
      b.wire(cyl, "B", valve, "2").wire(s1, "2", valve, "14").wire(seq, "2", valve, "12");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [seq, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 4, expect: "A1+ A1-" },
  },
  {
    id: "p-timer",
    area: "pneumatic",
    level: 2,
    title: "Retorno temporizado",
    summary: "A haste avança, espera 2 segundos no fim do curso e volta sozinha.",
    steps: [
      "Toque S1: a haste avança e aciona o rolete S2 no fim.",
      "S2 manda ar para o temporizador V2, que enche o reservatório interno pela restrição.",
      "Depois de 2 s, V2 libera o sinal para o piloto 12 de V1 e a haste volta.",
      "Mude o “Tempo” de V2 e veja o diagrama de fases mudar.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PP);
      const s1 = b.add(BTN, -60, 260, { label: "S1" });
      const s2 = b.add(ROLLER, 400, 400, { label: "S2", params: { cylinder: "A1", position: 100 } });
      const tm = b.add("pneu.timer.on-delay", 400, 250, { label: "V2", params: { delay: 2 } });
      const src = b.add(SRC, 250, 420, { label: "P1" });
      b.wire(s1, "2", valve, "14").wire(s2, "2", tm, "12").wire(tm, "2", valve, "12");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s2, "1"], [tm, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 5, expect: "A1+ A1-" },
  },
  {
    id: "p-counter",
    area: "pneumatic",
    level: 2,
    title: "Contador pneumático",
    summary: "Depois de 3 toques em S1, o contador libera o avanço. S2 zera o contador e a haste volta.",
    steps: [
      "Toque S1 três vezes. A cada toque o contador C1 soma um (veja o número no símbolo).",
      "No terceiro, C1 libera 1→2 e pilota V1: a haste avança e fica avançada.",
      "Toque S2: o contador zera, o sinal some e a mola de V1 recolhe a haste.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52PS);
      const counter = b.add("pneu.counter", -150, 240, { label: "C1", params: { preset: 3 } });
      const s1 = b.add(BTN, -420, 200, { label: "S1" });
      const s2 = b.add(BTN, -420, 320, { label: "S2" });
      const src = b.add(SRC, 250, 420, { label: "P1" });
      b.wire(s1, "2", counter, "12").wire(s2, "2", counter, "10").wire(counter, "2", valve, "14");
      b.fan(src, "1", [[valve, "1"], [s1, "1"], [s2, "1"], [counter, "1"]]);
      return b.build();
    },
    scenario: {
      actions: [...press("S1", 0.2, 0.15), ...press("S1", 0.6, 0.15), ...press("S1", 1.0, 0.15), ...press("S2", 2.5, 0.2)],
      duration: 4.5,
      expect: "A1+ A1-",
    },
  },
  {
    id: "p-ab-ba",
    area: "pneumatic",
    level: 2,
    title: "Dois cilindros: A+ B+ A− B−",
    summary: "Sequência sem sinais presos: cada fim de curso dispara o próximo movimento.",
    steps: [
      "Toque S1 (com B recuado, rolete b0): A avança.",
      "a1 (A avançado) avança B. b1 (B avançado) recua A. a0 (A recuado) recua B.",
      "Veja o diagrama de fases: os quatro passos aparecem numerados.",
      "Nenhuma válvula recebe os dois pilotos ao mesmo tempo, então não há sinal preso.",
    ],
    build() {
      const b = new Builder(this.title);
      const A = b.add(DA, 0, 0, { label: "A", params: { stroke: 100 } });
      const B = b.add(DA, 320, 0, { label: "B", params: { stroke: 100 } });
      const VA = b.add(V52PP, -40, 130, { label: "VA" });
      const VB = b.add(V52PP, 280, 130, { label: "VB" });
      const r = (lbl: string, cyl: string, pos: number, x: number, y: number) => b.add(ROLLER, x, y, { label: lbl, params: { cylinder: cyl, position: pos } });
      const s1 = b.add(BTN, -260, 380, { label: "S1" });
      const b0 = r("b0", "B", 0, -260, 260);
      const a1 = r("a1", "A", 100, 80, 260);
      const b1 = r("b1", "B", 100, 260, 260);
      const a0 = r("a0", "A", 0, 440, 260);
      const src = b.add(SRC, 150, 420, { label: "P1" });
      b.wire(A, "A", VA, "4").wire(A, "B", VA, "2").wire(B, "A", VB, "4").wire(B, "B", VB, "2");
      b.wire(s1, "2", b0, "1").wire(b0, "2", VA, "14").wire(a1, "2", VB, "14").wire(b1, "2", VA, "12").wire(a0, "2", VB, "12");
      b.fan(src, "1", [[VA, "1"], [VB, "1"], [s1, "1"], [a1, "1"], [b1, "1"], [a0, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 5, expect: "A+ B+ A- B-" },
  },
  {
    id: "p-abba-oneway",
    area: "pneumatic",
    level: 3,
    title: "A+ B+ B− A− com roletes escamoteáveis",
    summary: "Nesta sequência os sinais a1 e b0 ficariam presos; os roletes escamoteáveis só dão um pulso na passagem.",
    steps: [
      "Toque S1: A avança e, perto do fim, passa pelo rolete escamoteável a1, que dá só um pulso: B avança.",
      "b1 recua B. Na volta, B passa por b0 (escamoteável no sentido do retorno): A recua.",
      "Troque a1 por um rolete comum e veja o aviso de sinal preso: B nunca recua.",
    ],
    build() {
      const b = new Builder(this.title);
      const A = b.add(DA, 0, 0, { label: "A", params: { stroke: 100 } });
      const B = b.add(DA, 320, 0, { label: "B", params: { stroke: 100 } });
      const VA = b.add(V52PP, -40, 160, { label: "VA" });
      const VB = b.add(V52PP, 280, 160, { label: "VB" });
      const ow = "pneu.valve.3-2-nc.roller-oneway-spring";
      const s1 = b.add(BTN, -260, 380, { label: "S1" });
      const a0 = b.add(ROLLER, -260, 260, { label: "a0", params: { cylinder: "A", position: 0 } });
      const a1 = b.add(ow, 80, 260, { label: "a1", params: { cylinder: "A", position: 95, direction: "advance" } });
      const b1 = b.add(ROLLER, 260, 260, { label: "b1", params: { cylinder: "B", position: 100 } });
      const b0 = b.add(ow, 440, 260, { label: "b0", params: { cylinder: "B", position: 5, direction: "return" } });
      const src = b.add(SRC, 150, 420, { label: "P1" });
      // reguladoras no escape: movimento mais lento, para o pulso do rolete escamoteável durar o suficiente
      const fc = (cyl: string, port: string, valve: string, vport: string, x: number) => {
        const f = b.add("pneu.flow-control.one-way", x, 70, { params: { opening: 30 } });
        b.wire(cyl, port, f, "1").wire(f, "2", valve, vport);
      };
      fc(A, "A", VA, "4", -80);
      fc(A, "B", VA, "2", 160);
      fc(B, "A", VB, "4", 240);
      fc(B, "B", VB, "2", 480);
      b.wire(a0, "2", s1, "1").wire(s1, "2", VA, "14").wire(a1, "2", VB, "14").wire(b1, "2", VB, "12").wire(b0, "2", VA, "12");
      b.fan(src, "1", [[VA, "1"], [VB, "1"], [a0, "1"], [a1, "1"], [b1, "1"], [b0, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 5, expect: "A+ B+ B- A-" },
  },
  {
    id: "p-cascade",
    area: "pneumatic",
    level: 3,
    title: "A+ B+ B− A− pelo método cascata",
    summary: "Uma válvula de memória (V0) divide o comando em dois grupos de linhas: só um grupo tem ar de cada vez.",
    steps: [
      "Grupo I (linha de 4 de V0): A+ e B+. Grupo II (linha de 2 de V0): B− e A−.",
      "Toque S1 (com A recuado): V0 liga o grupo I, que avança A. a1, alimentado pelo grupo I, avança B.",
      "b1 troca V0 para o grupo II, que recua B. b0, alimentado pelo grupo II, recua A.",
      "Como cada sinal só tem ar no seu grupo, nenhum sinal fica preso, sem precisar de rolete escamoteável.",
    ],
    build() {
      const b = new Builder(this.title);
      const A = b.add(DA, 0, 0, { label: "A", params: { stroke: 100 } });
      const B = b.add(DA, 320, 0, { label: "B", params: { stroke: 100 } });
      const VA = b.add(V52PP, -40, 130, { label: "VA" });
      const VB = b.add(V52PP, 280, 130, { label: "VB" });
      const V0 = b.add(V52PP, 120, 470, { label: "V0" });
      const g1 = b.add("pneu.junction", 180, 380);
      const g2 = b.add("pneu.junction", 300, 380);
      const s1 = b.add(BTN, -260, 470, { label: "S1" });
      const a0 = b.add(ROLLER, -260, 590, { label: "a0", params: { cylinder: "A", position: 0 } });
      const a1 = b.add(ROLLER, -40, 260, { label: "a1", params: { cylinder: "A", position: 100 } });
      const b1 = b.add(ROLLER, 420, 470, { label: "b1", params: { cylinder: "B", position: 100 } });
      const b0 = b.add(ROLLER, 420, 260, { label: "b0", params: { cylinder: "B", position: 0 } });
      const src = b.add(SRC, 160, 640, { label: "P1" });
      b.wire(A, "A", VA, "4").wire(A, "B", VA, "2").wire(B, "A", VB, "4").wire(B, "B", VB, "2");
      // grupo I = saída 4 de V0; grupo II = saída 2 de V0
      b.wire(V0, "4", g1, "3").wire(g1, "1", VA, "14").wire(g1, "4", a1, "1");
      b.wire(V0, "2", g2, "3").wire(g2, "1", VB, "12").wire(g2, "2", b0, "1");
      b.wire(a1, "2", VB, "14").wire(b0, "2", VA, "12");
      b.wire(a0, "2", s1, "1").wire(s1, "2", V0, "14").wire(b1, "2", V0, "12");
      b.fan(src, "1", [[VA, "1"], [VB, "1"], [V0, "1"], [a0, "1"], [b1, "1"]]);
      return b.build();
    },
    scenario: { actions: press("S1", 0.2, 0.2), duration: 5, expect: "A+ B+ B- A-" },
  },
  {
    id: "p-gripper",
    area: "pneumatic",
    level: 1,
    title: "Garra pneumática",
    summary: "Uma 5/2 com alavanca abre e fecha a garra.",
    steps: [
      "Clique na alavanca de V1: o ar entra em A e as garras fecham.",
      "Clique de novo: o ar entra em B e as garras abrem.",
      "Reduza a pressão da fonte e veja a força de fechamento cair no painel de propriedades.",
    ],
    build() {
      const b = new Builder(this.title);
      const g = b.add("pneu.gripper", 200, 0, { label: "A1" });
      const v = b.add(V52L, 140, 130, { label: "V1" });
      const src = b.add(SRC, 330, 260, { label: "P1" });
      b.wire(g, "A", v, "4").wire(g, "B", v, "2").wire(src, "1", v, "1");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 1.5, 0.1)], duration: 3, expect: "A1+ A1-" },
  },
  {
    id: "p-vacuum",
    area: "pneumatic",
    level: 1,
    title: "Ventosa com gerador de vácuo",
    summary: "O ejetor Venturi transforma ar comprimido em vácuo e a ventosa segura a peça.",
    steps: [
      "Ligue a chave S1: o ar passa pelo gerador de vácuo de 1 para 3 (escape).",
      "O jato de ar puxa o ar da via 2: a pressão na ventosa fica negativa (veja o manômetro).",
      "Abaixo de −0,4 bar a ventosa segura a peça. Desligue S1 para soltar.",
    ],
    build() {
      const b = new Builder(this.title);
      const cup = b.add("pneu.vacuum.cup", 220, 0, { label: "A1" });
      const j = b.add("pneu.junction", 230, 70);
      const gauge = b.add("pneu.gauge.pressure", 300, 40, { label: "M1" });
      const gen = b.add("pneu.vacuum.generator", 210, 150, { label: "V2" });
      const s1 = b.add("pneu.valve.3-2-nc.lever-detent", 60, 260, { label: "S1" });
      const src = b.add(SRC, 300, 380, { label: "P1" });
      b.wire(cup, "1", j, "1").wire(j, "2", gauge, "1").wire(j, "3", gen, "2");
      b.wire(s1, "2", gen, "1").wire(src, "1", s1, "1");
      return b.build();
    },
  },
  {
    id: "p-motor",
    area: "pneumatic",
    level: 1,
    title: "Motor pneumático com controle de rotação",
    summary: "A reguladora de vazão limita o ar que passa pelo motor: menos vazão, menos rotação.",
    steps: [
      "Ligue S1: o ar passa pela reguladora V2 e faz o motor girar.",
      "Abra o gráfico e marque a rotação do motor.",
      "Mude a abertura de V2 com a simulação rodando e veja a rotação acompanhar.",
    ],
    build() {
      const b = new Builder(this.title);
      const m = b.add("pneu.motor", 220, 0, { label: "A1" });
      const sil = b.add("pneu.silencer", 240, -60);
      const fc = b.add("pneu.flow-control.two-way", 220, 110, { label: "V2" });
      const s1 = b.add("pneu.valve.3-2-nc.lever-detent", 100, 200, { label: "S1" });
      const src = b.add(SRC, 330, 320, { label: "P1" });
      b.wire(m, "2", sil, "1").wire(m, "1", fc, "2").wire(fc, "1", s1, "2").wire(src, "1", s1, "1");
      return b.build();
    },
  },
  {
    id: "p-regulator",
    area: "pneumatic",
    level: 1,
    title: "Força reduzida com regulador de pressão",
    summary: "O regulador baixa a pressão do cilindro para 3 bar: a força cai pela metade, a velocidade quase não muda.",
    steps: [
      "Veja o manômetro M1: depois do regulador a pressão fica em 3 bar, mesmo com a fonte em 6 bar.",
      "Comande o cilindro pela alavanca de V1.",
      "Aumente a “Carga” do cilindro: com 3 bar, a partir de certa carga ele não consegue mais avançar.",
    ],
    build() {
      const b = new Builder(this.title);
      const { valve } = cylinderAndValve(b, V52L);
      const reg = b.add("pneu.valve.pressure-regulator", 400, 220, { label: "V2", params: { setPressure: 3 } });
      const out = b.add("pneu.junction", 420, 160);
      const inlet = b.add("pneu.junction", 420, 320);
      const m1 = b.add("pneu.gauge.pressure", 480, 130, { label: "M1" });
      const m2 = b.add("pneu.gauge.pressure", 480, 290, { label: "M2" });
      const src = b.add(SRC, 410, 400, { label: "P1" });
      b.wire(src, "1", inlet, "3").wire(inlet, "1", reg, "1").wire(inlet, "2", m2, "1");
      b.wire(reg, "2", out, "3").wire(out, "4", valve, "1").wire(out, "2", m1, "1");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 0.1), ...press("V1", 2.2, 0.1)], duration: 4, expect: "A1+ A1-" },
  },
  {
    id: "p-rodless-53",
    area: "pneumatic",
    level: 2,
    title: "Cilindro sem haste com 5/3 centro fechado",
    summary: "Com a 5/3 de centro fechado o carro pode parar em qualquer ponto do curso.",
    steps: [
      "Segure o solenoide da esquerda de V1 (clique no símbolo): o carro anda para a direita.",
      "Solte no meio do caminho: as molas centralizam a válvula, todas as vias bloqueiam e o carro para.",
      "Segure o solenoide da direita: o carro volta. Nesta montagem os solenoides são acionados com o mouse.",
    ],
    build() {
      const b = new Builder(this.title);
      const cyl = b.add("pneu.cylinder.rodless", 180, 0, { label: "A1", params: { stroke: 300 } });
      const v = b.add("pneu.valve.5-3-closed.solenoid", 100, 130, { label: "V1" });
      const src = b.add(SRC, 330, 260, { label: "P1" });
      b.wire(cyl, "A", v, "4").wire(cyl, "B", v, "2").wire(src, "1", v, "1");
      return b.build();
    },
    scenario: { actions: [...press("V1", 0.2, 3, "left"), ...press("V1", 3.6, 3, "right")], duration: 7, expect: "A1+ A1-" },
  },
];
