import { describe, expect, it } from "vitest";
import { en } from "./en";
import { es } from "./es";
import { ptBR } from "./pt-BR";

type Tree = { [k: string]: string | Tree };

function flatten(t: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(t)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [kk, vv] of flatten(v, key)) out.set(kk, vv);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

describe("idiomas", () => {
  const base = flatten(ptBR as unknown as Tree);
  for (const [name, dict] of [["en", en], ["es", es]] as const) {
    it(`${name}: mesmas chaves, nada vazio e as mesmas variáveis {…}`, () => {
      const other = flatten(dict as unknown as Tree);
      expect([...other.keys()].sort()).toEqual([...base.keys()].sort());
      for (const [k, v] of base) {
        const tr = other.get(k)!;
        expect(tr.trim().length, k).toBeGreaterThan(0);
        expect(placeholders(tr), k).toBe(placeholders(v));
      }
    });
  }
});
