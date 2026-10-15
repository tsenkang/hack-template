import { describe, expect, it } from "vitest";
import { tDynamic } from "@/i18n";
import { COMPONENT_DEFS } from "./registry";
import { GRID } from "./types";

describe("biblioteca de peças", () => {
  it("tipos são únicos", () => {
    const types = COMPONENT_DEFS.map((d) => d.type);
    expect(new Set(types).size).toBe(types.length);
  });

  it.each(COMPONENT_DEFS.map((d) => [d.type, d] as const))("%s: tamanho e conectores na grade", (_, def) => {
    expect(def.width % GRID).toBe(0);
    expect(def.height % GRID).toBe(0);
    const ids = new Set<string>();
    for (const p of def.ports) {
      expect(p.x % GRID, `conector ${p.id}`).toBe(0);
      expect(p.y % GRID, `conector ${p.id}`).toBe(0);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(def.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(def.height);
      expect(ids.has(p.id), `conector ${p.id} repetido`).toBe(false);
      ids.add(p.id);
    }
  });

  it.each(COMPONENT_DEFS.map((d) => [d.type, d] as const))("%s: tem nome, descrição e textos dos parâmetros", (type, def) => {
    for (const key of [`parts.${type}.name`, `parts.${type}.description`]) expect(tDynamic(key)).not.toBe(key);
    for (const p of def.params) {
      expect(tDynamic(`params.${p.key}.label`)).not.toBe(`params.${p.key}.label`);
      expect(tDynamic(`params.${p.key}.help`)).not.toBe(`params.${p.key}.help`);
    }
  });
});
