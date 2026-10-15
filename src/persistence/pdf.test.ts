import { describe, expect, it } from "vitest";
import { buildPdf } from "./pdf";

const text = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

describe("PDF", () => {
  it("gera um PDF válido com tabela de referências correta", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdf(
      [
        { texts: [{ x: 40, y: 560, size: 16, text: "Válvula 5/2 (piloto) → A1+", bold: true }], image: { jpeg, width: 1, height: 1, x: 40, y: 40, w: 100, h: 100 } },
        { texts: [{ x: 40, y: 560, size: 10, text: "Lista de peças" }] },
      ],
      "Projeto ação",
    );
    const s = text(pdf);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Count 2");
    // cada entrada do xref aponta para o início do objeto certo
    const xrefAt = Number(/startxref\n(\d+)/.exec(s)![1]);
    const lines = s.slice(xrefAt).split("\n");
    const count = Number(lines[1].split(" ")[1]);
    for (let n = 1; n < count; n++) {
      const off = Number(lines[2 + n].slice(0, 10));
      expect(s.slice(off, off + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    }
    // acentos em Latin-1, parênteses com escape e seta trocada
    expect(s).toContain("V\xe1lvula 5/2 \\(piloto\\) -> A1+");
  });
});
