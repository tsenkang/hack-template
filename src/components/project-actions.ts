/** Ações de projeto (novo, salvar, abrir, importar, exportar) usadas pela barra e pelos atalhos. */
import { circuitBounds } from "@/editor/actions";
import { t } from "@/i18n";
import { buildCircuitSvg, exportPng, exportProjectJson, exportSvg } from "@/persistence/export";
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
