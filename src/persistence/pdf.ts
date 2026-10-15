/**
 * Gerador de PDF mínimo, sem bibliotecas: páginas A4 com textos (Helvetica) e uma
 * imagem JPEG por página (o desenho do circuito). Suficiente para imprimir o projeto
 * e entregar em aula, e não aumenta o tamanho do site.
 */

export const A4_LANDSCAPE = { w: 842, h: 595 };

export interface PdfText {
  x: number;
  /** Linha de base, medida de baixo para cima (como no PDF). */
  y: number;
  size: number;
  text: string;
  bold?: boolean;
}

export interface PdfImage {
  /** Bytes de um arquivo JPEG. */
  jpeg: Uint8Array;
  /** Tamanho da imagem em pixels. */
  width: number;
  height: number;
  /** Onde desenhar na página [pt]. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfPage {
  texts: PdfText[];
  image?: PdfImage;
}

/** Troca o que não existe na codificação WinAnsi (Latin-1) por equivalentes simples. */
function toWinAnsi(s: string): number[] {
  const map: Record<string, string> = { "−": "-", "–": "-", "—": "-", "→": "->", "←": "<-", "×": "x", "…": "...", "“": '"', "”": '"', "‘": "'", "’": "'", "●": "*", "○": "o" };
  const out: number[] = [];
  for (const ch of s) {
    const rep = map[ch] ?? ch;
    for (const c of rep) {
      const code = c.codePointAt(0)!;
      const b = code < 256 ? code : 63; // "?"
      if (b === 40 || b === 41 || b === 92) out.push(92); // ( ) \ precisam de escape
      out.push(b);
    }
  }
  return out;
}

class Writer {
  private chunks: Uint8Array[] = [];
  length = 0;
  ascii(s: string) {
    this.bytes(new TextEncoder().encode(s));
  }
  bytes(b: Uint8Array) {
    this.chunks.push(b);
    this.length += b.length;
  }
  result() {
    const out = new Uint8Array(this.length);
    let o = 0;
    for (const c of this.chunks) {
      out.set(c, o);
      o += c.length;
    }
    return out;
  }
}

export function buildPdf(pages: PdfPage[], title = "FluxoLab"): Uint8Array {
  const w = new Writer();
  const offsets: number[] = [];
  const obj = (n: number, body: () => void) => {
    offsets[n] = w.length;
    w.ascii(`${n} 0 obj\n`);
    body();
    w.ascii("\nendobj\n");
  };

  // 1 catálogo, 2 árvore de páginas, 3 e 4 fontes, 5 informações; depois 3 objetos por página.
  const first = 6;
  const pageIds = pages.map((_, i) => first + i * 3);
  w.ascii("%PDF-1.4\n%FluxoLab\n");
  obj(1, () => w.ascii("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => w.ascii(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
  obj(3, () => w.ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
  obj(4, () => w.ascii("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));
  obj(5, () => {
    w.ascii("<< /Producer (FluxoLab) /Title (");
    w.bytes(new Uint8Array(toWinAnsi(title)));
    w.ascii(") >>");
  });

  pages.forEach((page, i) => {
    const pageId = pageIds[i];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    obj(pageId, () =>
      w.ascii(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_LANDSCAPE.w} ${A4_LANDSCAPE.h}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >>${page.image ? ` /XObject << /Im1 ${imageId} 0 R >>` : ""} >> /Contents ${contentId} 0 R >>`,
      ),
    );
    // conteúdo da página
    const parts: number[] = [];
    const push = (s: string) => parts.push(...new TextEncoder().encode(s));
    if (page.image) {
      const im = page.image;
      push(`q ${im.w.toFixed(2)} 0 0 ${im.h.toFixed(2)} ${im.x.toFixed(2)} ${im.y.toFixed(2)} cm /Im1 Do Q\n`);
    }
    for (const tx of page.texts) {
      push(`BT /${tx.bold ? "F2" : "F1"} ${tx.size} Tf ${tx.x.toFixed(2)} ${tx.y.toFixed(2)} Td (`);
      parts.push(...toWinAnsi(tx.text));
      push(") Tj ET\n");
    }
    const content = new Uint8Array(parts);
    obj(contentId, () => {
      w.ascii(`<< /Length ${content.length} >>\nstream\n`);
      w.bytes(content);
      w.ascii("\nendstream");
    });
    obj(imageId, () => {
      if (!page.image) {
        w.ascii("null");
        return;
      }
      const im = page.image;
      w.ascii(`<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`);
      w.bytes(im.jpeg);
      w.ascii("\nendstream");
    });
  });

  const count = first + pages.length * 3;
  const xref = w.length;
  w.ascii(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) w.ascii(`${String(offsets[n] ?? 0).padStart(10, "0")} 00000 n \n`);
  w.ascii(`trailer\n<< /Size ${count} /Root 1 0 R /Info 5 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return w.result();
}
