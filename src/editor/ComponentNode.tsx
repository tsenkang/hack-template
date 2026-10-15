"use client";

import clsx from "clsx";
import { memo } from "react";
import type { ComponentSimState } from "@/engine/core/sim-types";
import type { ComponentInstance } from "@/engine/core/types";
import { tDynamic } from "@/i18n";
import { useEditor } from "@/store/editor-store";
import { useSim } from "@/store/sim-store";
import { useUi } from "@/store/ui-store";
import { getDef } from "@/symbols/registry";
import { componentBounds, localToWorld, svgTransform } from "./geometry";

interface Props {
  comp: ComponentInstance;
  selected: boolean;
  /** Ids dos conectores sem nenhuma linha, separados por vírgula (string para o memo comparar barato). */
  openPorts: string;
  simulating: boolean;
  /** Visível na tela: só então acompanha a simulação. */
  live: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onPortPointerDown: (e: React.PointerEvent, id: string, portId: string) => void;
}

const lastPlcClick = { id: "", t: 0 };

/** Uma peça no desenho: símbolo, conectores, rótulo e contorno de seleção. */
export const ComponentNode = memo(function ComponentNode({
  comp,
  selected,
  openPorts,
  simulating,
  live,
  onPointerDown,
  onPortPointerDown,
}: Props) {
  // Cada peça lê só o próprio estado: as outras não são redesenhadas quando esta muda.
  const simState: ComponentSimState | undefined = useSim((s) => (live ? s.snapshot?.components[comp.id] : undefined));
  const def = getDef(comp.type);
  if (!def) return null;
  const { Symbol } = def;
  const b = componentBounds(comp, def);
  const name = tDynamic(`parts.${comp.type}.name`);
  const open = new Set(openPorts ? openPorts.split(",") : []);

  return (
    <g
      className={clsx("component", simulating && def.interactive && "interactive")}
      data-component-id={comp.id}
      data-type={comp.type}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // Teclado: Enter seleciona; na simulação, Espaço/Enter aciona a peça enquanto segura.
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        if (simulating) {
          if (def.interactive && !e.repeat) useSim.getState().actuate(comp.id, "left", true);
        } else useEditor.getState().select([comp.id]);
      }}
      onKeyUp={(e) => {
        if (simulating && def.interactive && (e.key === "Enter" || e.key === " ")) useSim.getState().actuate(comp.id, "left", false);
      }}
      aria-label={comp.label ? `${name} ${comp.label}` : name}
      aria-pressed={selected}
      onPointerDown={(e) => {
        onPointerDown(e, comp.id);
        // CLP: dois cliques abrem o editor do programa. (O desenho captura o ponteiro,
        // então o evento dblclick não chega aqui; contamos os cliques na mão.)
        if (def.sim?.kind === "elec-plc") {
          const now = performance.now();
          if (lastPlcClick.id === comp.id && now - lastPlcClick.t < 450) {
            useEditor.getState().select([comp.id]);
            useUi.getState().setPlcEditor(true);
          }
          lastPlcClick.id = comp.id;
          lastPlcClick.t = now;
        }
      }}
    >
      <g transform={svgTransform(comp, def)}>
        {/* área de clique: a caixa inteira, não só os traços */}
        <rect className="hit" x={0} y={0} width={def.width} height={def.height} />
        <Symbol params={comp.params} state={simState} />
      </g>
      {!simulating &&
        def.ports.map((p) => {
          const w = localToWorld(comp, def, p);
          return (
            <g
              key={p.id}
              className={clsx("port", open.has(p.id) && "port-open")}
              data-export-ignore
              data-port-id={p.id}
              onPointerDown={(e) => onPortPointerDown(e, comp.id, p.id)}
            >
              <circle className="port-hit" cx={w.x} cy={w.y} r={7} />
              <circle className={`port-dot port-${p.kind}`} cx={w.x} cy={w.y} r={2.5} />
            </g>
          );
        })}
      {comp.label && (
        <text className="label" x={b.x + b.w + 3} y={b.y + 9}>
          {comp.label}
        </text>
      )}
      {selected && (
        <rect
          className="selection-outline"
          data-export-ignore
          x={b.x - 4}
          y={b.y - 4}
          width={b.w + 8}
          height={b.h + 8}
          rx={3}
        />
      )}
    </g>
  );
});
