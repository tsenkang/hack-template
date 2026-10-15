/**
 * Estado principal do editor (Zustand): projeto aberto, histórico de desfazer/refazer,
 * seleção, área de transferência e viewport de cada aba.
 *
 * Só o `project` entra no histórico. Seleção e zoom não são "desfeitos".
 */
import { create } from "zustand";
import { createId } from "@/engine/core/ids";
import type { ComponentInstance, Connection, ParamValue, Point, PortRef, Project } from "@/engine/core/types";
import { alignRects, componentBounds, rotateAroundCenter, snap, type AlignMode, type Viewport } from "@/editor/geometry";
import { getDef } from "@/symbols/registry";
import { createCircuit, createInstance, createProject, nextLabel, updateCircuit, updateComponents } from "./project-model";

/** Limite de segurança do histórico (na prática, "ilimitado" para uma aula inteira). */
const HISTORY_LIMIT = 1000;
const PASTE_OFFSET = 20;
export const DEFAULT_VIEWPORT: Viewport = { x: 80, y: 60, zoom: 1.5 };

/** Área de transferência: peças e as linhas entre elas. */
export interface Clipboard {
  components: ComponentInstance[];
  connections: Connection[];
}

const samePort = (a: PortRef, b: PortRef) => a.componentId === b.componentId && a.portId === b.portId;

export interface EditorState {
  project: Project;
  activeCircuitId: string;
  past: Project[];
  future: Project[];
  /** Projeto no início de um gesto (ex.: arrastar). O gesto inteiro vira 1 passo de desfazer. */
  gestureBase: Project | null;
  selection: string[];
  clipboard: Clipboard;
  pasteCount: number;
  viewports: Record<string, Viewport>;
  canvasSize: { w: number; h: number };
  snapEnabled: boolean;

  loadProject(project: Project): void;
  newProject(): void;
  setProjectName(name: string): void;

  addCircuit(): void;
  renameCircuit(id: string, name: string): void;
  removeCircuit(id: string): void;
  setActiveCircuit(id: string): void;

  addComponent(type: string, at: Point): string | null;
  setPositions(positions: Record<string, Point>): void;
  addConnection(from: PortRef, to: PortRef): string | null;
  nudgeSelection(dx: number, dy: number): void;
  rotateSelection(): void;
  mirrorSelection(): void;
  deleteSelection(): void;
  alignSelection(mode: AlignMode): void;
  setLabel(id: string, label: string): void;
  setParam(id: string, key: string, value: ParamValue): void;

  copySelection(): void;
  cutSelection(): void;
  paste(): void;
  duplicateSelection(): void;

  select(ids: string[]): void;
  toggleSelected(id: string): void;
  selectAll(): void;

  beginGesture(): void;
  endGesture(): void;
  undo(): void;
  redo(): void;

  setViewport(v: Viewport): void;
  setCanvasSize(size: { w: number; h: number }): void;
  toggleSnap(): void;
}

function initialState() {
  const project = createProject();
  return {
    project,
    activeCircuitId: project.circuits[0].id,
    past: [] as Project[],
    future: [] as Project[],
    gestureBase: null as Project | null,
    selection: [] as string[],
    clipboard: { components: [], connections: [] } as Clipboard,
    pasteCount: 0,
    viewports: {} as Record<string, Viewport>,
  };
}

export const useEditor = create<EditorState>()((set, get) => {
  /** Grava uma alteração no projeto, registrando no histórico (exceto no meio de um gesto). */
  const commit = (next: Project, extra: Partial<EditorState> = {}) => {
    const { project, past, gestureBase } = get();
    if (next === project) return;
    if (gestureBase) {
      set({ project: next, ...extra });
      return;
    }
    set({ project: next, past: [...past, project].slice(-HISTORY_LIMIT), future: [], ...extra });
  };

  const activeCircuit = () => {
    const { project, activeCircuitId } = get();
    return project.circuits.find((c) => c.id === activeCircuitId) ?? project.circuits[0];
  };

  const selectedSet = () => new Set(get().selection);

  /** Depois de desfazer/refazer: garante aba ativa válida e remove da seleção o que sumiu. */
  const reconcile = (project: Project) => {
    const { activeCircuitId, selection } = get();
    const circuit = project.circuits.find((c) => c.id === activeCircuitId) ?? project.circuits[0];
    const ids = new Set([...circuit.components.map((c) => c.id), ...circuit.connections.map((w) => w.id)]);
    return { activeCircuitId: circuit.id, selection: selection.filter((id) => ids.has(id)) };
  };

  /** Peças selecionadas + linhas que ligam duas delas. */
  const selectionClipboard = (): Clipboard => {
    const ids = selectedSet();
    const circuit = activeCircuit();
    const components = circuit.components.filter((c) => ids.has(c.id));
    const inside = new Set(components.map((c) => c.id));
    const connections = circuit.connections.filter((w) => inside.has(w.from.componentId) && inside.has(w.to.componentId));
    return { components, connections };
  };

  /** Insere cópias das peças e das linhas entre elas (ids e rótulos novos), deslocadas de `offset`. */
  const insertCopies = (source: Clipboard, offset: number) => {
    const { project } = get();
    const reserved = new Set<string>();
    const newId = new Map<string, string>();
    const copies = source.components.map((comp) => {
      const def = getDef(comp.type);
      const label = def ? nextLabel(project, def.labelPrefix, reserved) : comp.label;
      reserved.add(label);
      const id = createId("k");
      newId.set(comp.id, id);
      return { ...comp, id, x: comp.x + offset, y: comp.y + offset, label, params: { ...comp.params } };
    });
    const wires = source.connections.map((w) => ({
      id: createId("w"),
      from: { ...w.from, componentId: newId.get(w.from.componentId)! },
      to: { ...w.to, componentId: newId.get(w.to.componentId)! },
      waypoints: [],
    }));
    commit(
      updateCircuit(project, activeCircuit().id, (c) => ({
        ...c,
        components: [...c.components, ...copies],
        connections: [...c.connections, ...wires],
      })),
      { selection: copies.map((c) => c.id) },
    );
  };

  return {
    ...initialState(),
    canvasSize: { w: 800, h: 600 },
    snapEnabled: true,

    loadProject(project) {
      set({ ...initialState(), project, activeCircuitId: project.circuits[0].id });
    },
    newProject() {
      set(initialState());
    },
    setProjectName(name) {
      commit({ ...get().project, name });
    },

    addCircuit() {
      const { project } = get();
      const circuit = createCircuit(project.circuits.length + 1);
      commit({ ...project, circuits: [...project.circuits, circuit] }, { activeCircuitId: circuit.id, selection: [] });
    },
    renameCircuit(id, name) {
      const trimmed = name.trim();
      if (!trimmed) return;
      commit(updateCircuit(get().project, id, (c) => ({ ...c, name: trimmed })));
    },
    removeCircuit(id) {
      const { project, activeCircuitId } = get();
      if (project.circuits.length <= 1) return;
      const index = project.circuits.findIndex((c) => c.id === id);
      const circuits = project.circuits.filter((c) => c.id !== id);
      const nextActive = activeCircuitId === id ? circuits[Math.max(0, index - 1)].id : activeCircuitId;
      commit({ ...project, circuits }, { activeCircuitId: nextActive, selection: [] });
    },
    setActiveCircuit(id) {
      if (id !== get().activeCircuitId) set({ activeCircuitId: id, selection: [] });
    },

    addComponent(type, at) {
      const def = getDef(type);
      if (!def) return null;
      const { project } = get();
      // `at` é o centro desejado; a posição guardada é o canto superior esquerdo.
      const inst = createInstance(project, type, snap(at.x - def.width / 2), snap(at.y - def.height / 2));
      commit(
        updateCircuit(project, activeCircuit().id, (c) => ({ ...c, components: [...c.components, inst] })),
        { selection: [inst.id] },
      );
      return inst.id;
    },
    setPositions(positions) {
      const ids = new Set(Object.keys(positions));
      commit(updateComponents(get().project, activeCircuit().id, ids, (c) => ({ ...c, ...positions[c.id] })));
    },
    addConnection(from, to) {
      if (samePort(from, to)) return null;
      const circuit = activeCircuit();
      const exists = circuit.connections.some(
        (w) => (samePort(w.from, from) && samePort(w.to, to)) || (samePort(w.from, to) && samePort(w.to, from)),
      );
      if (exists) return null;
      const wire: Connection = { id: createId("w"), from, to, waypoints: [] };
      commit(
        updateCircuit(get().project, circuit.id, (c) => ({ ...c, connections: [...c.connections, wire] })),
        { selection: [wire.id] },
      );
      return wire.id;
    },
    nudgeSelection(dx, dy) {
      const ids = selectedSet();
      if (ids.size === 0) return;
      commit(updateComponents(get().project, activeCircuit().id, ids, (c) => ({ ...c, x: c.x + dx, y: c.y + dy })));
    },
    rotateSelection() {
      const ids = selectedSet();
      if (ids.size === 0) return;
      commit(
        updateComponents(get().project, activeCircuit().id, ids, (c) => {
          const def = getDef(c.type);
          return def ? { ...c, ...rotateAroundCenter(c, def) } : c;
        }),
      );
    },
    mirrorSelection() {
      const ids = selectedSet();
      if (ids.size === 0) return;
      commit(updateComponents(get().project, activeCircuit().id, ids, (c) => ({ ...c, mirrored: !c.mirrored })));
    },
    deleteSelection() {
      const ids = selectedSet();
      if (ids.size === 0) return;
      commit(
        updateCircuit(get().project, activeCircuit().id, (c) => ({
          ...c,
          components: c.components.filter((comp) => !ids.has(comp.id)),
          connections: c.connections.filter(
            (w) => !ids.has(w.id) && !ids.has(w.from.componentId) && !ids.has(w.to.componentId),
          ),
        })),
        { selection: [] },
      );
    },
    alignSelection(mode) {
      const ids = selectedSet();
      const comps = activeCircuit().components.filter((c) => ids.has(c.id));
      if (comps.length < 2) return;
      const rects = comps.map((c) => componentBounds(c, getDef(c.type) ?? { width: 0, height: 0 }));
      const targets = alignRects(rects, mode);
      get().setPositions(Object.fromEntries(comps.map((c, i) => [c.id, targets[i]])));
    },
    setLabel(id, label) {
      commit(updateComponents(get().project, activeCircuit().id, new Set([id]), (c) => ({ ...c, label })));
    },
    setParam(id, key, value) {
      commit(
        updateComponents(get().project, activeCircuit().id, new Set([id]), (c) => ({
          ...c,
          params: { ...c.params, [key]: value },
        })),
      );
    },

    copySelection() {
      const clipboard = selectionClipboard();
      if (clipboard.components.length) set({ clipboard, pasteCount: 0 });
    },
    cutSelection() {
      get().copySelection();
      get().deleteSelection();
    },
    paste() {
      const { clipboard, pasteCount } = get();
      if (!clipboard.components.length) return;
      const count = pasteCount + 1;
      set({ pasteCount: count });
      insertCopies(clipboard, PASTE_OFFSET * count);
    },
    duplicateSelection() {
      const source = selectionClipboard();
      if (source.components.length) insertCopies(source, PASTE_OFFSET);
    },

    select(ids) {
      set({ selection: ids });
    },
    toggleSelected(id) {
      const { selection } = get();
      set({ selection: selection.includes(id) ? selection.filter((s) => s !== id) : [...selection, id] });
    },
    selectAll() {
      set({ selection: activeCircuit().components.map((c) => c.id) });
    },

    beginGesture() {
      if (!get().gestureBase) set({ gestureBase: get().project });
    },
    endGesture() {
      const { gestureBase, project, past } = get();
      if (!gestureBase) return;
      if (gestureBase === project) set({ gestureBase: null });
      else set({ gestureBase: null, past: [...past, gestureBase].slice(-HISTORY_LIMIT), future: [] });
    },
    undo() {
      const { past, future, project, gestureBase } = get();
      if (gestureBase || past.length === 0) return;
      const previous = past[past.length - 1];
      set({ project: previous, past: past.slice(0, -1), future: [project, ...future], ...reconcile(previous) });
    },
    redo() {
      const { past, future, project, gestureBase } = get();
      if (gestureBase || future.length === 0) return;
      const next = future[0];
      set({ project: next, past: [...past, project], future: future.slice(1), ...reconcile(next) });
    },

    setViewport(v) {
      set({ viewports: { ...get().viewports, [get().activeCircuitId]: v } });
    },
    setCanvasSize(size) {
      set({ canvasSize: size });
    },
    toggleSnap() {
      set({ snapEnabled: !get().snapEnabled });
    },
  };
});

/** Circuito da aba ativa. */
export function selectActiveCircuit(s: EditorState) {
  return s.project.circuits.find((c) => c.id === s.activeCircuitId) ?? s.project.circuits[0];
}

export function selectViewport(s: EditorState): Viewport {
  return s.viewports[s.activeCircuitId] ?? DEFAULT_VIEWPORT;
}
