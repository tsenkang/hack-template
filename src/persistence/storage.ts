/**
 * Projetos salvos no IndexedDB deste navegador (nada vai para servidor).
 * Cada projeto é guardado no mesmo formato do arquivo .json.
 */
import { createStore, del, entries, get, set } from "idb-keyval";
import type { Project } from "@/engine/core/types";
import { parseProjectData, toProjectFile } from "./file-format";

const LAST_KEY = "fluxolab:last-project";

let store: ReturnType<typeof createStore> | null = null;
function db() {
  store ??= createStore("fluxolab", "projects");
  return store;
}

export interface SavedProjectInfo {
  id: string;
  name: string;
  updatedAt: string;
}

export async function saveProject(project: Project): Promise<void> {
  await set(project.id, toProjectFile(project), db());
  try {
    localStorage.setItem(LAST_KEY, project.id);
  } catch {
    // sem localStorage: só não lembra qual foi o último projeto
  }
}

export async function loadProject(id: string): Promise<Project | null> {
  const parsed = parseProjectData(await get(id, db()));
  return parsed.ok ? parsed.project : null;
}

export async function listProjects(): Promise<SavedProjectInfo[]> {
  const all = await entries(db());
  const list: SavedProjectInfo[] = [];
  for (const [, value] of all) {
    const parsed = parseProjectData(value);
    if (parsed.ok) list.push({ id: parsed.project.id, name: parsed.project.name, updatedAt: parsed.project.updatedAt });
  }
  return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function deleteProject(id: string): Promise<void> {
  await del(id, db());
}

/** Último projeto aberto neste navegador (para reabrir ao carregar o app). */
export async function loadLastProject(): Promise<Project | null> {
  let id: string | null = null;
  try {
    id = localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
  return id ? loadProject(id) : null;
}
