import { describe, expect, it } from "vitest";
import { TestCircuit } from "@/engine/test-utils";
import { computeLadder } from "./ladder";

describe("esquema em escada", () => {
  it("numera as colunas e lista onde estão os contatos de K1", () => {
    const c = new TestCircuit();
    const place = (type: string, x: number, label?: string) => {
      const id = c.add(type, {}, label);
      const comp = c.project.circuits[0].components.find((k) => k.id === id)!;
      comp.x = x;
      comp.y = 100;
      return id;
    };
    place("elec.pushbutton.no", 0); // coluna 1
    const k1 = place("elec.relay.coil", 0, "K1"); // mesma coluna 1
    place("elec.relay.contact-no", 100, "K1"); // coluna 2
    place("elec.relay.contact-nc", 200, "K1"); // coluna 3
    place("elec.lamp", 200); // coluna 3
    const ladder = computeLadder(c.project.circuits[0])!;
    expect(ladder.columns.map((col) => col.number)).toEqual([1, 2, 3]);
    const ref = ladder.crossRefs.find((r) => r.componentId === k1)!;
    expect(ref.no).toEqual([2]);
    expect(ref.nc).toEqual([3]);
  });
});
