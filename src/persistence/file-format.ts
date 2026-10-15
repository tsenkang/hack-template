/**
 * Formato do arquivo de projeto (.json) com número de versão.
 *
 * Ao mudar o formato: aumente FILE_VERSION e acrescente em MIGRATIONS a função
 * que converte a versão anterior para a nova. Arquivos antigos continuam abrindo.
 */
import type { Project } from "@/engine/core/types";
import type { I18nKey } from "@/i18n";

export const FILE_FORMAT = "fluxolab";
export const FILE_VERSION = 1;

export interface ProjectFile {
  format: typeof FILE_FORMAT;
  version: number;
  savedAt: string;
  project: Project;
}

/** MIGRATIONS[n] converte o conteúdo da versão n para a versão n + 1. */
const MIGRATIONS: Record<number, (data: Record<string, unknown>) => Record<string, unknown>> = {};

export type ParseResult =
  | { ok: true; project: Project }
  | { ok: false; error: I18nKey; vars?: Record<string, string | number> };

export function toProjectFile(project: Project): ProjectFile {
  return { format: FILE_FORMAT, version: FILE_VERSION, savedAt: new Date().toISOString(), project };
}

export function serializeProject(project: Project): string {
  return JSON.stringify(toProjectFile(project), null, 2);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isValidProject(p: unknown): p is Project {
  if (!isObj(p) || !isStr(p.id) || !isStr(p.name) || !Array.isArray(p.circuits) || p.circuits.length === 0) return false;
  return p.circuits.every(
    (c) =>
      isObj(c) &&
      isStr(c.id) &&
      isStr(c.name) &&
      Array.isArray(c.connections) &&
      Array.isArray(c.components) &&
      c.components.every(
        (k) =>
          isObj(k) &&
          isStr(k.id) &&
          isStr(k.type) &&
          isNum(k.x) &&
          isNum(k.y) &&
          [0, 90, 180, 270].includes(k.rotation as number) &&
          typeof k.mirrored === "boolean" &&
          isStr(k.label) &&
          isObj(k.params),
      ),
  );
}

/** Lê um arquivo de projeto em qualquer versão conhecida e devolve o projeto atualizado. */
export function parseProjectFile(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "fileErrors.notJson" };
  }
  return parseProjectData(data);
}

export function parseProjectData(data: unknown): ParseResult {
  if (!isObj(data) || data.format !== FILE_FORMAT || !isNum(data.version)) {
    return { ok: false, error: "fileErrors.notFluxoLab" };
  }
  if (data.version > FILE_VERSION) {
    return { ok: false, error: "fileErrors.tooNew", vars: { version: data.version } };
  }
  let current: Record<string, unknown> = data;
  for (let v = data.version; v < FILE_VERSION; v++) {
    const migrate = MIGRATIONS[v];
    if (!migrate) return { ok: false, error: "fileErrors.malformed" };
    current = { ...migrate(current), version: v + 1 };
  }
  if (!isValidProject(current.project)) return { ok: false, error: "fileErrors.malformed" };
  return { ok: true, project: current.project };
}
