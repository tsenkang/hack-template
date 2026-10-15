/** Ações de projeto (novo, salvar, abrir, importar, exportar) usadas pela barra e pelos atalhos. */
import { circuitBounds } from "@/editor/actions";
import { t, tDynamic } from "@/i18n";
import { buildCircuitSvg, download, exportPng, exportProjectJson, exportSvg, rasterize, safeFileName } from "@/persistence/export";
import { A4_LANDSCAPE, buildPdf, type PdfPage } from "@/persistence/pdf";
import { parseProjectFile } from "@/persistence/file-format";
import { loadProject, saveProject } from "@/persistence/storage";
import { selectActiveCircuit, useEditor } from "@/store/editor-store";
import { toast } from "@/store/toast-store";
import { useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { staticDiagnostics } from "./diagnostics";

export async function saveNow() {
  await saveProject(useEditor.getState().project);
  toast(t("messages.saved"));
}

export async function newProject() {
  if (!confirm(t("dialogs.confirmNew"))) return;
  await saveProject(useEditor.getState().project);
  useEditor.getState().newProject();
}

export async function openSavedProject(id: string) {
  await saveProject(useEditor.getState().project);
  const project = await loadProject(id);
  if (project) {
    useEditor.getState().loadProject(project);
    useUi.getState().setOpenDialog(false);
  }
}

export async function importProjectFile(file: File) {
  const result = parseProjectFile(await file.text());
  if (!result.ok) {
    toast(t("messages.invalidFile", { reason: t(result.error, result.vars) }), "error");
    return;
  }
  await saveProject(useEditor.getState().project);
  useEditor.getState().loadProject(result.project);
  await saveProject(result.project);
  useUi.getState().setOpenDialog(false);
  toast(t("messages.imported", { name: result.project.name }));
}

export function exportJson() {
  exportProjectJson(useEditor.getState().project);
}

/** Exporta o circuito da aba aberta como imagem. */
export async function exportImage(kind: "svg" | "png") {
  const content = document.getElementById("circuit-content") as SVGGElement | null;
  const bounds = circuitBounds();
  if (!content || !bounds) return;
  const s = useEditor.getState();
  const name = `${s.project.name}-${selectActiveCircuit(s).name}`;
  const svg = buildCircuitSvg(content, bounds);
  try {
    if (kind === "svg") exportSvg(svg, name);
    else await exportPng(svg, name);
  } catch {
    toast(t("messages.exportFailed"), "error");
  }
}

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * PDF do projeto: uma página A4 deitada por aba (desenho + título) e, no fim, a lista de peças.
 * As abas são desenhadas uma a uma na tela e capturadas; no fim volta para a aba original.
 */
export async function exportPdf() {
  const editor = useEditor.getState();
  const original = editor.activeCircuitId;
  const project = editor.project;
  const date = new Date().toLocaleDateString("pt-BR");
  const margin = 36;
  const pages: PdfPage[] = [];
  try {
    for (const circuit of project.circuits) {
      useEditor.getState().setActiveCircuit(circuit.id);
      await nextFrame();
      const content = document.getElementById("circuit-content") as SVGGElement | null;
      const bounds = circuitBounds();
      const header = [
        { x: margin, y: A4_LANDSCAPE.h - margin - 4, size: 15, text: `${project.name} — ${circuit.name}`, bold: true },
        { x: margin, y: A4_LANDSCAPE.h - margin - 20, size: 9, text: t("pdf.footer", { date }) },
      ];
      if (!content || !bounds) {
        pages.push({ texts: [...header, { x: margin, y: A4_LANDSCAPE.h / 2, size: 11, text: t("pdf.emptyTab") }] });
        continue;
      }
      const svg = buildCircuitSvg(content, bounds);
      const availW = A4_LANDSCAPE.w - 2 * margin;
      const availH = A4_LANDSCAPE.h - 2 * margin - 34;
      const fit = Math.min(availW / (bounds.w + 40), availH / (bounds.h + 40));
      const { blob, width, height } = await rasterize(svg, Math.min(4, Math.max(1.5, fit * 2.5)), "image/jpeg");
      const w = width * (availW / width > availH / height ? availH / height : availW / width);
      const h = height * (w / width);
      pages.push({
        texts: header,
        image: { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height, x: margin + (availW - w) / 2, y: margin + (availH - h) / 2, w, h },
      });
    }
  } catch {
    toast(t("messages.exportFailed"), "error");
    return;
  } finally {
    useEditor.getState().setActiveCircuit(original);
  }

  // lista de peças (todas as abas), 32 linhas por página
  const rows = new Map<string, { qty: number; labels: string[] }>();
  for (const c of project.circuits) {
    for (const k of c.components) {
      const row = rows.get(k.type) ?? { qty: 0, labels: [] };
      row.qty++;
      if (k.label) row.labels.push(k.label);
      rows.set(k.type, row);
    }
  }
  const list = [...rows.entries()];
  for (let i = 0; i < list.length || i === 0; i += 32) {
    const texts = [
      { x: margin, y: A4_LANDSCAPE.h - margin - 4, size: 15, text: `${project.name} — ${t("bottom.parts")}`, bold: true },
      { x: margin, y: A4_LANDSCAPE.h - margin - 34, size: 10, text: t("bottom.colQty"), bold: true },
      { x: margin + 50, y: A4_LANDSCAPE.h - margin - 34, size: 10, text: t("bottom.colPart"), bold: true },
      { x: margin + 430, y: A4_LANDSCAPE.h - margin - 34, size: 10, text: t("bottom.colLabels"), bold: true },
    ];
    list.slice(i, i + 32).forEach(([type, r], k) => {
      const y = A4_LANDSCAPE.h - margin - 52 - k * 14.5;
      texts.push({ x: margin, y, size: 10, text: String(r.qty), bold: false });
      texts.push({ x: margin + 50, y, size: 10, text: tDynamic(`parts.${type}.name`), bold: false });
      texts.push({ x: margin + 430, y, size: 10, text: r.labels.join(", ").slice(0, 70), bold: false });
    });
    pages.push({ texts });
    if (list.length === 0) break;
  }
  const pdf = buildPdf(pages, project.name);
  download(`${safeFileName(project.name)}.pdf`, new Blob([pdf.slice().buffer], { type: "application/pdf" }));
}

/** Inicia (ou retoma) a simulação. Se o desenho tem erros graves, pergunta antes. */
export function startSimulation() {
  const sim = useSim.getState();
  if (sim.status === "stopped") {
    const errors = staticDiagnostics(useEditor.getState().project).filter((d) => d.severity === "error");
    if (errors.length > 0 && !confirm(t("diagnostics.confirmRun", { count: errors.length }))) {
      useUi.getState().setBottomTab("warnings");
      return;
    }
  }
  sim.start();
}
