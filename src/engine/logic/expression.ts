/**
 * Condições lógicas do CLP e do GRAFCET, escritas como texto:
 *
 *   I0 & !I1            E, NÃO
 *   (I0 | Q0) & !I2     OU, parênteses
 *   X2 & 3s/X2          etapa 2 ativa há pelo menos 3 s (temporização do GRAFCET)
 *   1                   sempre verdadeiro
 *
 * Operandos: I (entradas), Q (saídas), M (memórias), T (temporizadores),
 * C (contadores) e X (etapas do GRAFCET), seguidos do número.
 * O mesmo texto vira a árvore usada para executar e para desenhar o ladder
 * (E = contatos em série, OU = ramos em paralelo).
 */

export type OperandKind = "I" | "Q" | "M" | "T" | "C" | "X";

export type Expr =
  | { type: "const"; value: boolean }
  | { type: "var"; kind: OperandKind; index: number; negated: boolean }
  /** `3s/X2`: a etapa `step` está ativa há pelo menos `seconds`. */
  | { type: "timer"; seconds: number; step: number; negated: boolean }
  | { type: "and"; items: Expr[] }
  | { type: "or"; items: Expr[] };

export type ParseResult = { ok: true; expr: Expr } | { ok: false; error: string; at: number };

const OPERAND = /^([IQMTCX])(\d{1,3})/i;
const TIMER = /^(\d+(?:[.,]\d+)?)\s*s\s*\/\s*X(\d{1,3})/i;

class Parser {
  private pos = 0;
  constructor(private readonly src: string) {}

  private skip() {
    while (this.pos < this.src.length && /\s/.test(this.src[this.pos])) this.pos++;
  }

  private peek() {
    this.skip();
    return this.src[this.pos];
  }

  fail(error: string): never {
    throw Object.assign(new Error(error), { at: this.pos });
  }

  parse(): Expr {
    if (this.peek() === undefined) this.fail("empty");
    const e = this.or();
    if (this.peek() !== undefined) this.fail("unexpected");
    return e;
  }

  private or(): Expr {
    const items = [this.and()];
    while (this.peek() === "|" || this.peek() === "+") {
      this.pos++;
      items.push(this.and());
    }
    return items.length === 1 ? items[0] : { type: "or", items };
  }

  private and(): Expr {
    const items = [this.unary()];
    while (this.peek() === "&" || this.peek() === "*" || this.peek() === "·") {
      this.pos++;
      items.push(this.unary());
    }
    return items.length === 1 ? items[0] : { type: "and", items };
  }

  private unary(): Expr {
    const c = this.peek();
    if (c === "!" || c === "/" || c === "~") {
      this.pos++;
      return negate(this.unary());
    }
    if (c === "(") {
      this.pos++;
      const e = this.or();
      if (this.peek() !== ")") this.fail("paren");
      this.pos++;
      return e;
    }
    const rest = this.src.slice(this.pos);
    const timer = TIMER.exec(rest);
    if (timer) {
      this.pos += timer[0].length;
      return { type: "timer", seconds: Number(timer[1].replace(",", ".")), step: Number(timer[2]), negated: false };
    }
    const op = OPERAND.exec(rest);
    if (op) {
      this.pos += op[0].length;
      return { type: "var", kind: op[1].toUpperCase() as OperandKind, index: Number(op[2]), negated: false };
    }
    if (c === "1" || c === "0") {
      this.pos++;
      return { type: "const", value: c === "1" };
    }
    this.fail(c === undefined ? "incomplete" : "unexpected");
  }
}

/** NÃO de uma expressão (De Morgan para E/OU, para o ladder continuar só com contatos). */
export function negate(e: Expr): Expr {
  switch (e.type) {
    case "const":
      return { type: "const", value: !e.value };
    case "var":
    case "timer":
      return { ...e, negated: !e.negated };
    case "and":
      return { type: "or", items: e.items.map(negate) };
    case "or":
      return { type: "and", items: e.items.map(negate) };
  }
}

export function parseExpression(src: string): ParseResult {
  try {
    return { ok: true, expr: new Parser(src).parse() };
  } catch (err) {
    const e = err as Error & { at?: number };
    return { ok: false, error: e.message, at: e.at ?? 0 };
  }
}

/** Valor atual de um operando. */
export interface Memory {
  get(kind: OperandKind, index: number): boolean;
  /** Tempo [s] desde que a etapa ficou ativa (−1 se inativa). */
  stepTime(step: number): number;
}

export function evaluate(e: Expr, mem: Memory): boolean {
  switch (e.type) {
    case "const":
      return e.value;
    case "var":
      return mem.get(e.kind, e.index) !== e.negated;
    case "timer": {
      const t = mem.stepTime(e.step);
      return (t >= e.seconds) !== e.negated;
    }
    case "and":
      return e.items.every((x) => evaluate(x, mem));
    case "or":
      return e.items.some((x) => evaluate(x, mem));
  }
}

/** Texto canônico (para mostrar e salvar). */
export function formatExpression(e: Expr, parent: "and" | "or" | null = null): string {
  switch (e.type) {
    case "const":
      return e.value ? "1" : "0";
    case "var":
      return `${e.negated ? "!" : ""}${e.kind}${e.index}`;
    case "timer":
      return `${e.negated ? "!" : ""}${e.seconds}s/X${e.step}`;
    case "and": {
      const s = e.items.map((x) => formatExpression(x, "and")).join(" & ");
      return s;
    }
    case "or": {
      const s = e.items.map((x) => formatExpression(x, "or")).join(" | ");
      return parent === "and" ? `(${s})` : s;
    }
  }
}
