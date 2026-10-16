/** Ações do editor usadas por botões, atalhos e menus (sem React). */
import { t } from "@/i18n";
import { selectActiveCircuit, selectViewport, useEditor } from "@/store/editor-store";
import { isSimulating } from "@/store/sim-store";
import { toast } from "@/store/toast-store";
import { getDef } from "@/symbols/registry";
import { componentBounds, fitRect, unionRects, zoomAt, type Rect } from "./geometry";

/** Caixa que envolve todas as peças do circuito aberto. */
export function circuitBounds(): Rect | null {
  const circuit = selectActiveCircuit(useEditor.getState());
  return unionRects(
    circuit.components.flatMap((c) => {
      const def = getDef(c.type);
      return def ? [componentBounds(c, def)] : [];
    }),
  );
}

export function fitAll() {
  const s = useEditor.getState();
  const bounds = circuitBounds();
  if (bounds) s.setViewport(fitRect(bounds, s.canvasSize));
}

export function zoomBy(factor: number) {
  const s = useEditor.getState();
  const { w, h } = s.canvasSize;
  s.setViewport(zoomAt(selectViewport(s), { x: w / 2, y: h / 2 }, factor));
}

/** Insere a peça no centro da área visível (duplo clique na biblioteca). */
export function insertAtCenter(type: string) {
  if (isSimulating()) {
    toast(t("sim.locked"));
    return;
  }
  const s = useEditor.getState();
  const v = selectViewport(s);
  const { w, h } = s.canvasSize;
  s.addComponent(type, { x: (w / 2 - v.x) / v.zoom, y: (h / 2 - v.y) / v.zoom });
}

/** Abre a aba do circuito, seleciona a peça e centraliza a vista nela (sem mudar o zoom). */
export function focusComponent(circuitId: string, componentId: string) {
  const s = useEditor.getState();
  s.setActiveCircuit(circuitId);
  const comp = selectActiveCircuit(useEditor.getState()).components.find((c) => c.id === componentId);
  const def = comp && getDef(comp.type);
  if (!comp || !def) return;
  if (!isSimulating()) useEditor.getState().select([componentId]);
  const b = componentBounds(comp, def);
  const v = selectViewport(useEditor.getState());
  const { w, h } = useEditor.getState().canvasSize;
  useEditor.getState().setViewport({ ...v, x: w / 2 - (b.x + b.w / 2) * v.zoom, y: h / 2 - (b.y + b.h / 2) * v.zoom });
}
