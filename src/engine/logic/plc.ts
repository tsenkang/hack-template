/**
 * CLP simples: programa em ladder (degraus) e/ou GRAFCET, executado a cada passo
 * da simulação (um "ciclo de varredura").
 *
 * Ordem de cada ciclo, como num CLP real:
 *  1. lê as entradas I;
 *  2. GRAFCET: dispara as transições válidas (todas as etapas de origem ativas e
 *     condição verdadeira) ao mesmo tempo, e as etapas ativas ligam suas ações;
 *  3. ladder: os degraus rodam de cima para baixo, cada um escrevendo na sua bobina;
 *  4. escreve as saídas Q.
 */
import { evaluate, parseExpression, type Expr, type Memory, type OperandKind } from "./expression";

export type CoilKind = "out" | "set" | "reset" | "ton" | "tof" | "ctu" | "ctr";

export interface Rung {
  /** Condição em texto (ex.: "(I0 | Q0) & !I1"). */
  condition: string;
  coil: CoilKind;
  /** Operando escrito: Q0…, M0… (saída/memória), T0… (temporizador), C0… (contador). */
  target: string;
  /** Tempo [s] do temporizador ou valor do contador. */
  preset?: number;
  comment?: string;
}

export interface GrafcetStep {
  n: number;
  initial?: boolean;
  /** Ações contínuas: operandos ligados enquanto a etapa está ativa (ex.: "Q0, M1"). */
  actions: string;
  comment?: string;
}

export interface GrafcetTransition {
  from: number[];
  to: number[];
  condition: string;
}

export interface PlcProgram {
  rungs: Rung[];
  steps: GrafcetStep[];
  transitions: GrafcetTransition[];
}

export const PLC_INPUTS = 8;
export const PLC_OUTPUTS = 8;
const SIZES: Record<OperandKind, number> = { I: PLC_INPUTS, Q: PLC_OUTPUTS, M: 32, T: 16, C: 16, X: 100 };

export const EMPTY_PROGRAM: PlcProgram = { rungs: [], steps: [], transitions: [] };

/** Lê o programa guardado no parâmetro da peça (texto JSON); se estiver estragado, devolve vazio. */
export function parseProgram(raw: unknown): PlcProgram {
  if (typeof raw !== "string" || raw.trim() === "") return EMPTY_PROGRAM;
  try {
    const data = JSON.parse(raw) as Partial<PlcProgram>;
    return {
      rungs: Array.isArray(data.rungs) ? data.rungs : [],
      steps: Array.isArray(data.steps) ? data.steps : [],
      transitions: Array.isArray(data.transitions) ? data.transitions : [],
    };
  } catch {
    return EMPTY_PROGRAM;
  }
}

export function serializeProgram(p: PlcProgram): string {
  return JSON.stringify(p);
}

/** "Q0", "m12" → { kind, index } (ou null se não for operando válido para escrita). */
export function parseOperand(text: string, allowed: readonly OperandKind[] = ["Q", "M"]): { kind: OperandKind; index: number } | null {
  const m = /^\s*([IQMTCX])(\d{1,3})\s*$/i.exec(text);
  if (!m) return null;
  const kind = m[1].toUpperCase() as OperandKind;
  const index = Number(m[2]);
  if (!allowed.includes(kind) || index >= SIZES[kind]) return null;
  return { kind, index };
}

/** Lista de ações de uma etapa: "Q0, M1" → operandos. */
export function parseActions(text: string) {
  return text
    .split(/[,;\s]+/)
    .filter(Boolean)
    .map((s) => parseOperand(s))
    .filter((x): x is { kind: OperandKind; index: number } => x !== null);
}

/** Problemas no programa (para o editor e para os avisos). */
export interface ProgramIssue {
  where: "rung" | "transition" | "step";
  index: number;
  message: "syntax" | "target" | "from" | "noInitial";
}

export function checkProgram(p: PlcProgram): ProgramIssue[] {
  const issues: ProgramIssue[] = [];
  const stepNumbers = new Set(p.steps.map((s) => s.n));
  p.rungs.forEach((r, i) => {
    if (!parseExpression(r.condition).ok) issues.push({ where: "rung", index: i, message: "syntax" });
    if (!parseOperand(r.target, targetKinds(r.coil))) issues.push({ where: "rung", index: i, message: "target" });
  });
  p.transitions.forEach((tr, i) => {
    if (!parseExpression(tr.condition).ok) issues.push({ where: "transition", index: i, message: "syntax" });
    if (tr.from.length === 0 || tr.to.length === 0 || [...tr.from, ...tr.to].some((n) => !stepNumbers.has(n))) {
      issues.push({ where: "transition", index: i, message: "from" });
    }
  });
  if (p.steps.length > 0 && !p.steps.some((s) => s.initial)) issues.push({ where: "step", index: 0, message: "noInitial" });
  return issues;
}

export function targetKinds(coil: CoilKind): OperandKind[] {
  if (coil === "ton" || coil === "tof") return ["T"];
  if (coil === "ctu" || coil === "ctr") return ["C"];
  return ["Q", "M"];
}

const FALSE: Expr = { type: "const", value: false };
const compile = (s: string) => {
  const r = parseExpression(s);
  return r.ok ? r.expr : FALSE;
};

/** Estado do CLP para a tela. */
export interface PlcState {
  inputs: boolean[];
  outputs: boolean[];
  /** Etapas ativas do GRAFCET. */
  steps: number[];
  /** Memórias M ligadas. */
  memories: number[];
  counts: number[];
}

export class PlcRuntime {
  private readonly rungs: { coil: CoilKind; expr: Expr; target: { kind: OperandKind; index: number } | null; preset: number }[];
  private readonly transitions: { from: number[]; to: number[]; expr: Expr }[];
  private readonly actions = new Map<number, { kind: OperandKind; index: number }[]>();
  /** Operandos ligados por alguma etapa. */
  private readonly driven: { kind: OperandKind; index: number }[] = [];
  private readonly bits: Record<OperandKind, boolean[]>;
  /** Saídas e memórias presas por SET (até um RESET). */
  private readonly latched: Record<"Q" | "M", boolean[]>;
  private readonly active = new Map<number, number>(); // etapa → tempo ativa [s]
  private readonly timerTime: number[];
  private readonly counts: number[];
  private readonly lastCond: boolean[];
  private started = false;

  constructor(private readonly program: PlcProgram) {
    this.rungs = program.rungs.map((r) => ({
      coil: r.coil,
      expr: compile(r.condition),
      target: parseOperand(r.target, targetKinds(r.coil)),
      preset: Number.isFinite(r.preset) ? Number(r.preset) : 1,
    }));
    this.transitions = program.transitions.map((t) => ({ from: t.from, to: t.to, expr: compile(t.condition) }));
    for (const s of program.steps) this.actions.set(s.n, parseActions(s.actions));
    const seen = new Set<string>();
    for (const list of this.actions.values()) {
      for (const a of list) {
        if (!seen.has(`${a.kind}${a.index}`)) this.driven.push(a);
        seen.add(`${a.kind}${a.index}`);
      }
    }
    const make = (n: number) => new Array<boolean>(n).fill(false);
    this.bits = { I: make(SIZES.I), Q: make(SIZES.Q), M: make(SIZES.M), T: make(SIZES.T), C: make(SIZES.C), X: make(SIZES.X) };
    this.latched = { Q: make(SIZES.Q), M: make(SIZES.M) };
    this.timerTime = new Array<number>(SIZES.T).fill(0);
    this.counts = new Array<number>(SIZES.C).fill(0);
    this.lastCond = new Array<boolean>(this.rungs.length).fill(false);
  }

  private readonly mem: Memory = {
    get: (kind, index) => this.bits[kind][index] ?? false,
    stepTime: (step) => this.active.get(step) ?? -1,
  };

  /** Um ciclo de varredura. Devolve as saídas Q. */
  scan(inputs: readonly boolean[], dt: number): boolean[] {
    const { bits } = this;
    for (let i = 0; i < SIZES.I; i++) bits.I[i] = inputs[i] ?? false;

    // GRAFCET
    if (!this.started) {
      this.started = true;
      for (const s of this.program.steps) if (s.initial) this.active.set(s.n, 0);
    } else {
      for (const [n, t] of this.active) this.active.set(n, t + dt);
      const fire = this.transitions.filter((t) => t.from.every((n) => this.active.has(n)) && evaluate(t.expr, this.mem));
      const off = new Set(fire.flatMap((t) => t.from));
      const on = new Set(fire.flatMap((t) => t.to));
      for (const n of off) if (!on.has(n)) this.active.delete(n);
      for (const n of on) if (!this.active.has(n) || off.has(n)) this.active.set(n, 0);
    }
    bits.X.fill(false);
    for (const n of this.active.keys()) if (n < SIZES.X) bits.X[n] = true;

    // A imagem de Q e M continua do ciclo anterior. As usadas como ação de etapa
    // valem "preso por SET OU alguma etapa ativa que a liga".
    for (const a of this.driven) bits[a.kind][a.index] = this.latched[a.kind as "Q" | "M"][a.index];
    for (const n of this.active.keys()) {
      for (const a of this.actions.get(n) ?? []) bits[a.kind][a.index] = true;
    }

    // Ladder
    this.rungs.forEach((r, k) => {
      const cond = evaluate(r.expr, this.mem);
      const rising = cond && !this.lastCond[k];
      this.lastCond[k] = cond;
      const t = r.target;
      if (!t) return;
      switch (r.coil) {
        case "out":
          bits[t.kind][t.index] = cond;
          break;
        case "set":
          if (cond) {
            bits[t.kind][t.index] = true;
            if (t.kind === "Q" || t.kind === "M") this.latched[t.kind][t.index] = true;
          }
          break;
        case "reset":
          if (cond) {
            bits[t.kind][t.index] = false;
            if (t.kind === "Q" || t.kind === "M") this.latched[t.kind][t.index] = false;
          }
          break;
        case "ton":
          this.timerTime[t.index] = cond ? this.timerTime[t.index] + dt : 0;
          bits.T[t.index] = cond && this.timerTime[t.index] >= r.preset - 1e-9;
          break;
        case "tof":
          if (cond) {
            this.timerTime[t.index] = 0;
            bits.T[t.index] = true;
          } else if (bits.T[t.index]) {
            this.timerTime[t.index] += dt;
            if (this.timerTime[t.index] >= r.preset - 1e-9) bits.T[t.index] = false;
          }
          break;
        case "ctu":
          if (rising) this.counts[t.index]++;
          bits.C[t.index] = this.counts[t.index] >= Math.max(1, r.preset);
          break;
        case "ctr":
          if (cond) {
            this.counts[t.index] = 0;
            bits.C[t.index] = false;
          }
          break;
      }
    });
    return bits.Q.slice();
  }

  state(): PlcState {
    return {
      inputs: this.bits.I.slice(),
      outputs: this.bits.Q.slice(),
      steps: [...this.active.keys()].sort((a, b) => a - b),
      memories: this.bits.M.flatMap((b, i) => (b ? [i] : [])),
      counts: this.counts.slice(0, 8),
    };
  }
}
