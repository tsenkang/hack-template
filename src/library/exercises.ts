/**
 * Exercícios guiados. Cada um parte de um projeto inicial (algumas peças já
 * colocadas, sem ligações) e é corrigido rodando o roteiro automático e
 * comparando a sequência dos cilindros (o mesmo que aparece no diagrama de fases).
 */
import type { Project } from "@/engine/core/types";
import { serializeProgram, EMPTY_PROGRAM } from "@/engine/logic/plc";
import { createId } from "@/engine/core/ids";
import { getCircuit } from ".";
import type { Scenario } from "./types";

export interface Exercise {
  id: string;
  level: 1 | 2 | 3;
  title: string;
  statement: string;
  /** Rótulos que o aluno precisa usar (os botões do roteiro). */
  requirements: string[];
  hints: string[];
  scenario: Scenario;
  start(): Project;
  /** Solução (mostrada só no modo Professor). */
  solution?(): Project;
}

/**
 * Projeto inicial: só as peças com os rótulos de `keep` (e as ligações entre elas).
 * Curingas: "*supply" (fontes elétricas), "*tank" e "*junction" (hidráulica), "*tabs" (mantém abas vazias).
 */
function startFrom(circuitId: string, keep: string[], transform?: (p: Project) => void): () => Project {
  const wanted = (type: string, label: string) =>
    keep.includes(label) ||
    (keep.includes("*supply") && type.startsWith("elec.supply")) ||
    (keep.includes("*tank") && type === "hyd.tank") ||
    (keep.includes("*junction") && type === "hyd.junction");
  return () => {
    const p = getCircuit(circuitId)!.build();
    p.name = `Exercício · ${p.name}`;
    for (const c of p.circuits) {
      c.components = c.components.filter((k) => wanted(k.type, k.label));
      const ids = new Set(c.components.map((k) => k.id));
      c.connections = c.connections.filter((w) => ids.has(w.from.componentId) && ids.has(w.to.componentId));
    }
    transform?.(p);
    p.circuits = p.circuits.filter((c, i) => i === 0 || c.components.length > 0 || keep.includes("*tabs"));
    p.id = createId("p");
    return p;
  };
}

function fromCircuit(
  id: string,
  circuitId: string,
  o: { level: 1 | 2 | 3; title: string; statement: string; requirements: string[]; hints: string[]; keep: string[] },
): Exercise {
  const circuit = getCircuit(circuitId)!;
  return {
    id,
    level: o.level,
    title: o.title,
    statement: o.statement,
    requirements: o.requirements,
    hints: o.hints,
    scenario: circuit.scenario!,
    start: startFrom(circuitId, o.keep),
    solution: () => circuit.build(),
  };
}

export const EXERCISES: readonly Exercise[] = [
  fromCircuit("ex-direct-sa", "p-direct-sa", {
    level: 1,
    title: "1. Primeiro movimento",
    statement: "Monte o comando direto do cilindro A1: enquanto o botão V1 estiver apertado, a haste avança; soltando, ela volta.",
    requirements: ["V1"],
    hints: ["Use uma válvula 3/2 NF com botão e mola.", "A via 1 vai na fonte; a via 2 vai no cilindro; a 3 é o escape."],
    keep: ["A1", "P1"],
  }),
  fromCircuit("ex-indirect", "p-indirect", {
    level: 1,
    title: "2. Comando indireto",
    statement: "O botão S1 deve comandar o cilindro A1 por meio de uma válvula 5/2 com piloto e mola (rótulo V1). Segurando S1, a haste avança; soltando, volta.",
    requirements: ["S1"],
    hints: ["S1 é uma 3/2 NF com botão.", "A saída 2 de S1 vai no piloto 14 da 5/2.", "As vias 4 e 2 da 5/2 vão nas câmaras do cilindro."],
    keep: ["A1", "P1"],
  }),
  fromCircuit("ex-or", "p-or", {
    level: 1,
    title: "3. Dois lugares de comando",
    statement: "O cilindro A1 deve avançar ao segurar S1 OU S2 (dois postos de trabalho).",
    requirements: ["S1", "S2"],
    hints: ["Use a válvula alternadora (OU) entre os dois botões e o piloto.", "Teste: com um T no lugar da OU, o ar escapa pelo outro botão."],
    keep: ["A1", "P1"],
  }),
  fromCircuit("ex-and", "p-and", {
    level: 1,
    title: "4. Comando bimanual",
    statement: "Por segurança, o cilindro A1 só pode avançar com S1 E S2 apertados. Só um botão não pode mover a haste.",
    requirements: ["S1", "S2"],
    hints: ["Use a válvula de simultaneidade (E)."],
    keep: ["A1", "P1"],
  }),
  fromCircuit("ex-auto-return", "p-auto-return", {
    level: 2,
    title: "5. Retorno automático",
    statement: "Com um toque em S1 a haste de A1 avança e, ao chegar no fim do curso, volta sozinha.",
    requirements: ["S1"],
    hints: ["A válvula de potência precisa de memória: 5/2 duplo piloto.", "Um rolete na posição 100% de A1 pilota o retorno."],
    keep: ["A1", "P1"],
  }),
  fromCircuit("ex-timer", "p-timer", {
    level: 2,
    title: "6. Espera no fim do curso",
    statement: "Com um toque em S1, A1 avança, espera cerca de 2 s no fim do curso e volta.",
    requirements: ["S1"],
    hints: ["Use um temporizador pneumático com retardo na ligação.", "O rolete do fim do curso alimenta o piloto do temporizador."],
    keep: ["A1", "P1"],
  }),
  fromCircuit("ex-ab-ba", "p-ab-ba", {
    level: 2,
    title: "7. Sequência A+ B+ A− B−",
    statement: "Com um toque em S1, os cilindros A e B devem fazer a sequência A+ B+ A− B−.",
    requirements: ["S1"],
    hints: ["Escreva qual fim de curso dispara cada movimento.", "Nesta sequência não há sinal preso: roletes comuns resolvem."],
    keep: ["A", "B", "P1"],
  }),
  fromCircuit("ex-abba", "p-cascade", {
    level: 3,
    title: "8. Sequência A+ B+ B− A−",
    statement: "Com um toque em S1, os cilindros A e B devem fazer A+ B+ B− A−. Atenção aos sinais presos!",
    requirements: ["S1"],
    hints: ["Monte primeiro com roletes comuns e veja onde aparece o aviso de sinal preso.", "Resolva com roletes escamoteáveis ou pelo método cascata (2 grupos)."],
    keep: ["A", "B", "P1"],
  }),
  fromCircuit("ex-e-seal", "e-seal", {
    level: 2,
    title: "9. Selo elétrico",
    statement: "Na aba de comando elétrico, faça um toque em S1 avançar A1 e manter avançado; um toque em S0 (NF) faz voltar.",
    requirements: ["S1", "S0"],
    hints: ["Use o relé K1 e um contato NA de K1 em paralelo com S1.", "S0 fica em série, antes do selo.", "Outro contato de K1 liga o solenoide Y1."],
    keep: ["A1", "V1", "P1", "*supply", "*tabs"],
  }),
  fromCircuit("ex-e-auto-return", "e-auto-return", {
    level: 2,
    title: "10. Fim de curso elétrico",
    statement: "Com uma válvula de duplo solenoide (Y1/Y2), um toque em S1 avança A1 e um fim de curso elétrico faz a haste voltar sozinha.",
    requirements: ["S1"],
    hints: ["O fim de curso tem o parâmetro “Cilindro que aciona” = A1 e posição 100%."],
    keep: ["A1", "V1", "P1", "*supply", "*tabs"],
  }),
  fromCircuit("ex-grafcet", "c-grafcet-abba", {
    level: 3,
    title: "11. GRAFCET no CLP",
    statement: "A fiação já está pronta. Programe o CLP em GRAFCET para fazer A+ B+ B− A− com um toque em S1 (I0). Sensores: a0=I1, a1=I2, b0=I3, b1=I4. Saídas: Y1=Q0 (A+), Y2=Q1 (A−), Y3=Q2 (B+), Y4=Q3 (B−).",
    requirements: ["S1"],
    hints: ["Uma etapa por movimento, mais a etapa inicial 0.", "Cada transição espera o sensor do fim do movimento anterior."],
    keep: [],
  }),
  fromCircuit("ex-h-lever", "h-lever-da", {
    level: 1,
    title: "12. Primeiro circuito hidráulico",
    statement: "Ligue o cilindro A1 à unidade hidráulica com uma 4/3 de alavanca (rótulo V1): alavanca à esquerda avança, à direita recua.",
    requirements: ["V1"],
    hints: ["A bomba precisa da válvula de alívio na linha de pressão.", "A via T da válvula volta para o tanque."],
    keep: ["A1", "P1", "V0", "M1", "*tank", "*junction"],
  }),
];

// O exercício do GRAFCET mantém tudo (fiação pronta), só o programa é apagado.
const grafcet = EXERCISES.find((e) => e.id === "ex-grafcet")!;
grafcet.start = () => {
  const p = getCircuit("c-grafcet-abba")!.build();
  p.name = `Exercício · ${p.name}`;
  for (const c of p.circuits) for (const k of c.components) if (k.type === "elec.plc") k.params.program = serializeProgram(EMPTY_PROGRAM);
  return p;
};

export function getExercise(id: string) {
  return EXERCISES.find((e) => e.id === id);
}
