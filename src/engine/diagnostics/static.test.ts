import { describe, expect, it } from "vitest";
import { getDef } from "@/symbols/registry";
import { TestCircuit } from "../test-utils";
import { checkProject } from "./static";

const lookup = (type: string) => {
  const def = getDef(type);
  return def && { domain: def.domain, sim: def.sim, ports: def.ports };
};
const codes = (c: TestCircuit) => checkProject(c.project, lookup).map((d) => `${d.code}:${d.port ?? ""}`);

describe("detector de erros (estático)", () => {
  it("circuito pneumático sem fonte de ar", () => {
    const c = new TestCircuit();
    c.add("pneu.cylinder.double-acting");
    expect(codes(c)).toContain("no-supply:");
  });

  it("conector solto avisa, mas escape (3, 5) solto não", () => {
    const c = new TestCircuit();
    const src = c.add("pneu.source.air");
    const v = c.add("pneu.valve.5-2.pilot-pilot");
    c.wire(src, "1", v, "1");
    const list = codes(c);
    expect(list).toContain("open-port:4");
    expect(list).toContain("open-port:2");
    expect(list).toContain("open-pilot:14");
    expect(list).not.toContain("open-port:3");
    expect(list).not.toContain("open-port:5");
  });

  it("rolete apontando para um cilindro que não existe", () => {
    const c = new TestCircuit();
    c.add("pneu.source.air");
    c.add("pneu.valve.3-2-nc.roller-spring", { cylinder: "A9" });
    expect(codes(c)).toContain("unknown-cylinder:");
  });

  it("rótulo repetido", () => {
    const c = new TestCircuit();
    c.add("pneu.source.air");
    c.add("pneu.cylinder.double-acting", {}, "1A1");
    c.add("pneu.cylinder.single-acting", {}, "1A1");
    expect(codes(c).filter((k) => k.startsWith("duplicate-label"))).toHaveLength(2);
  });
});
