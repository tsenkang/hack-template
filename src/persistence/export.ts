/**
 * Exportação: arquivo .json do projeto e imagem (SVG/PNG) do circuito aberto.
 * Tudo é gerado no navegador e baixado direto, sem servidor.
 */
import type { Project } from "@/engine/core/types";
import type { Rect } from "@/editor/geometry";
import { serializeProject } from "./file-format";

/** Cores fixas (tema claro) usadas nas imagens exportadas, para ficarem iguais em qualquer tema. */
const EXPORT_STYLE = `
  .sym { fill: none; stroke: #1f2937; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
  .sym-bg { fill: #ffffff; }
  .sym-solid { fill: #1f2937; stroke: none; }
  .sym.sym-solid { stroke: #1f2937; }
  .sym-dashed { stroke-dasharray: 4 3; }
  .sym-text, .label { fill: #1f2937; font-family: system-ui, sans-serif; }
  .label { font-size: 10px; font-weight: 600; }
`;

export function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nome de arquivo seguro a partir do nome do projeto. */
export function safeFileName(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "projeto"
  );
}

export function exportProjectJson(project: Project) {
  download(`${safeFileName(project.name)}.fluxolab.json`, new Blob([serializeProject(project)], { type: "application/json" }));
}

/** Monta um SVG independente com o conteúdo do circuito (sem grade, seleção nem conectores). */
export function buildCircuitSvg(content: SVGGElement, bounds: Rect, padding = 20): string {
  const clone = content.cloneNode(true) as SVGGElement;
  clone.removeAttribute("transform");
  clone.querySelectorAll("[data-export-ignore]").forEach((el) => el.remove());
  const x = bounds.x - padding;
  const y = bounds.y - padding;
  const w = bounds.w + 2 * padding;
  const h = bounds.h + 2 * padding;
  const serializer = new XMLSerializer();
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${w} ${h}" width="${w}" height="${h}">`,
    `<style>${EXPORT_STYLE}</style>`,
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff"/>`,
    serializer.serializeToString(clone),
    `</svg>`,
  ].join("");
}

export function exportSvg(svgText: string, baseName: string) {
  download(`${safeFileName(baseName)}.svg`, new Blob([svgText], { type: "image/svg+xml" }));
}

/** Converte o SVG em PNG com o dobro da resolução (fica nítido em projetor). */
export async function exportPng(svgText: string, baseName: string, scale = 2): Promise<void> {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("svg"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(img.width * scale);
    canvas.height = Math.ceil(img.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("png");
    download(`${safeFileName(baseName)}.png`, blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}
